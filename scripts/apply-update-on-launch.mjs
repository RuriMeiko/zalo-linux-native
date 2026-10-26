#!/usr/bin/env node
// Applies a pending update before Zalo starts, so "quit and reopen Zalo" is enough
// to move to the new version.
//
// scripts/update-native.mjs refuses to swap directories while Zalo runs from the
// installation, so the check has to happen here: launch-installed.sh runs this script
// and only then execs the launcher. Everything is best effort — a network failure, a
// missing git, or a read-only state directory must never stop Zalo from opening.
import {spawn} from 'node:child_process';
import {access,mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const EXIT={OK:0,UPDATE_AVAILABLE:10,RUNNING:3,USAGE:2,FAILED:1};
// The updater has its own git timeouts; this is only a hard ceiling for launch.
const DEFAULT_TIMEOUT_MS=120000;

export function parseArgs(argv) {
  const opts={appDir:null,timeoutMs:DEFAULT_TIMEOUT_MS,quiet:false,strict:false};
  for(let i=0;i<argv.length;i++) {
    const a=argv[i],value=()=>{const v=argv[++i];if(!v||v.startsWith('--'))throw new Error('Missing value for '+a);return v;};
    if(a==='--app-dir')opts.appDir=value();
    else if(a==='--timeout-ms') {
      const n=Number(value());
      if(!Number.isInteger(n)||n<1000||n>600000)throw new Error('timeout-ms must be 1000..600000');
      opts.timeoutMs=n;
    }
    else if(a==='--quiet')opts.quiet=true;
    else if(a==='--strict')opts.strict=true;
    else throw new Error('Unknown option: '+a);
  }
  return opts;
}
// A source checkout has no INSTALL-COMPLETE.json, so it never tries to replace itself.
export async function resolveAppDir(appDir) {
  if(typeof appDir!=='string'||!path.isAbsolute(appDir))return null;
  try {await access(path.join(appDir,'INSTALL-COMPLETE.json'));} catch {return null;}
  try {await access(path.join(appDir,'scripts/update-native.mjs'));} catch {return null;}
  return appDir;
}
// Runs one update pass. Resolves with {code,stdout,stderr,skipped}; never rejects.
export async function applyUpdate(options={}) {
  const {appDir,timeoutMs=DEFAULT_TIMEOUT_MS,spawnProcess=spawn,node=process.execPath}=options;
  const dir=await resolveAppDir(appDir);
  if(!dir)return {code:null,skipped:true,stdout:'',stderr:''};
  const script=path.join(dir,'scripts/update-native.mjs');
  return await new Promise(resolve=>{
    let stdout='',stderr='',settled=false,timer;
    const finish=result=>{if(settled)return;settled=true;clearTimeout(timer);resolve(result);};
    let child;
    try {child=spawnProcess(node,[script,'--app-dir',dir],{stdio:['ignore','pipe','pipe']});}
    catch(error) {finish({code:EXIT.FAILED,stdout:'',stderr:String((error&&error.message)||error)});return;}
    if(child.stdout)child.stdout.on('data',chunk=>{stdout+=chunk;});
    if(child.stderr)child.stderr.on('data',chunk=>{stderr+=chunk;});
    child.once('error',error=>finish({code:EXIT.FAILED,stdout,stderr:String((error&&error.message)||error)}));
    child.once('close',code=>finish({code,stdout,stderr}));
    timer=setTimeout(()=>{
      try {child.kill('SIGTERM');} catch {}
      finish({code:EXIT.FAILED,stdout,stderr:stderr+'\n[update] timed out'});
    },timeoutMs);
    if(timer.unref)timer.unref();
  });
}
// Records the last attempt next to update-native.mjs state so a failure is visible
// without a terminal. Advisory only: an unwritable directory is not an error.
export async function writeStamp(stateDir,result) {
  const file=path.join(stateDir,'last-launch-check.json');
  const payload={at:new Date().toISOString(),code:result.code,skipped:!!result.skipped,
    message:(result.stderr||result.stdout||'').trim().split('\n').filter(Boolean).slice(-3).join(' | ')};
  try {
    await mkdir(stateDir,{recursive:true,mode:0o700});
    await writeFile(file,JSON.stringify(payload,null,2)+'\n',{mode:0o600});
  } catch {
    // Advisory only, but never silent: a failed check that cannot be recorded is
    // still worth one line on stderr so a user running the launcher sees it.
    if(payload.code!==null && payload.code!==undefined && payload.code!==0 && payload.code!==10 && payload.code!==3)
      process.stderr.write('[update] '+(payload.message||'check failed')+'\n');
  }
}
export function stateDir() {
  return path.join(process.env.XDG_STATE_HOME||path.join(homedir(),'.local/state'),'zalo-native-update');
}
async function main() {
  const opts=parseArgs(process.argv.slice(2));
  const appDir=opts.appDir||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const result=await applyUpdate({appDir,timeoutMs:opts.timeoutMs});
  if(!result.skipped)await writeStamp(stateDir(),result);
  if(!opts.quiet&&!result.skipped) {
    if(result.code===EXIT.OK)process.stdout.write('[update] up to date or updated before launch\n');
    else if(result.code===EXIT.UPDATE_AVAILABLE)process.stdout.write('[update] update available; quitting and reopening Zalo installs it\n');
    else if(result.code===EXIT.RUNNING)process.stdout.write('[update] Zalo is still running; skipped\n');
    else process.stderr.write('[update] check failed: '+(result.stderr||'').trim()+'\n');
  }
  const failed=!result.skipped&&result.code!==EXIT.OK&&result.code!==EXIT.UPDATE_AVAILABLE&&result.code!==EXIT.RUNNING;
  return opts.strict&&failed?EXIT.FAILED:EXIT.OK;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().then(code=>{process.exitCode=code;},error=>{console.error('[update] '+error.message);process.exitCode=EXIT.FAILED;});
