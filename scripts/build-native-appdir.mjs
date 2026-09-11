#!/usr/bin/env node
import {createReadStream} from 'node:fs';
import {readFile,writeFile,mkdir,lstat,readdir,realpath,copyFile,chmod} from 'node:fs/promises';
import {constants as fsConstants} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {applicationPayloadRoots,selectApplicationPayload} from './application-payload.mjs';
import {verifyNativeAppDir} from './verify-native-appdir.mjs';

const exec=promisify(execFile),sourceRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const zrtcHash='c7e5f005fd5c12dc64d72008a1871638246899a9cf6b034dc13981c014caeefe';
const requiredRuntimeDirectories=[
  ['bionic','runtime/bionic'],
  ['apk/lib/x86_64','runtime/apk/lib/x86_64'],
  ['results/platform','runtime/results/platform'],
];
const requiredRuntimeFiles=[
  ['results/zrtc-worker','runtime/results/zrtc-worker'],
  ['results/pcm-host','runtime/results/pcm-host'],
];
const requiredAppFiles=['bootstrap.js','package.json','scripts/native-launch.mjs','scripts/packaged-launch.mjs',
  'scripts/verify-native-appdir.mjs','native/qt-call-cap-linux/zcall-agent.js'];

const canonicalAbsolute=value=>typeof value==='string' && path.isAbsolute(value) && path.normalize(value)===value && !/[\0\r\n]/.test(value);
const validRelative=value=>typeof value==='string' && value && !value.includes('\\') && !path.isAbsolute(value) &&
  !/[\0\r\n]/.test(value) && value.split('/').every(part=>part && part!=='.' && part!=='..');
const under=(parent,child)=>{const relative=path.relative(parent,child);return !!relative && relative!=='..' && !relative.startsWith('../') && !path.isAbsolute(relative);};
async function hashFile(file) {
  const hash=createHash('sha256');
  for await(const chunk of createReadStream(file))hash.update(chunk);
  return hash.digest('hex');
}
function hashText(text){return createHash('sha256').update(text).digest('hex');}

export function validateBuildConfig(config) {
  if(!config || typeof config!=='object' || Array.isArray(config) ||
    Object.keys(config).sort().join(',')!=='electronDir,ffmpeg,runtimeDir')throw new Error('Invalid native package build configuration');
  for(const key of ['electronDir','runtimeDir','ffmpeg'])if(!canonicalAbsolute(config[key]))throw new Error(`Expected canonical absolute path: ${key}`);
  return {...config};
}

async function walkRegularFiles(directory,prefix) {
  const files=[];
  async function visit(current,relative='') {
    for(const entry of await readdir(current,{withFileTypes:true})) {
      const child=path.join(current,entry.name),childRelative=relative?path.join(relative,entry.name):entry.name;
      if(entry.isDirectory())await visit(child,childRelative);
      else if(entry.isFile())files.push({source:child,file:path.join(prefix,childRelative)});
      else if(entry.isSymbolicLink()) {
        const resolved=await realpath(child),info=await lstat(resolved);
        if(!under(directory,resolved) || !info.isFile())throw new Error(`Package input symlink leaves its component: ${path.join(prefix,childRelative)}`);
        files.push({source:resolved,file:path.join(prefix,childRelative)});
      }
      else throw new Error(`Package input contains unsupported entry: ${path.join(prefix,childRelative)}`);
    }
  }
  await visit(directory);return files;
}

async function inspectCopyItem(item) {
  if(!validRelative(item.file))throw new Error('Invalid native package payload path');
  const info=await lstat(item.source),resolved=await realpath(item.source);
  if(!info.isFile() || resolved!==item.source)throw new Error(`Package input must be a canonical regular file: ${item.file}`);
  const mode=item.mode ?? (info.mode&0o777);
  if(!Number.isInteger(mode) || mode<0 || mode>0o777)throw new Error('Invalid native package file mode');
  return {...item,mode,size:info.size,sha256:await hashFile(item.source)};
}

export async function inspectNativeAppDir({config,destination,home=homedir(),source=sourceRoot,trackedFiles}) {
  const c=validateBuildConfig(config);
  if(!canonicalAbsolute(source) || await realpath(source)!==source)throw new Error('Source checkout must be canonical');
  if(!canonicalAbsolute(home) || !canonicalAbsolute(destination) || !under(home,destination) || destination===source ||
    under(source,destination) || under(destination,source))throw new Error('Choose a new package directory inside home and outside the source checkout');
  const parent=path.dirname(destination);
  if(await realpath(parent)!==parent)throw new Error('Package parent must not contain symlinks');
  try {await lstat(destination);throw new Error('Package destination already exists');}
  catch(error) {if(error.code!=='ENOENT')throw error;}

  const electronDir=await realpath(c.electronDir);
  if(electronDir!==c.electronDir || !(await lstat(electronDir)).isDirectory())throw new Error('Electron directory must be canonical');
  const electronVersion=(await readFile(path.join(electronDir,'version'),'utf8')).trim();
  if(electronVersion!=='22.3.27')throw new Error('Only the pinned Electron 22.3.27 runtime is supported');
  for(const required of ['electron','LICENSE','LICENSES.chromium.html'])if(!(await lstat(path.join(electronDir,required))).isFile())
    throw new Error(`Incomplete Electron runtime: ${required}`);

  const runtimeDir=await realpath(c.runtimeDir);
  if(runtimeDir!==c.runtimeDir || !(await lstat(runtimeDir)).isDirectory())throw new Error('Native runtime directory must be canonical');
  const ffmpeg=await realpath(c.ffmpeg),ffmpegInfo=await lstat(ffmpeg);
  if(!ffmpegInfo.isFile() || !(ffmpegInfo.mode&0o111))throw new Error('FFmpeg must resolve to an executable regular file');

  let listed=trackedFiles;
  if(listed===undefined) {
    const result=await exec('git',['ls-files','-z','--',...applicationPayloadRoots],{cwd:source,maxBuffer:8*1024*1024});
    listed=result.stdout.split('\0').filter(Boolean);
  }
  if(!Array.isArray(listed) || listed.some(file=>!validRelative(file)))throw new Error('Invalid tracked application payload');
  const selected=selectApplicationPayload(listed);
  for(const required of requiredAppFiles)if(!selected.includes(required))throw new Error(`Incomplete application payload: ${required}`);

  const items=[];
  for(const file of selected)items.push({source:path.join(source,file),file:path.join('app',file)});
  items.push(...await walkRegularFiles(electronDir,'electron'));
  for(const [relative,prefix] of requiredRuntimeDirectories) {
    const directory=await realpath(path.join(runtimeDir,relative));
    if(!(await lstat(directory)).isDirectory())throw new Error(`Incomplete native runtime: ${relative}`);
    items.push(...await walkRegularFiles(directory,prefix));
  }
  for(const [relative,file] of requiredRuntimeFiles) {
    const sourceFile=await realpath(path.join(runtimeDir,relative));
    if(!(await lstat(sourceFile)).isFile())throw new Error(`Incomplete native runtime: ${relative}`);
    items.push({source:sourceFile,file,mode:0o755});
  }
  items.push({source:ffmpeg,file:'tools/ffmpeg',mode:0o755});
  items.push({source:path.join(source,'pc-dist/favicon-96x96.v1.png'),file:'zalo-linux-native.png',mode:0o644});

  const duplicates=new Set(),seen=new Set();
  for(const item of items){if(seen.has(item.file))duplicates.add(item.file);seen.add(item.file);}
  if(duplicates.size)throw new Error('Duplicate native package path');
  const checked=[];
  for(const item of items)checked.push(await inspectCopyItem(item));
  const zrtc=checked.find(item=>item.file==='runtime/apk/lib/x86_64/libzrtc.so');
  if(!zrtc || zrtc.sha256!==zrtcHash)throw new Error('Unsupported native ZRTC library hash');
  for(const required of ['electron/electron','runtime/bionic/linker64','runtime/results/zrtc-worker','runtime/results/pcm-host','tools/ffmpeg']) {
    const item=checked.find(candidate=>candidate.file===required);
    if(!item || !(item.mode&0o111))throw new Error(`Packaged executable is unavailable: ${required}`);
  }

  const appRun='#!/bin/bash\nset -euo pipefail\nZALO_PACKAGE_ROOT="$(cd -- "${BASH_SOURCE[0]%/*}" && pwd -P)"\nexport ELECTRON_RUN_AS_NODE=1\nexec "$ZALO_PACKAGE_ROOT/electron/electron" "$ZALO_PACKAGE_ROOT/app/scripts/packaged-launch.mjs" "$ZALO_PACKAGE_ROOT" "$@"\n';
  const desktop='[Desktop Entry]\nName=Zalo Linux Native\nComment=Unofficial native Linux development port of Zalo\nExec=AppRun\nIcon=zalo-linux-native\nTerminal=false\nType=Application\nCategories=Network;InstantMessaging;\nStartupWMClass=Zalo\n';
  const generated=[
    {file:'AppRun',contents:appRun,mode:0o755,size:Buffer.byteLength(appRun),sha256:hashText(appRun)},
    {file:'zalo-linux-native.desktop',contents:desktop,mode:0o644,size:Buffer.byteLength(desktop),sha256:hashText(desktop)},
  ];
  return {source,destination,config:c,electronVersion,checked,generated};
}

export async function buildNativeAppDir(input) {
  const plan=await inspectNativeAppDir(input);
  await mkdir(plan.destination,{mode:0o755});
  try {
    for(const item of plan.checked) {
      const target=path.join(plan.destination,item.file);
      await mkdir(path.dirname(target),{recursive:true,mode:0o755});
      await copyFile(item.source,target,fsConstants.COPYFILE_EXCL);await chmod(target,item.mode);
      const info=await lstat(target);
      if(info.size!==item.size || await hashFile(target)!==item.sha256)throw new Error(`Package copy changed: ${item.file}`);
    }
    for(const item of plan.generated) {
      const target=path.join(plan.destination,item.file);
      await writeFile(target,item.contents,{flag:'wx',mode:item.mode});
    }
    const files=[...plan.checked,...plan.generated].map(({file,mode,size,sha256})=>({file,mode,size,sha256})).sort((a,b)=>a.file.localeCompare(b.file));
    const marker={format:1,architecture:'x86_64',electronVersion:plan.electronVersion,bundledElectron:true,
      bundledNativeRuntime:true,bundledFfmpeg:true,fileCount:files.length,files};
    await writeFile(path.join(plan.destination,'PACKAGE-COMPLETE.json'),JSON.stringify(marker,null,2)+'\n',{flag:'wx',mode:0o644});
    await verifyNativeAppDir(plan.destination);
    return {fileCount:files.length,electronVersion:plan.electronVersion};
  } catch(error) {throw new Error('Native package build incomplete; destination retained for inspection',{cause:error});}
}

async function main() {
  const args=process.argv.slice(2),check=args.includes('--check'),pos=args.filter(arg=>arg!=='--check');
  if(pos.length!==2 || pos.some(arg=>arg.startsWith('--')) || args.filter(arg=>arg==='--check').length>1)
    throw new Error('Usage: node scripts/build-native-appdir.mjs BUILD_CONFIG_JSON NEW_HOME_APPDIR [--check]');
  const config=validateBuildConfig(JSON.parse(await readFile(pos[0],'utf8')));
  const input={config,destination:pos[1]};
  if(check) {
    const plan=await inspectNativeAppDir(input);
    console.log(`PASS native AppDir preflight: ${plan.checked.length+plan.generated.length} files; Electron ${plan.electronVersion}; no files changed`);
    return;
  }
  const result=await buildNativeAppDir(input);
  console.log(`PASS native AppDir build: ${result.fileCount} files; Electron ${result.electronVersion}`);
  console.log('Local validation only: redistribution and clean-machine release gates remain open.');
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(error=>{console.error(error.cause?.message || error.message);process.exitCode=1;});
