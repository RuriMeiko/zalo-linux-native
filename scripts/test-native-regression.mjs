#!/usr/bin/env node
// Account-free module/control checks; no GUI, microphone or camera capture.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const plainNode=process.versions.electron?spawnSync('node',['-p','process.execPath'],{
  cwd:root,encoding:'utf8',timeout:5000
}):null;
const nodeExecutable=plainNode?
  ((!plainNode.error && plainNode.status===0 && path.isAbsolute(plainNode.stdout.trim()))?plainNode.stdout.trim():null):process.execPath;
if(!nodeExecutable) throw new Error('A plain Node.js runtime is required for the installer regression');
const tests=[
  ['scripts/test-call-control.mjs'],
  ...['file-utils','file-utilities','zfile','zwalker','v8-profiles','mp4thumb','zjxl','zcall','zimage']
    .map(name=>[`native/nativelibs/${name}/test-linux.js`]),
  ['native/nativelibs/zimage/test-vips-temp.cjs'],['native/nativelibs/zimage/test-encode-extra.cjs'],
  ['scripts/test-linux-header.cjs'],['scripts/test-linux-header.cjs','--shared'],
  ['scripts/test-viewer-extras.cjs'],['scripts/test-signaling-log-privacy.cjs'],
  ['scripts/test-install-native.mjs'],['scripts/test-verify-installation.mjs'],['scripts/test-native-appdir.mjs'],
  ['scripts/test-register-desktop.mjs'],['scripts/test-entrypoints.mjs'],
];
for(const args of tests) {
  // The installer promises a Node CLI and deliberately pins that exact runtime
  // into launch-installed.sh. Native/runtime tests continue to use Electron's
  // embedded Node when this aggregate is invoked with ELECTRON_RUN_AS_NODE=1.
  const executable=args[0]==='scripts/test-install-native.mjs'?nodeExecutable:process.execPath;
  const result=spawnSync(executable,args,{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
  process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');
  if(result.error || result.signal || result.status!==0 || /^\s*skip(?:ped)?\b/im.test(result.stdout??'')) {
    console.error(`FAIL or SKIP ${args.join(' ')}`);process.exit(1);
  }
}
console.log(`PASS ${tests.length} regression commands; live media, real Electron UI and clean-machine packaging remain separate gates`);
