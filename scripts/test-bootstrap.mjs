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
        './main-dist/compact-app','./main-dist/second-instance'].includes(module));
      return {};
    },
  },{timeout:1000});
  assert.equal(locks,1);
  assert.deepEqual(modules.filter(module=>['./main-dist/main','./main-dist/compact-app','./main-dist/second-instance'].includes(module)),
    [acquired?(compact?'./main-dist/compact-app':'./main-dist/main'):'./main-dist/second-instance']);
  assert.deepEqual(phases,acquired&&!compact?['startup','migration','main']:['startup','migration']);
}
const secondInstanceStart=mainSource.indexOf('bn.on("second-instance"');
assert.ok(secondInstanceStart>0,'Main bundle must handle second-instance activation');
const secondInstance=mainSource.slice(secondInstanceStart,secondInstanceStart+2200);
for(const behavior of ['r.isMinimized()', 'r.restore()', 'r.show()', 'r.focus()',
  'r.webContents.send("show-from-tray")', 'An.receiveArguments(t)'])
  assert.ok(secondInstance.includes(behavior), `Linux second-instance handler must perform ${behavior}`);
assert.ok(mainSource.includes('"linux" === process.platform ? xe.on("click", en) : xe.on("double-click", en)'),
  'Linux tray activation must show/focus Zalo on one click');
console.log('PASS actual bootstrap: exclusive lock routes plus Linux second-instance and one-click tray activation');
