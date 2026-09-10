#!/usr/bin/env node
// Account-free module/control checks; no GUI, microphone or camera capture.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const tests=[
  ['scripts/test-call-control.mjs'],
  ...['file-utils','file-utilities','zfile','zwalker','v8-profiles','mp4thumb','zjxl','zcall','zimage']
    .map(name=>[`native/nativelibs/${name}/test-linux.js`]),
  ['native/nativelibs/zimage/test-vips-temp.cjs'],['native/nativelibs/zimage/test-encode-extra.cjs'],
  ['scripts/test-linux-header.cjs'],['scripts/test-linux-header.cjs','--shared'],
  ['scripts/test-viewer-extras.cjs'],['scripts/test-signaling-log-privacy.cjs'],
  ['scripts/test-install-native.mjs'],['scripts/test-register-desktop.mjs'],['scripts/test-entrypoints.mjs'],
];
for(const args of tests) {
  const result=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
  process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');
  if(result.error || result.signal || result.status!==0 || /^\s*skip(?:ped)?\b/im.test(result.stdout??'')) {
    console.error(`FAIL or SKIP ${args.join(' ')}`);process.exit(1);
  }
}
console.log(`PASS ${tests.length} regression commands; live media, real Electron UI and clean-machine packaging remain separate gates`);
