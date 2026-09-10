import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,lstat,symlink,chmod} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {desktopEntry,registerDesktop} from './register-desktop.mjs';
import {createHash} from 'node:crypto';
for(const bad of ['relative','/home/u/a\nb','/home/u/%f','/home/u/x=y','/home/u/../x'])assert.throws(()=>desktopEntry(bad));
assert.ok(desktopEntry('/home/u/app dir').includes('Exec="/home/u/app dir/launch-installed.sh"'));
assert.ok(desktopEntry('/home/u/$x').includes('\\\\$x'));
const parent=path.join(homedir(),'zalo-native-recovery');await mkdir(parent,{recursive:true});
const fixture=await mkdtemp(path.join(parent,'desktop-fixture-'));
const installation=path.join(fixture,'installed app');
await mkdir(installation);await mkdir(path.join(fixture,'.local/share/applications'),{recursive:true});
const entries=[];
for(const [file,contents,mode] of [
  ['bootstrap.js','bootstrap',0o644],['package.json','{}',0o644],
  ['scripts/native-launch.mjs','launcher',0o644],['scripts/verify-installation.mjs','verifier',0o644],
  ['launch.json','{}',0o600],['launch-installed.sh','#!/bin/sh\nexit 99\n',0o755],
]) {
  const target=path.join(installation,file);await mkdir(path.dirname(target),{recursive:true});
  await writeFile(target,contents,{mode});await chmod(target,mode);
  entries.push({file,sha256:createHash('sha256').update(contents).digest('hex'),mode});
}
await writeFile(path.join(installation,'INSTALL-COMPLETE.json'),JSON.stringify({format:1,fileCount:entries.length,
  externalRuntime:true,generatedIntegrity:true,files:entries}));
await writeFile(path.join(installation,'bootstrap.js'),'tampered');
await assert.rejects(registerDesktop(installation,{home:fixture,check:true}),/bootstrap\.js/);
await assert.rejects(lstat(path.join(fixture,'.local/share/applications/zalo-linux-native.desktop')),{code:'ENOENT'});
await writeFile(path.join(installation,'bootstrap.js'),'bootstrap');
const target=await registerDesktop(installation,{home:fixture,check:true});
await assert.rejects(lstat(target),{code:'ENOENT'});
assert.equal(await registerDesktop(installation,{home:fixture}),target);
assert.equal(await readFile(target,'utf8'),desktopEntry(installation));
assert.equal(await registerDesktop(installation,{home:fixture,check:true}),target,'Exact existing entry passes read-only check');
await assert.rejects(registerDesktop(installation,{home:fixture}),/already exists/);
await writeFile(target,'[Desktop Entry]\nType=Application\nName=Different\n');
await assert.rejects(registerDesktop(installation,{home:fixture,check:true}),/already exists/);
await writeFile(target,desktopEntry(installation));
await symlink(installation,path.join(fixture,'alias'));
await assert.rejects(registerDesktop(path.join(fixture,'alias'),{home:fixture}),/symlinks/);
await assert.rejects(registerDesktop('/opt/elsewhere',{home:fixture}),/inside home/);
console.log('PASS desktop registration: full payload verification before write, exact existing check, mismatch/no-overwrite, quoted executable, home-only, symlink rejection, no app launch');
console.log(`Synthetic fixture retained: ${fixture}`);
