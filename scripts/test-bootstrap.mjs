import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../bootstrap.js',import.meta.url),'utf8');
const mainSource=await readFile(new URL('../main-dist/main.js',import.meta.url),'utf8');
for(const compact of [false,true])for(const acquired of [false,true]) {
  const modules=[],phases=[];let locks=0;
  const perf={STARTUP:'startup',MIGRATION_DONE:'migration',MAIN_SCRIPT:'main',record:phase=>phases.push(phase)};
  vm.runInNewContext(source,{
    process:{argv:['electron','fixture',...(compact?['--launch-compact-app']:[])]},perf,
    require:module=>{
      modules.push(module);
      if(module==='electron')return {app:{requestSingleInstanceLock:()=>{
        assert.equal(++locks,1,'A bootstrap must request the instance lock exactly once');return acquired;
      }}};
      assert.ok(['./libs/perf-tracing/runtime','./main-dist/migration','./main-dist/main',
        './main-dist/compact-app','./main-dist/second-instance','./pc-dist/zadark/js/zadark-main.min'].includes(module));
      return {};
    },
  },{timeout:1000});
  assert.equal(locks,1);
  assert.deepEqual(modules.filter(module=>['./main-dist/main','./main-dist/compact-app','./main-dist/second-instance'].includes(module)),
    [acquired?(compact?'./main-dist/compact-app':'./main-dist/main'):'./main-dist/second-instance']);
  assert.equal(modules.includes('./pc-dist/zadark/js/zadark-main.min'),acquired&&!compact,'ZaDark main hook loads only on the main-app path');
  assert.deepEqual(phases,acquired&&!compact?['startup','migration','main']:['startup','migration']);
}
// The tray entry is not a bootstrap hook: it is patched into main.js's own menu
// templates by scripts/tray-linux.mjs (Electron 22 attaches setContextMenu per
// instance, so no API-level wrapper can work). Assert the shipped bundle carries it.
const label='label: "Kiểm tra cập nhật"';
assert.equal(mainSource.split(label).length-1,2,'both tray templates (logged in and out) carry the update entry');
assert.ok(mainSource.includes('update-native.mjs'),'the entry runs the real updater');
const secondInstanceStart=mainSource.indexOf('bn.on("second-instance"');
assert.ok(secondInstanceStart>0,'Main bundle must handle second-instance activation');
const secondInstance=mainSource.slice(secondInstanceStart,secondInstanceStart+2200);
for(const behavior of ['r.isMinimized()', 'r.restore()', 'r.show()', 'r.focus()',
  'r.webContents.send("show-from-tray")', 'An.receiveArguments(t)'])
  assert.ok(secondInstance.includes(behavior), `Linux second-instance handler must perform ${behavior}`);
assert.ok(mainSource.includes('"linux" === process.platform ? xe.on("click", en) : xe.on("double-click", en)'),
  'Linux tray activation must show/focus Zalo on one click');
console.log('PASS actual bootstrap: exclusive lock routes, tray update entry present in both menu templates, plus Linux second-instance and one-click tray activation');
