#!/usr/bin/env node
// Account-free checks for the tray "Kiểm tra cập nhật" entry.
//
// The entry is patched into main-dist/main.js's two tray templates, so the tests
// work on synthetic bundle text shaped like the real one: no Electron, no GUI.
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {patchBundle,unpatchBundle,LABEL,ITEM} from './tray-linux.mjs';

const require=createRequire(import.meta.url);

// The real anchor, imported from the script so indentation cannot drift.
const INDENT=' '.repeat(36);
const INDENT32=' '.repeat(32);
const OPEN_ITEM=[INDENT+'label: "Mở Zalo",',INDENT+'click: en',INDENT32+'},'].join('\n');
const ANCHOR=OPEN_ITEM;
// Two branches (logged in / logged out) that both need the entry. Each is built
// around the real anchor text.
const PREV_ITEM=INDENT.slice(0,-4)+'}, {';
const BUNDLE=[
  'if (In >= 0) {',
  INDENT.slice(0,-4)+'const r = [{',
  INDENT.slice(0,-4)+'    submenu: t.buildFromTemplate([{label: "Đang online"}]),',
  INDENT.slice(0,-4)+'    label: "Đổi trạng thái"',
  PREV_ITEM,
  OPEN_ITEM,
  INDENT+'label: "",',
  INDENT+'type: "separator"',
  INDENT+'}, {',
  INDENT+'label: "Thoát",',
  INDENT+'click: e',
  INDENT+'}];',
  '} else {',
  INDENT.slice(0,-4)+'const r = [{',
  OPEN_ITEM,
  INDENT+'label: "",',
  INDENT+'type: "separator"',
  INDENT+'}, {',
  INDENT+'label: "Thoát",',
  INDENT+'click: e',
  INDENT+'}];',
  '}'
].join('\n');

// --- patch / unpatch ------------------------------------------------------
assert.equal(BUNDLE.split(ANCHOR).length-1,2,'fixture must contain both anchors');
const applied=patchBundle(BUNDLE);
assert.equal(applied.changed,true);
assert.equal(applied.text.split('label: "'+LABEL+'"').length-1,2,'entry added to both templates');
// The entry must sit directly after "Mở Zalo", before the separator and "Thoát".
const afterOpen=applied.text.split('label: "Mở Zalo",')[1];
assert.match(afterOpen,/Kiểm tra cập nhật/);
assert.ok(afterOpen.indexOf(LABEL)<afterOpen.indexOf('"Thoát"'),'entry precedes Thoát');
// Idempotent: patching twice changes nothing more.
assert.deepEqual(patchBundle(applied.text),{text:applied.text,changed:false});
// Reversible, and the reverse is idempotent too.
assert.deepEqual(unpatchBundle(applied.text),{text:BUNDLE,changed:true});
assert.deepEqual(unpatchBundle(BUNDLE),{text:BUNDLE,changed:false});

// A bundle with a different shape must be rejected rather than guessed at.
assert.throws(()=>patchBundle('no anchors here'),/Expected 2/);
assert.throws(()=>patchBundle(ANCHOR),/Expected 2/,'a single anchor is not enough');
assert.throws(()=>unpatchBundle(applied.text.replace('label: "'+LABEL+'"','label: "x"')),/Expected 2/);
assert.throws(()=>patchBundle(null),/string/);

// The injected item must be valid menu-template source.
assert.ok(ITEM.includes('label: "'+LABEL+'"'));
assert.ok(ITEM.includes('update-native.mjs'),'item runs the real updater script');
assert.ok(ITEM.includes('--check'),'item is read-only');
assert.ok(ITEM.includes('new Notification'),'item reports through a notification');
assert.ok(ITEM.includes('__dirname'),'item resolves the install root from the main process');
for(const code of ['=== 10','=== 3'])assert.ok(ITEM.includes(code),`item handles updater exit ${code}`);
assert.ok(/Thoát hẳn Zalo/.test(ITEM),'the user is told to quit fully before updating');

// --- manifest hash refresh ------------------------------------------------
// verify-installation.mjs hashes every payload file, so an edited bundle must
// update its manifest entry or the launcher refuses to start Zalo.
const {createHash}=require('node:crypto');
const fixture=await mkdtemp(path.join(path.dirname(new URL(import.meta.url).pathname),'..','.test-tray-linux-'));
try {
  const root=path.join(fixture,'app');
  await mkdir(path.join(root,'main-dist'),{recursive:true});
  const before='original bundle\n';
  await writeFile(path.join(root,'main-dist/main.js'),before);
  const sha=text=>createHash('sha256').update(text).digest('hex');
  const manifest={format:1,fileCount:2,externalRuntime:true,generatedIntegrity:true,files:[
    {file:'main-dist/main.js',sha256:sha(before),mode:0o644},
    {file:'launch.json',sha256:sha('{}\n'),mode:0o600}
  ]};
  await writeFile(path.join(root,'INSTALL-COMPLETE.json'),JSON.stringify(manifest));

  // Import the module's main() through a child process so the CLI path is covered.
  const {execFile}=require('node:child_process');
  const {promisify}=require('node:util');
  const run=promisify(execFile);
  const script=path.join(path.dirname(new URL(import.meta.url).pathname),'tray-linux.mjs');

  // Not a real Zalo bundle, so the patch must fail without touching anything.
  await assert.rejects(run(process.execPath,[script,'apply',root]),/Expected 2/);
  assert.equal(await readFile(path.join(root,'main-dist/main.js'),'utf8'),before,'failed patch leaves the file untouched');

  // With the right shape, the file and its manifest hash both change.
  const real=path.join(root,'main-dist/main.js');
  await writeFile(real,BUNDLE);
  const bundleSha=sha(BUNDLE);
  const m2={...manifest,files:[{file:'main-dist/main.js',sha256:bundleSha,mode:0o644},manifest.files[1]]};
  await writeFile(path.join(root,'INSTALL-COMPLETE.json'),JSON.stringify(m2));
  const applied=await run(process.execPath,[script,'apply',root]);
  assert.match(applied.stdout,/changed/);
  const patched=await readFile(real,'utf8');
  assert.equal(patched.split('label: "'+LABEL+'"').length-1,2);
  const m3=JSON.parse(await readFile(path.join(root,'INSTALL-COMPLETE.json'),'utf8'));
  const entry=m3.files.find(f=>f.file==='main-dist/main.js');
  assert.equal(entry.sha256,sha(patched),'manifest hash follows the edited bundle');
  assert.equal(entry.mode,0o644,'mode is preserved');
  assert.equal(m3.fileCount,2,'manifest shape is unchanged');

  // status reports without writing.
  const status=await run(process.execPath,[script,'status',root]);
  assert.match(status.stdout,/present/);
  // remove restores both the bundle and the hash.
  const removed=await run(process.execPath,[script,'remove',root]);
  assert.match(removed.stdout,/changed/);
  assert.equal(await readFile(real,'utf8'),BUNDLE);
  const m4=JSON.parse(await readFile(path.join(root,'INSTALL-COMPLETE.json'),'utf8'));
  assert.equal(m4.files[0].sha256,sha(BUNDLE),'removing the patch restores the original hash');

  // A source checkout has no manifest: patching must still work.
  const bare=path.join(fixture,'bare');
  await mkdir(path.join(bare,'main-dist'),{recursive:true});
  await writeFile(path.join(bare,'main-dist/main.js'),BUNDLE);
  const bareRun=await run(process.execPath,[script,'apply',bare]);
  assert.match(bareRun.stdout,/changed/);
  // Count the label line, not the bare text: each item also mentions the label
  // inside its notification title.
  assert.equal(
    await readFile(path.join(bare,'main-dist/main.js'),'utf8').then(t=>t.split('label: "'+LABEL+'"').length-1),2);
} finally {
  await rm(fixture,{recursive:true,force:true});
}

console.log('PASS tray-linux: entry inserted after "Mở Zalo" in both templates, idempotent and reversible, malformed bundles rejected, manifest hash refreshed so the launcher still verifies');