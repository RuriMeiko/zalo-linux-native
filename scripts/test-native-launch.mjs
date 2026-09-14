import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {validateConfig,launchSpec,isRunningApp,parseKdeWindowMatch,activateKdeWindow,activateExistingApp,runNativeLaunch,inspectCallDevices,preflight} from './native-launch.mjs';
const electron='/opt/electron/electron',app='/opt/test app';
for(const cmd of [`${electron}\0--no-sandbox\0${app}\0`,`${electron} --no-sandbox ${app}\0`,`${electron} ${app}\0`])
  assert.equal(isRunningApp(cmd,electron,app),true);
for(const cmd of [`${electron}\0--type=renderer\0${app}\0`,`${electron} --type=renderer ${app}\0`,
  `${electron} --no-sandbox ${app}-other\0`,`${electron} /other ${app}\0`,`${electron}\0/other\0`])
  assert.equal(isRunningApp(cmd,electron,app),false);
assert.equal(isRunningApp(`${electron} ${app}\0`,'/usr/bin/bash',app),false);
const config={appDir:'/opt/test app',electron:'/opt/electron/electron',runtime:'/opt/runtime',
  source:'bluez_input.fixture:duplex',sink:'bluez_output.fixture_duplex.1'};
for(const value of [null,[],{...config,unknown:1},{...config,appDir:'relative'},
  {...config,source:'out.monitor'},{...config,sink:'$(touch nope)'},{...config,cdpPort:922},
  {...config,cdpPort:'9222'},{...config,noSandbox:'true'},{...config,source:'bad\nname'}])
  assert.throws(()=>validateConfig(value));
assert.deepEqual(validateConfig(config),config);
for(const extra of [{experimentalVideo:'true'},{experimentalVideo:true},
  {videoDevice:'/dev/video0'},{experimentalVideo:false,videoDevice:'/dev/video0'},
  {experimentalVideo:true,videoDevice:'/home/user/camera'},
  {experimentalVideo:true,videoDevice:'/dev/video0\n'}])
  assert.throws(()=>validateConfig({...config,...extra}));
const videoSpec=launchSpec({...config,experimentalVideo:true,videoDevice:'/dev/video2'},
  {ZALO_ZCALL_VIDEO_DEVICE:'/dev/video99',ZALO_ZCALL_NATIVE_VIDEO:'0'});
assert.equal(videoSpec.env.ZALO_ZCALL_NATIVE_VIDEO,'1');
assert.equal(videoSpec.env.ZALO_ZCALL_VIDEO_DEVICE,'/dev/video2');
assert.equal(videoSpec.env.ZALO_ZCALL_NATIVE_NETWORK,'1');
assert.equal(videoSpec.env.ZALO_ZCALL_NATIVE_MEDIA,'1');
assert.throws(()=>validateConfig({...config,experimentalIncoming:'true'}));
assert.equal(launchSpec({...config,experimentalIncoming:true},{}).env.ZALO_ZCALL_NATIVE_INCOMING,'1');
assert.equal(launchSpec(config,{ZALO_ZCALL_NATIVE_INCOMING:'1'}).env.ZALO_ZCALL_NATIVE_INCOMING,undefined);
assert.throws(()=>validateConfig({...config,log:'true'}));
assert.throws(()=>validateConfig({...config,log:1}));
assert.equal(launchSpec({...config,log:true},{}).env.ZALO_ZCALL_LOG,'1');
assert.equal(launchSpec(config,{ZALO_ZCALL_LOG:'1'}).env.ZALO_ZCALL_LOG,'0');
const spec=launchSpec(config,{PATH:'/bin',ELECTRON_RUN_AS_NODE:'1',LD_PRELOAD:'bad',
  ZALO_ZCALL_CAPTURE:'/tmp/private',ZALO_ZCALL_SCHEMA_LOG:'/tmp/schema',ZCALL_USE_PROXY:'1',
  ZALO_ZCALL_NATIVE_VIDEO:'1',ZALO_ZCALL_VIDEO_DEVICE:'/dev/video0',
  ZALO_ZCALL_UI_PIPE:'19',ZALO_ZCALL_VIDEO_PIPE:'20',ZALO_ZCALL_PREVIEW_PIPE:'21'});
assert.deepEqual(spec.args,['/opt/test app']);
assert.equal(spec.executable,config.electron);
assert.equal(spec.env.ZCALL_USE_PROXY,'0');
assert.equal(spec.env.ZALO_ZCALL_NATIVE_MEDIA,'1');
for(const key of ['ELECTRON_RUN_AS_NODE','LD_PRELOAD','ZALO_ZCALL_CAPTURE','ZALO_ZCALL_SCHEMA_LOG','ZALO_ZCALL_NATIVE_VIDEO','ZALO_ZCALL_VIDEO_DEVICE',
  'ZALO_ZCALL_UI_PIPE','ZALO_ZCALL_VIDEO_PIPE','ZALO_ZCALL_PREVIEW_PIPE'])
  assert.equal(Object.hasOwn(spec.env,key),false);
assert.deepEqual(launchSpec({...config,noSandbox:true,cdpPort:9222},{}).args,
  ['--no-sandbox','--remote-debugging-address=127.0.0.1','--remote-debugging-port=9222',config.appDir]);
{
  const kdeFixture='[Argument: a(sssida{sv}) [Argument: (sssida{sv}) "0_{11111111-2222-3333-4444-555555555555}", "Zalo notes", "konsole", 100, 0.9], [Argument: (sssida{sv}) "0_{73164c4f-24d4-41e9-a384-0f014dbd50f8}", "Zalo", "zalo", 100, 0.8]]';
  assert.equal(parseKdeWindowMatch(kdeFixture),'0_{73164c4f-24d4-41e9-a384-0f014dbd50f8}');
  assert.equal(parseKdeWindowMatch('"0_{73164c4f-24d4-41e9-a384-0f014dbd50f8}", "Zalo notes", "konsole"'),null);
  const kdeCalls=[];
  assert.equal(await activateKdeWindow({desktop:'KDE',run:async(command,args,options)=>{
    kdeCalls.push([command,args,options]);
    return {stdout:kdeCalls.length===1?kdeFixture:''};
  }}),true);
  assert.deepEqual(kdeCalls.map(call=>call[1]),[
    ['--literal','org.kde.KWin','/WindowsRunner','org.kde.krunner1.Match','Zalo'],
    ['org.kde.KWin','/WindowsRunner','org.kde.krunner1.Run','0_{73164c4f-24d4-41e9-a384-0f014dbd50f8}',''],
  ]);
  assert.equal(await activateKdeWindow({desktop:'GNOME',run:()=>assert.fail('must not query KWin')}),false);
  assert.equal(await activateKdeWindow({desktop:'KDE',run:async()=>({stdout:'no exact window'})}),false);
  let invocation,unref=0,desktopActivations=0;
  const activated=activateExistingApp(config,{launch:(...args)=>{
    invocation=args;const child=new EventEmitter();child.unref=()=>{unref++;};
    queueMicrotask(()=>child.emit('exit',0));return child;
  },activateDesktop:async()=>{desktopActivations++;return true;}});
  assert.equal(await activated,true);assert.equal(unref,1);
  assert.equal(desktopActivations,1);
  assert.deepEqual(invocation.slice(0,2),[config.electron,[config.appDir]]);
  assert.equal(invocation[2].stdio,'ignore');
  assert.equal(await activateExistingApp(config,{launch:()=>{throw new Error('private spawn failure');},activateDesktop:()=>assert.fail()}),false);
  let preflightCalls=0,activateCalls=0;
  assert.equal(await runNativeLaunch(config,{}, {
    findApp:async appDir=>{assert.equal(appDir,config.appDir);return 4321;},
    activateApp:async value=>{activateCalls++;assert.deepEqual(value,config);return true;},
    runPreflight:async()=>{preflightCalls++;throw new Error('must not inspect devices');},
    launch:()=>assert.fail('must not launch a primary process'),
  }),null);
  assert.equal(activateCalls,1);assert.equal(preflightCalls,0,'running-app activation is the fast path');
  await assert.rejects(runNativeLaunch(config,{}, {
    findApp:async()=>4321,activateApp:async()=>false,
    runPreflight:async()=>assert.fail(),launch:()=>assert.fail(),
  }),/activate/);
}
console.log('PASS portable native launch: strict config, fast single-instance activation, no proxy/capture inheritance, explicit sandbox/CDP');
const cameraConfig={...config,experimentalVideo:true,videoDevice:'/dev/video0'};
for(const mode of ['ready','camera-missing','camera-file','no-output','pulse-error','malformed']) {
  const selected=JSON.parse(JSON.stringify(cameraConfig)),queries=[];
  const warnings=await inspectCallDevices(selected,{
    statDevice:async device=>{
      assert.equal(device,selected.videoDevice);
      if(mode==='camera-missing')throw new Error('private filesystem error');
      return {isCharacterDevice:()=>mode!=='camera-file'};
    },
    queryPulse:async(command,args,options)=>{
      assert.equal(command,'pactl');assert.equal(options.timeout,3000);queries.push(args[2]);
      if(mode==='pulse-error')throw new Error('private server error');
      if(mode==='malformed')return {stdout:'not JSON'};
      return {stdout:JSON.stringify([{name:args[2]==='sources'?selected.source:mode==='no-output'?'auto_null':selected.sink}])};
    },
  });
  assert.deepEqual(queries,['sources','sinks']);
  assert.deepEqual(selected,cameraConfig,'Device inspection must not rewrite selections');
  const expected=mode==='ready'?[]:mode.startsWith('camera')?['Selected camera is unavailable']:
    mode==='no-output'?['Selected sink is unavailable']:['Unable to check selected source','Unable to check selected sink'];
  assert.deepEqual(warnings,expected);
}
await assert.rejects(preflight(config,{requireDevices:'false'}),/boolean/);
await assert.rejects(preflight({...config,runtime:'/nonexistent-zalo-runtime-fixture'}, {requireDevices:false}),/ENOENT/);
console.log('PASS device readiness: disconnect warnings, no silent fallback, bounded Pulse queries, redacted errors; runtime remains required');
