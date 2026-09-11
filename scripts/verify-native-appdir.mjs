#!/usr/bin/env node
import {createReadStream} from 'node:fs';
import {readFile,lstat,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Electron patches fs to treat *.asar paths as virtual directories. This
// verifier hashes the archive container itself, so disable that behavior only
// in its Electron-as-Node process. The spawned application is a new process.
if(process.versions.electron)process.noAsar=true;

const validRelative=file=>typeof file==='string' && file && !file.includes('\\') && !path.isAbsolute(file) &&
  !/[\0\r\n]/.test(file) && file.split('/').every(part=>part && part!=='.' && part!=='..');
async function hashFile(file) {
  const hash=createHash('sha256');
  for await(const chunk of createReadStream(file))hash.update(chunk);
  return hash.digest('hex');
}

export async function verifyNativeAppDir(packageRoot) {
  if(typeof packageRoot!=='string' || !path.isAbsolute(packageRoot) || path.normalize(packageRoot)!==packageRoot || /[\0\r\n]/.test(packageRoot))
    throw new Error('Package path must be canonical and absolute');
  if(await realpath(packageRoot)!==packageRoot)throw new Error('Package path must not traverse symlinks');
  const markerPath=path.join(packageRoot,'PACKAGE-COMPLETE.json'),markerInfo=await lstat(markerPath);
  if(!markerInfo.isFile() || markerInfo.size<2 || markerInfo.size>32*1024*1024 || await realpath(markerPath)!==markerPath)
    throw new Error('Invalid native package marker');
  let marker;try {marker=JSON.parse(await readFile(markerPath,'utf8'));}catch {throw new Error('Invalid native package marker');}
  if(marker?.format!==1 || marker.architecture!=='x86_64' || marker.electronVersion!=='22.3.27' ||
    marker.bundledElectron!==true || marker.bundledNativeRuntime!==true || marker.bundledFfmpeg!==true ||
    !Array.isArray(marker.files) || !Number.isInteger(marker.fileCount) || marker.fileCount!==marker.files.length || marker.fileCount<1)
    throw new Error('Invalid native package manifest');
  const seen=new Set();
  for(const entry of marker.files) {
    if(!entry || typeof entry!=='object' || Array.isArray(entry) || Object.keys(entry).sort().join(',')!=='file,mode,sha256,size' ||
      !validRelative(entry.file) || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.size) || entry.size<0 ||
      !Number.isInteger(entry.mode) || entry.mode<0 || entry.mode>0o777 || seen.has(entry.file))
      throw new Error('Invalid native package manifest entry');
    seen.add(entry.file);
  }
  for(const required of ['AppRun','zalo-linux-native.desktop','zalo-linux-native.png','electron/electron','electron/LICENSE',
    'runtime/bionic/linker64','runtime/apk/lib/x86_64/libzrtc.so','runtime/results/zrtc-worker','runtime/results/pcm-host',
    'tools/ffmpeg','app/bootstrap.js','app/package.json','app/scripts/packaged-launch.mjs','app/scripts/native-launch.mjs'])
    if(!seen.has(required))throw new Error('Incomplete native package manifest');
  for(const entry of marker.files) {
    const target=path.join(packageRoot,entry.file),info=await lstat(target);
    if(!info.isFile() || await realpath(target)!==target || info.size!==entry.size || (info.mode&0o777)!==entry.mode ||
      await hashFile(target)!==entry.sha256)throw new Error(`Native package integrity check failed: ${entry.file}`);
  }
  return {fileCount:marker.fileCount,electronVersion:marker.electronVersion};
}

async function main() {
  if(process.argv.length!==3)throw new Error('Usage: node scripts/verify-native-appdir.mjs ABSOLUTE_APPDIR');
  const result=await verifyNativeAppDir(process.argv[2]);
  console.log(`PASS native AppDir integrity: ${result.fileCount} files; Electron ${result.electronVersion}`);
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
