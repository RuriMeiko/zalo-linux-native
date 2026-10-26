#!/usr/bin/env node
// Updates a user-local native installation from the project's GitHub repository.
//
//   node scripts/update-native.mjs [--check] [--rollback] [--install-timer] [--remove-timer]
//                                  [--app-dir DIR] [--repo URL] [--ref BRANCH]
//
// What an update does (nothing is changed until every earlier step succeeded):
//   1. compare the remote branch head with the commit recorded for this installation;
//   2. clone that commit into a private cache directory and re-check HEAD;
//   3. copy the runtime for this CPU into a NEW directory (old ones are kept);
//   4. install the payload into "<app-dir>.next" with scripts/install-native.mjs (hash-verified copy);
//   5. refuse to continue while Zalo is running from <app-dir>;
//   6. swap directories (old app kept as "<app-dir>.prev-<time>"), run the installed `--check`,
//      and swap back automatically if it fails.
// launch.json (devices, camera, Electron path) is carried over; only `runtime` is repointed.
// The repository content is trusted as code: only run this against a repository you control.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {homedir,arch as cpuArch} from 'node:os';
import {mkdir,readFile,writeFile,rename,rm,readdir,stat,cp,lstat,chmod} from 'node:fs/promises';
import path from 'node:path';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {validateConfig,isRunningApp} from './native-launch.mjs';

const exec=promisify(execFile);
export const DEFAULT_REPO='https://github.com/RuriMeiko/zalo-linux-native.git';
const HOME=homedir();
const STATE_DIR=path.join(process.env.XDG_STATE_HOME||path.join(HOME,'.local/state'),'zalo-native-update');
const CACHE_DIR=path.join(process.env.XDG_CACHE_HOME||path.join(HOME,'.cache'),'zalo-native-update');
const RUNTIME_ROOT=path.join(process.env.XDG_DATA_HOME||path.join(HOME,'.local/share'),'zalo-runtime');
const UNIT_DIR=path.join(process.env.XDG_CONFIG_HOME||path.join(HOME,'.config'),'systemd/user');
const scriptDir=path.dirname(fileURLToPath(import.meta.url));

export const EXIT={OK:0,UPDATE_AVAILABLE:10,USAGE:2,RUNNING:3,FAILED:1};

export function parseArgs(argv) {
  const opts={check:false,rollback:false,installTimer:false,removeTimer:false,appDir:null,repo:DEFAULT_REPO,ref:'main'};
  for(let i=0;i<argv.length;i++) {
    const a=argv[i],value=()=>{const v=argv[++i];if(!v || v.startsWith('--'))throw new Error(`Missing value for ${a}`);return v;};
    if(a==='--check')opts.check=true;
    else if(a==='--rollback')opts.rollback=true;
    else if(a==='--install-timer')opts.installTimer=true;
    else if(a==='--remove-timer')opts.removeTimer=true;
    else if(a==='--app-dir')opts.appDir=value();
    else if(a==='--repo')opts.repo=value();
    else if(a==='--ref')opts.ref=value();
    else throw new Error(`Unknown option: ${a}`);
  }
  if([opts.check,opts.rollback,opts.installTimer,opts.removeTimer].filter(Boolean).length>1)
    throw new Error('Choose at most one of --check, --rollback, --install-timer, --remove-timer');
  if(!/^[A-Za-z0-9._\/-]{1,100}$/.test(opts.ref) || opts.ref.startsWith('-'))throw new Error('Invalid --ref');
  if(!/^(https:\/\/|file:\/\/\/|\/)[^\s\0]+$/.test(opts.repo))throw new Error('Invalid --repo');
  return opts;
}
export function runtimeArch(arch=cpuArch()) {
  if(arch==='x64')return 'x86_64';
  throw new Error(`Native runtime is only packaged for x86_64 (this machine: ${arch}); see ARM-PORT-NOTES.md`);
}
export function repointConfig(config,runtimeDir) {
  return validateConfig({...validateConfig(config),runtime:runtimeDir});
}
export function isUpToDate(state,remote) {return !!state && state.commit===remote;}
export function pickStale(names,keep) {
  // names look like "<prefix>-<sortable suffix>"; keep the newest `keep`.
  return [...names].sort().slice(0,Math.max(0,names.length-keep));
}
export function timerUnits({node,script,appDir}) {
  const quote=v=>`"${String(v).replace(/(["\\$])/g,'\\$1')}"`;
  return {
    service:`[Unit]\nDescription=Update Zalo native from GitHub\n\n[Service]\nType=oneshot\nExecStart=${quote(node)} ${quote(script)} --app-dir ${quote(appDir)}\nSuccessExitStatus=3 10\n`,
    timer:`[Unit]\nDescription=Check for Zalo native updates\n\n[Timer]\nOnBootSec=5min\nOnUnitActiveSec=6h\nRandomizedDelaySec=15min\nPersistent=true\n\n[Install]\nWantedBy=timers.target\n`
  };
}
function defaultAppDir() {
  const parent=path.resolve(scriptDir,'..');
  return existsSync(path.join(parent,'INSTALL-COMPLETE.json'))?parent:path.join(HOME,'.local/share/zalo');
}
async function exists(p) {try {await lstat(p);return true;} catch {return false;}}
async function readJson(p,fallback) {try {return JSON.parse(await readFile(p,'utf8'));} catch {return fallback;}}
function sha7(sha) {return sha.slice(0,7);}
function stamp() {return new Date().toISOString().replace(/[-:T]/g,'').slice(0,14);}
function log(...a) {console.log('[update]',...a);}
async function git(args,options={}) {return (await exec('git',args,{maxBuffer:8*1024*1024,timeout:300000,...options})).stdout.trim();}

async function remoteHead(opts) {
  const out=await git(['ls-remote','--exit-code',opts.repo,`refs/heads/${opts.ref}`]);
  const sha=out.split(/\s+/)[0];
  if(!/^[0-9a-f]{40}$/.test(sha))throw new Error('Unexpected ls-remote output');
  return sha;
}
async function zaloRunning(appDir,electron) {
  let names=[];
  try {names=await readdir('/proc');} catch {return false;}
  for(const name of names) {
    if(!/^[0-9]+$/.test(name))continue;
    try {
      const cmd=await readFile(`/proc/${name}/cmdline`,'utf8');
      const exe=await exec('readlink',[`/proc/${name}/exe`]).then(r=>r.stdout.trim()).catch(()=>'');
      if(exe && isRunningApp(cmd,exe,appDir))return true;
    } catch {/* process went away */}
  }
  return false;
}
async function runNode(script,args,options={}) {
  return exec(process.execPath,[script,...args],{timeout:600000,maxBuffer:16*1024*1024,...options});
}

export async function checkOnly(opts,appDir) {
  const state=await readJson(path.join(STATE_DIR,'state.json'),null);
  const remote=await remoteHead(opts);
  if(isUpToDate(state,remote)){log(`up to date (${sha7(remote)})`);return EXIT.OK;}
  log(`update available: ${state?sha7(state.commit):'unknown'} -> ${sha7(remote)}`);
  return EXIT.UPDATE_AVAILABLE;
}

export async function update(opts,appDir) {
  const config=validateConfig(JSON.parse(await readFile(path.join(appDir,'launch.json'),'utf8')));
  if(config.appDir!==appDir)throw new Error('launch.json does not belong to this installation');
  const archName=runtimeArch();
  const state=await readJson(path.join(STATE_DIR,'state.json'),null);
  const remote=await remoteHead(opts);
  if(isUpToDate(state,remote)){log(`up to date (${sha7(remote)})`);return EXIT.OK;}
  if(await zaloRunning(appDir,config.electron)){
    log('Zalo is running from this installation; close it, then run the update again.');
    return EXIT.RUNNING;
  }
  const work=path.join(CACHE_DIR,sha7(remote)+'-'+stamp());
  const src=path.join(work,'src');
  const staging=appDir+'.next',runtimeDir=path.join(RUNTIME_ROOT,sha7(remote)+'-'+archName);
  if(await exists(staging))throw new Error(`Leftover ${staging}; remove it and retry`);
  await mkdir(work,{recursive:true,mode:0o700});
  try {
    log(`fetching ${sha7(remote)}`);
    await git(['clone','--quiet','--depth','1','--branch',opts.ref,opts.repo,src]);
    const head=await git(['-C',src,'rev-parse','HEAD']);
    if(head!==remote)throw new Error('Remote moved during download; run the update again');

    if(!(await exists(runtimeDir))) {
      log(`preparing runtime ${path.basename(runtimeDir)}`);
      await mkdir(path.join(runtimeDir,'apk/lib'),{recursive:true});
      for(const part of ['bionic','results'])
        await cp(path.join(src,'runtime',part),path.join(runtimeDir,part),{recursive:true,preserveTimestamps:true,verbatimSymlinks:true});
      await cp(path.join(src,'runtime/apk/lib',archName),path.join(runtimeDir,'apk/lib',archName),{recursive:true,preserveTimestamps:true});
    }
    const next=repointConfig(config,runtimeDir);
    const nextConfig=path.join(work,'launch.json');
    await writeFile(nextConfig,JSON.stringify(next,null,2)+'\n',{mode:0o600});

    log('installing into staging directory');
    const installer=path.join(src,'scripts/install-native.mjs');
    await runNode(installer,[nextConfig,staging,'--app-dir',appDir,'--no-device-check'],{cwd:src});

    log('switching to the new version');
    const previous=`${appDir}.prev-${stamp()}`;
    await rename(appDir,previous);
    try {
      await rename(staging,appDir);
      await runNode(path.join(appDir,'scripts/native-launch.mjs'),[path.join(appDir,'launch.json'),'--check']).catch(error=>{
        // Only a missing audio/camera device is acceptable here; anything else rolls back.
        const text=String(error.stdout||'')+String(error.stderr||'');
        if(!/Selected (source|sink|camera) is unavailable|Unable to check selected/.test(text))throw error;
        log('warning: configured audio/camera device is not present right now');
      });
      // The previous copy is only needed until the new one passes its check.
      // Delete it immediately: keeping one backup per update filled the disk
      // with tens of gigabytes of near-identical copies. The git history is
      // the source of truth, so a failed update is reinstalled rather than
      // rolled back to a stale tree.
      await rm(previous,{recursive:true,force:true}).catch(()=>{});
    } catch(error) {
      log('new version failed its check; restoring the previous one');
      await rm(appDir,{recursive:true,force:true}).catch(()=>{});
      await rename(previous,appDir);
      throw error;
    }
    await mkdir(STATE_DIR,{recursive:true,mode:0o700});
    await writeFile(path.join(STATE_DIR,'state.json'),JSON.stringify({commit:remote,runtime:runtimeDir,previous:state,updatedAt:new Date().toISOString()},null,2)+'\n',{mode:0o600});
    await prune(appDir,runtimeDir,state&&state.runtime);
    log(`updated to ${sha7(remote)}. Start Zalo again to use it.`);
    return EXIT.OK;
  } finally {
    await rm(work,{recursive:true,force:true}).catch(()=>{});
    if(await exists(staging))await rm(staging,{recursive:true,force:true}).catch(()=>{});
  }
}
async function prune(appDir,currentRuntime,previousRuntime) {
  const parent=path.dirname(appDir),base=path.basename(appDir)+'.prev-';
  const olds=(await readdir(parent)).filter(n=>n.startsWith(base));
  for(const name of pickStale(olds,1))await rm(path.join(parent,name),{recursive:true,force:true});
  let runtimes=[];
  try {runtimes=await readdir(RUNTIME_ROOT);} catch {return;}
  const keep=new Set([path.basename(currentRuntime),previousRuntime&&path.basename(previousRuntime)].filter(Boolean));
  for(const name of runtimes)if(!keep.has(name))await rm(path.join(RUNTIME_ROOT,name),{recursive:true,force:true});
}
export async function rollback(appDir) {
  const config=validateConfig(JSON.parse(await readFile(path.join(appDir,'launch.json'),'utf8')));
  if(await zaloRunning(appDir,config.electron)){log('Close Zalo first.');return EXIT.RUNNING;}
  const parent=path.dirname(appDir),base=path.basename(appDir)+'.prev-';
  const olds=(await readdir(parent)).filter(n=>n.startsWith(base)).sort();
  if(!olds.length)throw new Error('No previous version to restore');
  const previous=path.join(parent,olds[olds.length-1]);
  const failed=`${appDir}.failed-${stamp()}`;
  await rename(appDir,failed);
  await rename(previous,appDir);
  await rm(failed,{recursive:true,force:true});
  const state=await readJson(path.join(STATE_DIR,'state.json'),null);
  await mkdir(STATE_DIR,{recursive:true,mode:0o700});
  await writeFile(path.join(STATE_DIR,'state.json'),JSON.stringify(state&&state.previous?state.previous:{},null,2)+'\n',{mode:0o600});
  log('restored the previous version');
  return EXIT.OK;
}
export async function installTimer(appDir) {
  const script=path.join(appDir,'scripts/update-native.mjs');
  if(!(await exists(script)))throw new Error('Run this from an installed copy (scripts/update-native.mjs missing)');
  const units=timerUnits({node:process.execPath,script,appDir});
  await mkdir(UNIT_DIR,{recursive:true});
  await writeFile(path.join(UNIT_DIR,'zalo-native-update.service'),units.service);
  await writeFile(path.join(UNIT_DIR,'zalo-native-update.timer'),units.timer);
  await exec('systemctl',['--user','daemon-reload']);
  await exec('systemctl',['--user','enable','--now','zalo-native-update.timer']);
  log('automatic update check enabled (every 6 hours; it waits while Zalo is open)');
  return EXIT.OK;
}
export async function removeTimer() {
  await exec('systemctl',['--user','disable','--now','zalo-native-update.timer']).catch(()=>{});
  await rm(path.join(UNIT_DIR,'zalo-native-update.timer'),{force:true});
  await rm(path.join(UNIT_DIR,'zalo-native-update.service'),{force:true});
  await exec('systemctl',['--user','daemon-reload']).catch(()=>{});
  log('automatic update check disabled');
  return EXIT.OK;
}

async function main() {
  let opts;
  try {opts=parseArgs(process.argv.slice(2));}
  catch(error) {console.error(error.message);console.error('Usage: node scripts/update-native.mjs [--check|--rollback|--install-timer|--remove-timer] [--app-dir DIR] [--repo URL] [--ref BRANCH]');return EXIT.USAGE;}
  const appDir=path.resolve(opts.appDir||defaultAppDir());
  if(opts.check)return checkOnly(opts,appDir);
  if(opts.rollback)return rollback(appDir);
  if(opts.installTimer)return installTimer(appDir);
  if(opts.removeTimer)return removeTimer();
  return update(opts,appDir);
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().then(code=>{process.exitCode=code;},error=>{console.error('[update] failed:',error.message);process.exitCode=EXIT.FAILED;});
