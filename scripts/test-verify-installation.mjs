import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,chmod,symlink} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {verifyInstallation} from './verify-installation.mjs';
const parent=path.join(homedir(),'zalo-native-recovery');await mkdir(parent,{recursive:true});
const fixture=await mkdtemp(path.join(parent,'verify-install-fixture-'));
const entries=[];
for(const [file,contents,mode] of [
  ['bootstrap.js','bootstrap',0o644],['package.json','{}',0o644],
  ['scripts/native-launch.mjs','launcher',0o644],['scripts/verify-installation.mjs','verifier',0o644],
  ['launch.json','{}',0o600],['launch-installed.sh','#!/bin/sh',0o755],
]) {
  const target=path.join(fixture,file);await mkdir(path.dirname(target),{recursive:true});
  await writeFile(target,contents,{mode});await chmod(target,mode);
  entries.push({file,sha256:createHash('sha256').update(contents).digest('hex'),mode});
}
const manifest={format:1,fileCount:entries.length,externalRuntime:true,generatedIntegrity:true,files:entries};
await writeFile(path.join(fixture,'INSTALL-COMPLETE.json'),JSON.stringify(manifest),{mode:0o600});
assert.deepEqual(await verifyInstallation(fixture,{requireGenerated:true}),{fileCount:entries.length,generatedIntegrity:true});
for(const mutate of [
  value=>({...value,fileCount:value.fileCount+1}),
  value=>({...value,files:[...value.files,value.files[0]]}),
  value=>({...value,files:value.files.map((entry,index)=>index?entry:{...entry,file:'../escape'})}),
  value=>({...value,files:value.files.map((entry,index)=>index?entry:{...entry,mode:0o1000})}),
]) {
  await writeFile(path.join(fixture,'INSTALL-COMPLETE.json'),JSON.stringify(mutate(manifest)));
  await assert.rejects(verifyInstallation(fixture,{requireGenerated:true}),/manifest/);
}
await writeFile(path.join(fixture,'INSTALL-COMPLETE.json'),JSON.stringify(manifest));
await chmod(path.join(fixture,'bootstrap.js'),0o600);
await assert.rejects(verifyInstallation(fixture,{requireGenerated:true}),/bootstrap\.js/);
await chmod(path.join(fixture,'bootstrap.js'),0o644);
await writeFile(path.join(fixture,'bootstrap.js'),'changed');
await assert.rejects(verifyInstallation(fixture,{requireGenerated:true}),/bootstrap\.js/);
await writeFile(path.join(fixture,'bootstrap.js'),'bootstrap');
await symlink(path.join(fixture,'bootstrap.js'),path.join(fixture,'linked.js'));
const linked={...manifest,fileCount:manifest.fileCount+1,files:[...manifest.files,{file:'linked.js',sha256:manifest.files[0].sha256,mode:0o777}]};
await writeFile(path.join(fixture,'INSTALL-COMPLETE.json'),JSON.stringify(linked));
await assert.rejects(verifyInstallation(fixture),/linked\.js/);
console.log('PASS installation verifier: complete generated manifest, streamed hashes/modes, malformed/duplicate/traversal/tamper/symlink rejection');
console.log(`Synthetic fixture retained: ${fixture}`);
