import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,chmod,symlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {homedir} from 'node:os';
import path from 'node:path';
import {verifyNativeAppDir} from './verify-native-appdir.mjs';

const parent=path.join(homedir(),'zalo-native-recovery');await mkdir(parent,{recursive:true});
const fixture=await mkdtemp(path.join(parent,'native-appdir-fixture-'));
const definitions=[
  ['AppRun','launcher',0o755],['zalo-linux-native.desktop','desktop',0o644],['zalo-linux-native.png','png',0o644],
  ['electron/electron','electron',0o755],['electron/LICENSE','license',0o644],
  ['electron/resources/default_app.asar','synthetic asar container',0o644],
  ['runtime/bionic/linker64','linker',0o755],['runtime/apk/lib/x86_64/libzrtc.so','zrtc',0o644],
  ['runtime/results/zrtc-worker','worker',0o755],['runtime/results/pcm-host','pcm',0o755],
  ['tools/ffmpeg','ffmpeg',0o755],['app/bootstrap.js','bootstrap',0o644],['app/package.json','{}',0o644],
  ['app/scripts/packaged-launch.mjs','packaged',0o644],['app/scripts/native-launch.mjs','native',0o644],
];
const files=[];
for(const [file,contents,mode] of definitions) {
  const target=path.join(fixture,file);await mkdir(path.dirname(target),{recursive:true});
  await writeFile(target,contents,{flag:'wx',mode});await chmod(target,mode);
  files.push({file,mode,size:Buffer.byteLength(contents),sha256:createHash('sha256').update(contents).digest('hex')});
}
const marker={format:1,architecture:'x86_64',electronVersion:'22.3.27',bundledElectron:true,
  bundledNativeRuntime:true,bundledFfmpeg:true,fileCount:files.length,files};
await writeFile(path.join(fixture,'PACKAGE-COMPLETE.json'),JSON.stringify(marker,null,2)+'\n',{flag:'wx',mode:0o644});
assert.deepEqual(await verifyNativeAppDir(fixture),{fileCount:files.length,electronVersion:'22.3.27'});
await chmod(path.join(fixture,'AppRun'),0o644);
await assert.rejects(verifyNativeAppDir(fixture),/AppRun/);
await chmod(path.join(fixture,'AppRun'),0o755);
await writeFile(path.join(fixture,'tools/ffmpeg'),'tampered');
await assert.rejects(verifyNativeAppDir(fixture),/tools\/ffmpeg/);
await assert.rejects(verifyNativeAppDir('relative'),/canonical/);
await symlink(fixture,path.join(parent,path.basename(fixture)+'-alias'));
await assert.rejects(verifyNativeAppDir(path.join(parent,path.basename(fixture)+'-alias')),/symlinks/);
console.log('PASS native AppDir verifier: Electron-as-Node asar container, required manifest, hash/mode/path/symlink rejection');
console.log(`Synthetic fixture retained: ${fixture}`);
