#!/usr/bin/env node
import {createReadStream} from 'node:fs';
import {readFile,lstat,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const validRelative=file=>typeof file==='string' && file && !file.includes('\\') && !path.isAbsolute(file) &&
  !/[\0\r\n]/.test(file) && file.split('/').every(part=>part && part!=='.' && part!=='..');
async function hashFile(file) {
  const hash=createHash('sha256');
  for await(const chunk of createReadStream(file))hash.update(chunk);
  return hash.digest('hex');
}
export async function verifyInstallation(installation,{requireGenerated=false}={}) {
  if(typeof requireGenerated!=='boolean')throw new TypeError('requireGenerated must be boolean');
  if(typeof installation!=='string' || !path.isAbsolute(installation) || path.normalize(installation)!==installation || /[\0\r\n]/.test(installation))
    throw new Error('Installation path must be canonical and absolute');
  if(await realpath(installation)!==installation)throw new Error('Installation must not traverse symlinks');
  const markerPath=path.join(installation,'INSTALL-COMPLETE.json'),markerInfo=await lstat(markerPath);
  if(!markerInfo.isFile() || markerInfo.size<2 || markerInfo.size>32*1024*1024 || await realpath(markerPath)!==markerPath)
    throw new Error('Invalid installation marker');
  let marker;try {marker=JSON.parse(await readFile(markerPath,'utf8'));}catch {throw new Error('Invalid installation marker');}
  if(marker?.format!==1 || marker.externalRuntime!==true || !Array.isArray(marker.files) ||
    !Number.isInteger(marker.fileCount) || marker.fileCount!==marker.files.length || marker.fileCount<1)
    throw new Error('Invalid installation manifest');
  const seen=new Set();
  for(const entry of marker.files) {
    if(!entry || typeof entry!=='object' || Array.isArray(entry) || Object.keys(entry).sort().join(',')!=='file,mode,sha256' ||
      !validRelative(entry.file) || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isInteger(entry.mode) || entry.mode<0 || entry.mode>0o777 ||
      seen.has(entry.file))throw new Error('Invalid installation manifest entry');
    seen.add(entry.file);
  }
  for(const required of ['bootstrap.js','package.json','scripts/native-launch.mjs','scripts/verify-installation.mjs'])
    if(!seen.has(required))throw new Error('Incomplete installation manifest');
  if(requireGenerated && (!marker.generatedIntegrity || !seen.has('launch.json') || !seen.has('launch-installed.sh')))
    throw new Error('Installation lacks generated-file integrity metadata; reinstall into a new directory');
  for(const entry of marker.files) {
    const target=path.join(installation,entry.file),info=await lstat(target);
    if(!info.isFile() || await realpath(target)!==target || (info.mode&0o777)!==entry.mode || await hashFile(target)!==entry.sha256)
      throw new Error(`Installation integrity check failed: ${entry.file}`);
  }
  return {fileCount:marker.fileCount,generatedIntegrity:marker.generatedIntegrity===true};
}
async function main() {
  const args=process.argv.slice(2),requireGenerated=args.includes('--require-generated'),pos=args.filter(arg=>arg!=='--require-generated');
  if(pos.length!==1 || pos[0].startsWith('--') || args.length>(requireGenerated?2:1))
    throw new Error('Usage: node scripts/verify-installation.mjs ABSOLUTE_INSTALLATION [--require-generated]');
  const result=await verifyInstallation(pos[0],{requireGenerated});
  console.log(`PASS installed payload integrity: ${result.fileCount} files`);
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
