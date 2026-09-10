#!/usr/bin/env node
// Native voice development launcher. No downloads, upstream updates or defaults
// that silently fall back to Wine. Configuration is data, never sourced shell.
import {readFile,stat,readdir} from 'node:fs/promises';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const exec=promisify(execFile);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash='c7e5f005fd5c12dc64d72008a1871638246899a9cf6b034dc13981c014caeefe';
export function validateConfig(config) {
  const keys=['appDir','electron','runtime','source','sink','noSandbox','cdpPort','experimentalVideo','videoDevice','experimentalIncoming'];
  if(!config || typeof config!=='object' || Array.isArray(config) ||
      Object.keys(config).some(k=>!keys.includes(k))) throw new Error('Invalid native-launch configuration keys');
  for(const key of ['appDir','electron','runtime'])
    if(typeof config[key]!=='string' || !path.isAbsolute(config[key]) || /[\0\r\n]/.test(config[key]))
      throw new Error(`Expected absolute path: ${key}`);
  for(const key of ['source','sink'])
    if(typeof config[key]!=='string' || !/^[A-Za-z0-9_.:-]+$/.test(config[key]))
      throw new Error(`Expected explicit Pulse device name: ${key}`);
  if(config.source.endsWith('.monitor')) throw new Error('Choose a microphone, not a playback monitor');
  if(config.experimentalVideo!==undefined && typeof config.experimentalVideo!=='boolean')
    throw new Error('experimentalVideo must be boolean');
  if(config.experimentalIncoming!==undefined && typeof config.experimentalIncoming!=='boolean')
    throw new Error('experimentalIncoming must be boolean');
  if(config.experimentalVideo===true) {
    if(typeof config.videoDevice!=='string' || !/^\/dev\/video[0-9]+$/.test(config.videoDevice))
      throw new Error('Experimental video requires an explicit /dev/videoN device');
  } else if(config.videoDevice!==undefined) throw new Error('videoDevice requires experimentalVideo opt-in');
  if(config.noSandbox!==undefined && typeof config.noSandbox!=='boolean') throw new Error('noSandbox must be boolean');
  if(config.cdpPort!==undefined && (!Number.isInteger(config.cdpPort) || config.cdpPort<1024 || config.cdpPort>65535))
    throw new Error('cdpPort must be 1024..65535');
  return {...config};
}
export function launchSpec(config,inherited=process.env) {
  const c=validateConfig(config),env={...inherited};
  for(const name of ['ELECTRON_RUN_AS_NODE','LD_PRELOAD','LD_AUDIT','ZALO_ZCALL_CAPTURE',
    'ZALO_ZCALL_SCHEMA_LOG','ZRTC_DEBUG_BACKTRACE','ZRTC_PCM_HOST','ZRTC_PCM_SOURCE','ZRTC_PCM_SINK',
    'ZALO_ZCALL_NATIVE_VIDEO','ZALO_ZCALL_VIDEO_DEVICE','ZALO_ZCALL_NATIVE_INCOMING']) delete env[name];
  Object.assign(env,{ZCALL_USE_PROXY:'0',ZCALL_PROXY_AUTOSTART:'0',ZALO_ZCALL_LOG:'0',
    ZALO_ZCALL_NATIVE_SETUP:'1',ZALO_ZCALL_NATIVE_NETWORK:'1',ZALO_ZCALL_NATIVE_MEDIA:'1',
    ZALO_ZRTC_RUNTIME:c.runtime,ZALO_ZCALL_PCM_SOURCE:c.source,ZALO_ZCALL_PCM_SINK:c.sink,
    ZALO_ZCALL_AGENT_PATH:path.join(root,'native/qt-call-cap-linux/zcall-agent.js')});
  if(c.experimentalVideo)Object.assign(env,{ZALO_ZCALL_NATIVE_VIDEO:'1',ZALO_ZCALL_VIDEO_DEVICE:c.videoDevice});
  if(c.experimentalIncoming)env.ZALO_ZCALL_NATIVE_INCOMING='1';
  const args=[];
  if(c.noSandbox) args.push('--no-sandbox');
  if(c.cdpPort) args.push('--remote-debugging-address=127.0.0.1',`--remote-debugging-port=${c.cdpPort}`);
  args.push(c.appDir);
  return {executable:c.electron,args,env};
}
export async function preflight(config) {
  const c=validateConfig(config);
  if(c.experimentalIncoming)await exec('zenity',['--version'],{timeout:3000,maxBuffer:4096});
  for(const file of [c.electron,path.join(c.appDir,'bootstrap.js'),
    path.join(c.runtime,'bionic/linker64'),path.join(c.runtime,'results/zrtc-worker'),
    path.join(c.runtime,'results/pcm-host')]) {
    if(!(await stat(file)).isFile()) throw new Error('Required runtime component is not a file');
  }
  if(createHash('sha256').update(await readFile(path.join(c.runtime,'apk/lib/x86_64/libzrtc.so'))).digest('hex')!==hash)
    throw new Error('Unsupported native library hash');
  if(c.experimentalVideo && !(await stat(c.videoDevice)).isCharacterDevice())
    throw new Error('Selected camera is not a character device');
  for(const [field,kind] of [['source','sources'],['sink','sinks']]) {
    const result=await exec('pactl',['--format=json','list',kind],{timeout:3000,maxBuffer:2*1024*1024});
    const rows=JSON.parse(result.stdout);
    if(!Array.isArray(rows) || !rows.some(row=>row.name===c[field])) throw new Error(`Selected ${field} is unavailable`);
  }
}
async function rejectExistingApp(appDir) {
  for(const pid of await readdir('/proc')) {
    if(!/^\d+$/.test(pid)) continue;
    let argv;
    try {argv=(await readFile(`/proc/${pid}/cmdline`,'utf8')).split('\0');}
    catch {continue;} // exited process or inaccessible other-user process
    if(path.basename(argv[0])==='electron' && argv.includes(appDir) && !argv.some(a=>a.startsWith('--type=')))
      throw new Error('Zalo is already running; quit it from the tray before applying native configuration');
  }
}
async function main() {
  const args=process.argv.slice(2);
  if(args.some(a=>a.startsWith('--') && a!=='--check') || args.filter(a=>a!=='--check').length>1)
    throw new Error('Usage: node scripts/native-launch.mjs [config.json] [--check]');
  const configPath=args.find(a=>a!=='--check') || path.join(process.env.XDG_CONFIG_HOME || path.join(homedir(),'.config'),'zalo-native-linux','launch.json');
  const config=validateConfig(JSON.parse(await readFile(configPath,'utf8')));
  await preflight(config);
  if(args.includes('--check')) {console.log('PASS native runtime and configured device presence; no call or camera capture started');return;}
  await rejectExistingApp(config.appDir);
  const {executable,args:electronArgs,env}=launchSpec(config);
  console.log(config.experimentalVideo?'Starting experimental native voice/video; end-to-end video acceptance remains unverified.':
    'Starting experimental native voice; video is disabled.');
  if(config.noSandbox) console.warn('Warning: Electron sandbox explicitly disabled by configuration.');
  const child=spawn(executable,electronArgs,{env,stdio:'inherit'});
  for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>child.kill(signal));
  child.on('error',()=>{console.error('Unable to start Electron');process.exitCode=1;});
  child.on('exit',(code,signal)=>{process.exitCode=code ?? (signal?1:0);});
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(error=>{console.error(`Native launch failed: ${error.message}`);process.exitCode=1;});
