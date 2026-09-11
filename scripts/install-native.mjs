#!/usr/bin/env node
import {readFile,writeFile,mkdir,lstat,copyFile,chmod,realpath} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {validateConfig,preflight} from './native-launch.mjs';
import {applicationPayloadRoots,selectApplicationPayload} from './application-payload.mjs';
const exec=promisify(execFile);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function installPlan({source,destination,home=homedir(),config,files}) {
  const c=validateConfig(config);
  const under=(parent,child)=>{const r=path.relative(parent,child);return !!r && r!=='..' && !r.startsWith('../') && !path.isAbsolute(r);};
  for(const value of [source,home])if(typeof value!=='string' || !path.isAbsolute(value) || path.normalize(value)!==value || /[\0\r\n]/.test(value))
    throw new Error('Source and home must be canonical absolute paths');
  if(!path.isAbsolute(destination) || path.normalize(destination)!==destination || /[\0\r\n]/.test(destination) ||
    !under(home,destination) || destination===source || under(source,destination) || under(destination,source))
    throw new Error('Choose a new installation directory inside home and outside the source checkout');
  if(!Array.isArray(files) || !files.length || files.some(f=>typeof f!=='string' || !f || f.includes('\\') ||
    f.split('/').some(p=>!p || p==='.' || p==='..') || path.isAbsolute(f) || /[\0\r\n]/.test(f)))
    throw new Error('Invalid tracked payload paths');
  const selected=selectApplicationPayload(files);
  for(const required of ['bootstrap.js','package.json','scripts/native-launch.mjs','scripts/verify-installation.mjs','native/qt-call-cap-linux/zcall-agent.js'])
    if(!selected.includes(required))throw new Error('Incomplete application payload');
  if(new Set(selected).size!==selected.length)throw new Error('Duplicate payload path');
  return {source,destination,home,files:selected,config:{...c,appDir:destination}};
}
// No overwrite, profile migration, dependency download, or global desktop writes.
// Interrupted directories are retained for inspection, never recursively erased.
export async function inspectInstallation(input) {
  const plan=installPlan(input);
  const parent=await realpath(path.dirname(plan.destination));
  if(parent!==path.dirname(plan.destination))throw new Error('Installation parent must not contain symlinks');
  try {await lstat(plan.destination);throw new Error('Installation destination already exists');}
  catch(error) {if(error.code!=='ENOENT')throw error;}
  const checked=[];
  for(const file of plan.files) {
    const source=path.join(plan.source,file),resolved=await realpath(source),info=await lstat(source);
    if(resolved!==source || !info.isFile())throw new Error('Payload must contain regular files without symlink traversal');
    const sha256=createHash('sha256').update(await readFile(source)).digest('hex');
    checked.push({file,source,mode:info.mode&0o777,sha256});
  }
  return {plan,checked};
}
export async function copyInstallation(input) {
  const {plan,checked}=await inspectInstallation(input);
  await mkdir(plan.destination,{mode:0o700}); // EEXIST is intentional, including symlinks.
  try {
    for(const item of checked) {
      const target=path.join(plan.destination,item.file);
      await mkdir(path.dirname(target),{recursive:true});
      await copyFile(item.source,target,1);await chmod(target,item.mode);
      if(createHash('sha256').update(await readFile(target)).digest('hex')!==item.sha256)
        throw new Error('Payload changed during installation');
    }
    const configText=JSON.stringify(plan.config,null,2)+'\n';
    const nodePath=process.execPath;
    if(!path.isAbsolute(nodePath) || /[\0\r\n]/.test(nodePath) || !(await lstat(nodePath)).isFile())throw new Error('Node executable is unavailable');
    const quotedNode="'"+nodePath.replaceAll("'","'\\''")+"'";
    const launcherText=`#!/bin/bash\nset -euo pipefail\nZALO_INSTALLED_DIR="$(cd -- "\${BASH_SOURCE[0]%/*}" && pwd -P)"\nZALO_INSTALLED_NODE=${quotedNode}\nif [[ ! -x "$ZALO_INSTALLED_NODE" ]]; then\n    echo 'Installed Node.js runtime is unavailable; recreate this installation.' >&2\n    exit 1\nfi\n"$ZALO_INSTALLED_NODE" "$ZALO_INSTALLED_DIR/scripts/verify-installation.mjs" "$ZALO_INSTALLED_DIR" --require-generated\nexec "$ZALO_INSTALLED_NODE" "$ZALO_INSTALLED_DIR/scripts/native-launch.mjs" "$ZALO_INSTALLED_DIR/launch.json" "$@"\n`;
    await writeFile(path.join(plan.destination,'launch.json'),configText,{flag:'wx',mode:0o600});
    await writeFile(path.join(plan.destination,'launch-installed.sh'),launcherText,
      {flag:'wx',mode:0o755});
    const generated=[{file:'launch.json',sha256:createHash('sha256').update(configText).digest('hex'),mode:0o600},
      {file:'launch-installed.sh',sha256:createHash('sha256').update(launcherText).digest('hex'),mode:0o755}];
    const files=[...checked.map(({file,sha256,mode})=>({file,sha256,mode})),...generated];
    await writeFile(path.join(plan.destination,'INSTALL-COMPLETE.json'),JSON.stringify({format:1,fileCount:files.length,
      externalRuntime:true,generatedIntegrity:true,files},null,2)+'\n',{flag:'wx',mode:0o600});
  } catch(error) {throw new Error('Installation incomplete; destination retained for inspection', {cause:error});}
}
async function main() {
  const args=process.argv.slice(2),check=args.includes('--check'),pos=args.filter(a=>a!=='--check');
  if(pos.length!==2 || pos.some(a=>a.startsWith('--')) || args.filter(a=>a==='--check').length>1)
    throw new Error('Usage: node scripts/install-native.mjs CONFIG_JSON NEW_HOME_DIRECTORY [--check]');
  const config=validateConfig(JSON.parse(await readFile(pos[0],'utf8')));
  const source=await realpath(root);
  const result=await exec('git',['ls-files','-z','--',...applicationPayloadRoots],{cwd:source,maxBuffer:4*1024*1024});
  const plan=installPlan({source,destination:pos[1],config,files:result.stdout.split('\0').filter(Boolean)});
  await inspectInstallation(plan);
  await preflight({...config,appDir:source});
  if(check){console.log(`PASS install preflight: ${plan.files.length} tracked files; no files changed`);return;}
  await copyInstallation(plan);
  console.log('Native development installation copied. Launch with launch-installed.sh inside the new directory.');
  console.log('Runtime and Electron remain external; this is not a self-contained release.');
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
