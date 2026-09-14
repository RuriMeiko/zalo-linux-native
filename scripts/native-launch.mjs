#!/usr/bin/env node
// Native voice development launcher. No downloads, upstream updates or defaults
// that silently fall back to Wine. Configuration is data, never sourced shell.
import {readFile,stat,readdir,readlink} from 'node:fs/promises';
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
  const keys=['appDir','electron','runtime','source','sink','noSandbox','cdpPort','experimentalVideo','videoDevice','experimentalIncoming','log'];
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
  // Opt-in diagnostics: launch.json boolean only; the environment never
  // selects logging (config-isolation invariant). true leaves a phase trace
  // (~/.config/ZaloData/zcall-agent.log) after a stuck call.
  if(config.log!==undefined && typeof config.log!=='boolean')
    throw new Error('log must be boolean');
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
    'ZALO_ZCALL_NATIVE_VIDEO','ZALO_ZCALL_VIDEO_DEVICE','ZALO_ZCALL_NATIVE_INCOMING',
    'ZALO_ZCALL_UI_PIPE','ZALO_ZCALL_VIDEO_PIPE','ZALO_ZCALL_PREVIEW_PIPE']) delete env[name];
  Object.assign(env,{ZCALL_USE_PROXY:'0',ZCALL_PROXY_AUTOSTART:'0',ZALO_ZCALL_LOG:c.log===true?'1':'0',
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
// Devices can disappear while the app is closed. Preserve explicit selections
// and let messaging launch; strict --check still reports call readiness failure.
export async function inspectCallDevices(config,{statDevice=stat,queryPulse=exec}={}) {
  const c=validateConfig(config),warnings=[];
  if(c.experimentalVideo) {
    try {if(!(await statDevice(c.videoDevice)).isCharacterDevice())warnings.push('Selected camera is unavailable');}
    catch {warnings.push('Selected camera is unavailable');}
  }
  for(const [field,kind] of [['source','sources'],['sink','sinks']]) {
    try {
      const result=await queryPulse('pactl',['--format=json','list',kind],{timeout:3000,maxBuffer:2*1024*1024});
      const rows=JSON.parse(result.stdout);
      if(!Array.isArray(rows) || !rows.some(row=>row?.name===c[field]))warnings.push(`Selected ${field} is unavailable`);
    } catch {warnings.push(`Unable to check selected ${field}`);}
  }
  return warnings;
}
export async function preflight(config,{requireDevices=true}={}) {
  if(typeof requireDevices!=='boolean')throw new TypeError('requireDevices must be boolean');
  const c=validateConfig(config);
  for(const file of [c.electron,path.join(c.appDir,'bootstrap.js'),
    path.join(c.runtime,'bionic/linker64'),path.join(c.runtime,'results/zrtc-worker'),
    path.join(c.runtime,'results/pcm-host')]) {
    if(!(await stat(file)).isFile()) throw new Error('Required runtime component is not a file');
  }
  if(createHash('sha256').update(await readFile(path.join(c.runtime,'apk/lib/x86_64/libzrtc.so'))).digest('hex')!==hash)
    throw new Error('Unsupported native library hash');
  const warnings=await inspectCallDevices(c);
  if(requireDevices && warnings.length)throw new Error(warnings.join('; '));
  return warnings;
}
export function isRunningApp(cmdline,executable,appDir) {
  if(path.basename(executable)!=='electron') return false;
  const argv=cmdline.split('\0').filter(Boolean);
  if(argv.some(a=>a.startsWith('--type='))) return false;
  if(argv.length>1) return argv.includes(appDir);
  // Electron process.title can replace the original NUL-separated argv.
  // Match the exact executable and final app path, never a substring or shell.
  const title=argv[0] || '';
  if(!title.startsWith(executable+' ') || !title.endsWith(' '+appDir)) return false;
  const options=title.slice(executable.length+1,-appDir.length-1);
  return !options || options.split(' ').every(a=>/^--[A-Za-z0-9-]+(?:=[^\s]+)?$/.test(a) && !a.startsWith('--type='));
}
export async function findRunningApp(appDir) {
  for(const pid of await readdir('/proc')) {
    if(!/^\d+$/.test(pid)) continue;
    let cmdline,executable;
    try {
      [cmdline,executable]=await Promise.all([readFile(`/proc/${pid}/cmdline`,'utf8'),readlink(`/proc/${pid}/exe`)]);
    }
    catch {continue;} // exited process or inaccessible other-user process
    if(isRunningApp(cmdline,executable,appDir))
      return Number(pid);
  }
  return null;
}
export function parseKdeWindowMatch(output) {
  if(typeof output!=='string') return null;
  // KWin's runner returns both ordinary search hits and running windows. Only
  // accept the exact Zalo window tuple; never activate a terminal/document
  // merely because its title also contains "Zalo".
  const match=output.match(/"(0_\{[0-9a-fA-F-]{36}\})",\s*"Zalo",\s*"zalo"/);
  return match?.[1] || null;
}
export async function activateKdeWindow({desktop=process.env.XDG_CURRENT_DESKTOP,run=exec}={}) {
  if(typeof run!=='function')throw new TypeError('Invalid KDE window activator');
  if(typeof desktop!=='string' || !/(?:^|:)KDE(?:$|:)/i.test(desktop))return false;
  try {
    const result=await run('qdbus6',['--literal','org.kde.KWin','/WindowsRunner',
      'org.kde.krunner1.Match','Zalo'],{timeout:1500,maxBuffer:256*1024});
    const matchId=parseKdeWindowMatch(result.stdout);
    if(!matchId)return false;
    await run('qdbus6',['org.kde.KWin','/WindowsRunner','org.kde.krunner1.Run',matchId,''],
      {timeout:1500,maxBuffer:64*1024});
    return true;
  } catch {return false;}
}
export async function activateExistingApp(config,{launch=spawn,settleMs=750,activateDesktop=activateKdeWindow}={}) {
  if(typeof launch!=='function' || typeof activateDesktop!=='function' ||
      !Number.isInteger(settleMs) || settleMs<1 || settleMs>5000)
    throw new TypeError('Invalid existing-instance activator');
  const {executable,args:electronArgs,env}=launchSpec(config);
  // Electron's single-instance event is the desktop-independent activation
  // path. The existing main process restores, shows and focuses its own real
  // BrowserWindow, avoiding compositor-specific DBus/wmctrl races.
  try {
    const notified=await new Promise(resolve=>{
      let child,done=false,timer;
      const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);};
      try {child=launch(executable,electronArgs,{env,stdio:'ignore'});}
      catch {finish(false);return;}
      child.once('error',()=>finish(false));
      child.once('exit',()=>finish(true));
      child.unref?.();
      // If the previous owner exited between detection and launch, this child
      // becomes the replacement app. Never kill it merely because it stayed
      // alive; detach the short-lived menu launcher instead.
      timer=setTimeout(()=>finish(true),settleMs);
    });
    if(!notified)return false;
    // Electron 22 can deliver `second-instance` yet leave a minimized Wayland
    // surface minimized. KWin's own runner supplies the compositor activation
    // token and reliably de-minimizes/focuses it. This is a best-effort KDE
    // supplement; GNOME/X11 and systems without qdbus keep the Electron path.
    await activateDesktop();
    return true;
  } catch {return false;}
}
export async function runNativeLaunch(config,{check=false}={},
  {findApp=findRunningApp,activateApp=activateExistingApp,runPreflight=preflight,launch=spawn}={}) {
  if(typeof check!=='boolean')throw new TypeError('check must be boolean');
  if(typeof findApp!=='function' || typeof activateApp!=='function' ||
    typeof runPreflight!=='function' || typeof launch!=='function')throw new TypeError('Invalid launcher dependencies');
  const c=validateConfig(config);
  // Menu activation must not wait for runtime hashing or Pulse/V4L2 probes.
  // A running app owns its already-open resources and only needs the standard
  // Electron second-instance notification.
  if(!check) {
    const existingPid=await findApp(c.appDir);
    if(existingPid) {
      if(!await activateApp(c))throw new Error('Unable to activate the running Zalo window');
      console.log('Zalo is already running; activated existing window.');
      return null;
    }
  }
  const warnings=await runPreflight(c,{requireDevices:check});
  if(check) {console.log('PASS native runtime and configured device presence; no call or camera capture started');return null;}
  for(const warning of warnings)console.warn(`Call device warning: ${warning}. Reconnect the configured device before calling; selection unchanged.`);
  const {executable,args:electronArgs,env}=launchSpec(c);
  console.log(c.experimentalVideo?'Starting experimental native voice/video; end-to-end video acceptance remains unverified.':
    'Starting experimental native voice; video is disabled.');
  if(c.noSandbox) console.warn('Warning: Electron sandbox explicitly disabled by configuration.');
  const child=launch(executable,electronArgs,{env,stdio:'inherit'});
  for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>child.kill(signal));
  child.on('error',()=>{console.error('Unable to start Electron');process.exitCode=1;});
  child.on('exit',(code,signal)=>{process.exitCode=code ?? (signal?1:0);});
  return child;
}
async function main() {
  const args=process.argv.slice(2);
  if(args.some(a=>a.startsWith('--') && a!=='--check') || args.filter(a=>a!=='--check').length>1)
    throw new Error('Usage: node scripts/native-launch.mjs [config.json] [--check]');
  const configPath=args.find(a=>a!=='--check') || path.join(process.env.XDG_CONFIG_HOME || path.join(homedir(),'.config'),'zalo-native-linux','launch.json');
  const config=validateConfig(JSON.parse(await readFile(configPath,'utf8')));
  await runNativeLaunch(config,{check:args.includes('--check')});
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(error=>{console.error(`Native launch failed: ${error.message}`);process.exitCode=1;});
