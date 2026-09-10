import assert from 'node:assert/strict';
import {validateConfig,launchSpec,isRunningApp} from './native-launch.mjs';
const electron='/opt/electron/electron',app='/opt/test app';
for(const cmd of [`${electron}\0--no-sandbox\0${app}\0`,`${electron} --no-sandbox ${app}\0`,`${electron} ${app}\0`])
  assert.equal(isRunningApp(cmd,electron,app),true);
for(const cmd of [`${electron}\0--type=renderer\0${app}\0`,`${electron} --type=renderer ${app}\0`,
  `${electron} --no-sandbox ${app}-other\0`,`${electron} /other ${app}\0`,`${electron}\0/other\0`])
  assert.equal(isRunningApp(cmd,electron,app),false);
assert.equal(isRunningApp(`${electron} ${app}\0`,'/usr/bin/bash',app),false);
const config={appDir:'/opt/test app',electron:'/opt/electron/electron',runtime:'/opt/runtime',
  source:'bluez_input.11:22:33:44:55:66',sink:'bluez_output.11_22_33_44_55_66.1'};
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
console.log('PASS portable native launch: strict config, Bluetooth names, no proxy/capture inheritance, explicit sandbox/CDP');
