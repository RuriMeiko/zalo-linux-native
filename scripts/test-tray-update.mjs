#!/usr/bin/env node
// Account-free checks for the tray "Kiểm tra cập nhật" entry and the pre-launch
// update pass. No Electron UI, network or real installation is touched: the tray
// is a fake prototype, and the updater child is a stub.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {parseArgs,resolveAppDir,applyUpdate,writeStamp,stateDir,EXIT} from './apply-update-on-launch.mjs';

const require=createRequire(import.meta.url);
const tray=require('../pc-dist/linux-extras/tray-update.js');

// --- menu insertion -------------------------------------------------------
const zaloTemplate=[
  {label:'Mở Zalo',click(){}},
  {submenu:[{label:'Đang online',type:'checkbox'},{label:'Đang bận',type:'checkbox'}],label:'Đổi trạng thái'},
  {label:'',type:'separator'},
  {label:'Thoát',click(){}}
];
assert.equal(tray.isZaloMenu(zaloTemplate),true);
const withItem=tray.insertUpdateItem(zaloTemplate,{click(){}});
assert.deepEqual(withItem.map(i=>i.label),['Mở Zalo',tray.MENU_LABEL,'Đổi trạng thái','','Thoát'],
  'the entry sits directly after "Mở Zalo", before the status submenu and "Thoát"');
assert.equal(tray.isZaloMenu(withItem),false,'an already patched menu is not patched twice');
assert.deepEqual(tray.insertUpdateItem(zaloTemplate,{click(){}}).length,zaloTemplate.length+1);
// Unrelated menus (chat context menu, image viewer) must be returned untouched.
for(const foreign of [
  [{label:'Sao chép'},{label:'Xoá'}],
  [{label:'Thoát'},{label:'Mở Zalo'}],      // wrong order
  [{label:'Mở Zalo'}],                       // no quit entry
  [{label:'Thoát'}],
  []
]) assert.deepEqual(tray.insertUpdateItem(foreign,{click(){}}),foreign);
assert.throws(()=>tray.insertUpdateItem('nope',{click(){}}),/array/);
assert.throws(()=>tray.insertUpdateItem(zaloTemplate,{}),/click handler/);
assert.throws(()=>tray.insertUpdateItem(zaloTemplate,{click:1}),/click handler/);

// --- result wording -------------------------------------------------------
assert.match(tray.describeResult(EXIT.OK,null,'').body,/mới nhất/);
assert.match(tray.describeResult(10,null,'').body,/Thoát hẳn Zalo/);
assert.match(tray.describeResult(3,null,'').body,/đang chạy/);
assert.match(tray.describeResult(1,null,'[update] failed: boom').body,/boom/);
assert.match(tray.describeResult(null,'SIGTERM','').body,/bị dừng/);
assert.equal(tray.describeResult(1,null,'').ok,false);

// --- install() patches the prototype once --------------------------------
function fakeElectron() {
  class Tray {
    setContextMenu(menu) {this.menu=menu;}
  }
  return {Tray};
}
const Menu={buildFromTemplate:template=>({built:true,items:template})};
const electron=fakeElectron();
const handle=tray.install({electron,Menu,appDir:'/nonexistent'});
assert.equal(handle.installed,true);
const again=tray.install({electron,Menu,appDir:'/nonexistent'});
assert.equal(again.reason,'already patched','a second install must not wrap twice');
const instance=new electron.Tray();
instance.setContextMenu({items:zaloTemplate.map(i=>({...i}))});
assert.equal(instance.menu.built,true,'the Zalo menu is rebuilt with the extra entry');
assert.deepEqual(instance.menu.items.map(i=>i.label),['Mở Zalo',tray.MENU_LABEL,'Đổi trạng thái','','Thoát']);
// A foreign menu passes straight through.
const other=new electron.Tray(),foreignMenu={items:[{label:'Sao chép'}]};
other.setContextMenu(foreignMenu);
assert.equal(other.menu,foreignMenu,'non-Zalo menus keep their original Menu object');
// Submenu recursion keeps the checkbox state.
assert.deepEqual(tray.itemToTemplate({label:'x',submenu:{items:[{label:'y',type:'checkbox',checked:true}]}}),
  {label:'x',submenu:[{label:'y',type:'checkbox',checked:true}]});

// --- launch-time update pass ---------------------------------------------
assert.equal(parseArgs([]).timeoutMs,120000);
assert.equal(parseArgs(['--app-dir','/h/z','--quiet']).quiet,true);
assert.equal(parseArgs(['--timeout-ms','5000']).timeoutMs,5000);
for(const bad of [['--bogus'],['--app-dir'],['--timeout-ms','999'],['--timeout-ms','abc']])
  assert.throws(()=>parseArgs(bad),undefined,JSON.stringify(bad));

// A source checkout has no INSTALL-COMPLETE.json: skip without spawning anything.
assert.equal(await resolveAppDir('/home/test/source'),null);
assert.equal(await resolveAppDir('relative'),null);
const skipped=await applyUpdate({appDir:'/home/test/source',spawnProcess:()=>{throw new Error('must not spawn');}});
assert.deepEqual({...skipped},{code:null,skipped:true,stdout:'',stderr:''});

// A real-ish installation directory drives the child invocation.
// Keep the fixture inside the checkout: CI and sandboxes may not allow writes to $HOME.
const fixture=await mkdtemp(path.join(path.dirname(new URL(import.meta.url).pathname),'..','.test-tray-update-'));
const appDir=path.join(fixture,'zalo');
await mkdir(path.join(appDir,'scripts'),{recursive:true});
await writeFile(path.join(appDir,'INSTALL-COMPLETE.json'),'{}\n');
await writeFile(path.join(appDir,'scripts/update-native.mjs'),'// fixture\n');
assert.equal(await resolveAppDir(appDir),appDir);
const calls=[];
const fakeSpawn=(command,args,options)=>{
  calls.push({command,args,options});
  const {EventEmitter}=require('node:events');
  const child=new EventEmitter();
  child.stdout=new EventEmitter();child.stderr=new EventEmitter();
  child.kill=()=>{};
  setImmediate(()=>{
    child.stdout.emit('data','[update] up to date (abc1234)\n');
    child.emit('close',0,null);
  });
  return child;
};
const result=await applyUpdate({appDir,spawnProcess:fakeSpawn,node:'/usr/bin/node'});
assert.equal(result.code,0);
assert.deepEqual(calls[0].args,[path.join(appDir,'scripts/update-native.mjs'),'--app-dir',appDir]);
assert.equal(calls[0].command,'/usr/bin/node');
assert.deepEqual(calls[0].options.stdio,['ignore','pipe','pipe']);

// Exit code 3 (Zalo still running) is reported, not treated as a crash.
const running=await applyUpdate({appDir,spawnProcess:(c,a,o)=>{
  const {EventEmitter}=require('node:events');
  const child=new EventEmitter();
  child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{};
  setImmediate(()=>child.emit('close',3,null));
  return child;
}});
assert.equal(running.code,3);

// A missing executable resolves instead of throwing.
const broken=await applyUpdate({appDir,spawnProcess:()=>{throw new Error('ENOENT');}});
assert.equal(broken.code,EXIT.FAILED);
assert.match(broken.stderr,/ENOENT/);

// The advisory stamp is written and never throws.
const state=path.join(fixture,'state');
await writeStamp(state,{code:0,skipped:false,stdout:'ok\n',stderr:''});
const stamp=JSON.parse(await (await import('node:fs/promises')).readFile(path.join(state,'last-launch-check.json'),'utf8'));
assert.equal(stamp.code,0);
await writeStamp(path.join(fixture,'missing','deeper'),{code:1,skipped:false,stdout:'',stderr:'x'});
assert.match(stateDir(),/zalo-native-update$/);

await rm(fixture,{recursive:true,force:true});
console.log('PASS tray-update: entry inserted between "Mở Zalo" and "Thoát", foreign menus untouched, single prototype wrap, launch-time update pass skips source checkouts and reports updater exit codes');
