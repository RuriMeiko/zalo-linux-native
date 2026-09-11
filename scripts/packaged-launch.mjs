#!/usr/bin/env node
import {readFile,realpath,lstat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateConfig,runNativeLaunch} from './native-launch.mjs';
import {verifyNativeAppDir} from './verify-native-appdir.mjs';
const exec=promisify(execFile);

export function packagedConfig(packageRoot,saved) {
  if(typeof packageRoot!=='string' || !path.isAbsolute(packageRoot) || path.normalize(packageRoot)!==packageRoot || /[\0\r\n]/.test(packageRoot))
    throw new Error('Package root must be a canonical absolute path');
  if(!saved || typeof saved!=='object' || Array.isArray(saved))throw new Error('Invalid packaged launch configuration');
  return validateConfig({...saved,
    appDir:path.join(packageRoot,'app'),
    electron:path.join(packageRoot,'electron','electron'),
    runtime:path.join(packageRoot,'runtime')});
}

async function main() {
  const args=process.argv.slice(2),check=args.includes('--check'),filtered=args.filter(arg=>arg!=='--check');
  if((filtered.length!==1 && filtered.length!==3) || (filtered.length===3 && filtered[1]!=='--config') ||
    args.filter(arg=>arg==='--check').length>1)
    throw new Error('Usage: packaged-launch.mjs ABSOLUTE_PACKAGE_ROOT [--config ABSOLUTE_JSON] [--check]');
  const packageRoot=await realpath(filtered[0]);
  if(packageRoot!==filtered[0])throw new Error('Package root must not traverse symlinks');
  const configPath=filtered.length===3?filtered[2]:
    path.join(process.env.XDG_CONFIG_HOME || path.join(homedir(),'.config'),'zalo-native-linux','launch.json');
  if(!path.isAbsolute(configPath) || path.normalize(configPath)!==configPath || /[\0\r\n]/.test(configPath))
    throw new Error('Packaged configuration path must be canonical and absolute');
  await verifyNativeAppDir(packageRoot);
  const ffmpeg=path.join(packageRoot,'tools','ffmpeg'),ffmpegInfo=await lstat(ffmpeg);
  if(!ffmpegInfo.isFile() || !(ffmpegInfo.mode&0o111))throw new Error('Packaged FFmpeg is unavailable');
  await exec(ffmpeg,['-version'],{timeout:5000,maxBuffer:1024*1024});
  process.env.ZALO_FFMPEG=ffmpeg;
  const saved=JSON.parse(await readFile(configPath,'utf8'));
  await runNativeLaunch(packagedConfig(packageRoot,saved),{check});
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(error=>{console.error(`Packaged launch failed: ${error.message}`);process.exitCode=1;});
