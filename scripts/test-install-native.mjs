import assert from 'node:assert/strict';
import {installPlan,copyInstallation,inspectInstallation} from './install-native.mjs';
import {mkdir,mkdtemp,writeFile,readFile,stat,symlink,lstat} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {verifyInstallation} from './verify-installation.mjs';
const source='/home/test/source',destination='/home/test/installed',home='/home/test';
const config={appDir:source,electron:'/opt/electron/electron',runtime:'/home/test/runtime',source:'mic',sink:'speaker'};
const files=['bootstrap.js','package.json','scripts/native-launch.mjs','scripts/verify-installation.mjs','native/qt-call-cap-linux/zcall-agent.js',
  'CREDITS.md','reverse-engineering/account-capture.json','.git/config','launch.json'];
const args={source,destination,home,config,files};
const p=installPlan(args);
assert.equal(p.config.appDir,destination);assert.equal(config.appDir,source);
assert.ok(p.files.includes('CREDITS.md'));
for(const excluded of ['reverse-engineering/account-capture.json','.git/config','launch.json'])assert.ok(!p.files.includes(excluded));
for(const bad of [home,source,source+'/nested','/tmp/install','relative','/home/test/../test/installed'])
  assert.throws(()=>installPlan({...args,destination:bad}));
for(const file of ['../escape','/absolute','native/../secret','pc-dist//image','native\\secret'])
  assert.throws(()=>installPlan({...args,files:[...files,file]}));
assert.throws(()=>installPlan({...args,files:['package.json']}),/Incomplete/);
assert.throws(()=>installPlan({...args,files:[...files,'package.json']}),/Duplicate/);
assert.throws(()=>installPlan({...args,source:'relative'}),/absolute/);
const fixtureParent=path.join(homedir(),'zalo-native-recovery');await mkdir(fixtureParent,{recursive:true});
const fixture=await mkdtemp(path.join(fixtureParent,'install-fixture-'));
const fixtureSource=path.join(fixture,'source'),fixtureDestination=path.join(fixture,'installed app');
const selected=files.filter(f=>p.files.includes(f));
for(const file of selected) {
  const target=path.join(fixtureSource,file);await mkdir(path.dirname(target),{recursive:true});
  const contents=file==='scripts/verify-installation.mjs'?await readFile(new URL('./verify-installation.mjs',import.meta.url)):
    file==='scripts/native-launch.mjs'?'// synthetic launcher target\n':`fixture only: ${file}\n`;
  await writeFile(target,contents,{mode:0o644,flag:'wx'});
}
const plan=installPlan({...args,source:fixtureSource,destination:fixtureDestination,home:homedir(),files:selected});
await inspectInstallation(plan);
await assert.rejects(lstat(fixtureDestination),{code:'ENOENT'});
await copyInstallation(plan);
const marker=JSON.parse(await readFile(path.join(fixtureDestination,'INSTALL-COMPLETE.json'),'utf8'));
assert.equal(marker.fileCount,selected.length+2);assert.equal(marker.externalRuntime,true);assert.equal(marker.generatedIntegrity,true);
for(const item of marker.files) {
  const contents=await readFile(path.join(fixtureDestination,item.file));
  assert.equal(createHash('sha256').update(contents).digest('hex'),item.sha256);
  if(selected.includes(item.file))assert.deepEqual(contents,await readFile(path.join(fixtureSource,item.file)));
}
assert.equal((await stat(path.join(fixtureDestination,'launch.json'))).mode&0o777,0o600);
assert.equal((await stat(path.join(fixtureDestination,'launch-installed.sh'))).mode&0o777,0o755);
const installedConfig=JSON.parse(await readFile(path.join(fixtureDestination,'launch.json'),'utf8'));
assert.equal(installedConfig.appDir,fixtureDestination);assert.equal(installedConfig.runtime,config.runtime);
assert.ok(!Object.hasOwn(installedConfig,'cdpPort'),'Installer must not enable diagnostics implicitly');
assert.deepEqual(await verifyInstallation(fixtureDestination,{requireGenerated:true}),
  {fileCount:selected.length+2,generatedIntegrity:true});
assert.match(await readFile(path.join(fixtureDestination,'launch-installed.sh'),'utf8'),/verify-installation\.mjs.*--require-generated/);
const installedLauncher=await readFile(path.join(fixtureDestination,'launch-installed.sh'),'utf8');
assert.ok(installedLauncher.includes(`ZALO_INSTALLED_NODE='${process.execPath}'`));
assert.ok(!/(^|\s)node\s/.test(installedLauncher),'Installed launcher must not depend on PATH lookup for Node');
assert.ok(!/\bdirname\b/.test(installedLauncher),'Installed launcher must not depend on dirname from PATH');
const withoutPath=spawnSync('/bin/bash',[path.join(fixtureDestination,'launch-installed.sh')],{
  cwd:'/',env:{PATH:'/nonexistent'},encoding:'utf8',timeout:5000});
assert.equal(withoutPath.status,0,withoutPath.stderr);assert.match(withoutPath.stdout,/PASS installed payload integrity/);
await assert.rejects(copyInstallation(plan),/already exists/);
await symlink(path.join(fixtureSource,'bootstrap.js'),path.join(fixtureSource,'native','linked.js'));
const unsafe={...plan,destination:path.join(fixture,'rejected'),files:[...selected,'native/linked.js']};
await assert.rejects(inspectInstallation(unsafe),/symlink/);
await assert.rejects(copyInstallation(unsafe),/symlink/);
await assert.rejects(lstat(unsafe.destination),{code:'ENOENT'});
await symlink(fixture,path.join(fixture,'alias'));
await assert.rejects(copyInstallation({...plan,destination:path.join(fixture,'alias','rejected')}),/symlinks/);
await assert.rejects(copyInstallation({...plan,files:[...selected,'../escape']}),/payload paths/);
await writeFile(path.join(fixtureDestination,'launch.json'),'tampered\n');
await assert.rejects(verifyInstallation(fixtureDestination,{requireGenerated:true}),/launch\.json/);
await assert.rejects(verifyInstallation('relative'),/absolute/);
console.log('PASS installer: home-only plan, read-only preflight, real copy/hash manifest, private config, executable launcher, existing/symlink/traversal rejection');
console.log(`Synthetic fixture retained: ${fixture}`);
