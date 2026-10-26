import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
const source=await readFile(new URL('../bootstrap.js',import.meta.url),'utf8');
const mainSource=await readFile(new URL('../main-dist/main.js',import.meta.url),'utf8');
// Stand-in for the real __dirname; bootstrap resolves it before handing it to the tray module.
const root=path.dirname(new URL('../bootstrap.js',import.meta.url).pathname);
for(const compact of [false,true])for(const acquired of [false,true]) {
  const modules=[],phases=[],trayInstalls=[];let locks=0;
  const perf={STARTUP:'startup',MIGRATION_DONE:'migration',MAIN_SCRIPT:'main',record:phase=>phases.push(phase)};
  const app={requestSingleInstanceLock:()=>{
    assert.equal(++locks,1,'A bootstrap must request the instance lock exactly once');return acquired;
  },on(){}};
  vm.runInNewContext(source,{
    process:{argv:['electron','fixture',...(compact?['--launch-compact-app']:[])]},perf,console,__dirname:root,
    require:module=>{
      modules.push(module);
      if(module==='path')return path;
      if(module==='electron')return {app,Tray:class Tray{},Menu:{buildFromTemplate:t=>t},Notification:class Notification{}};
      if(module==='./pc-dist/linux-extras/tray-update.js')return {install:options=>{
        assert.ok(options.electron&&options.electron.Tray,'tray install receives the Electron Tray');
        assert.ok(options.Menu&&options.Notification,'tray install receives Menu and Notification');
        assert.equal(options.appDir,root,'tray install is bound to this application directory');
        assert.equal(options.app,app,'tray install receives the Electron app');
        trayInstalls.push(acquired);return {installed:true};
      }};
      assert.ok(['./libs/perf-tracing/runtime','./main-dist/migration','./main-dist/main',
        './main-dist/compact-app','./main-dist/second-instance','./pc-dist/zadark/js/zadark-main.min'].includes(module));
      return {};
    },
  },{timeout:1000});
  assert.equal(locks,1);
  // The tray entry must be installed before either app entry point runs, and only
  // by the process that owns the single-instance lock.
  assert.deepEqual(trayInstalls,acquired?[true]:[],'tray extension installs once, only on the lock-owning process');
  assert.deepEqual(modules.filter(module=>['./main-dist/main','./main-dist/compact-app','./main-dist/second-instance'].includes(module)),
    [acquired?(compact?'./main-dist/compact-app':'./main-dist/main'):'./main-dist/second-instance']);
  assert.equal(modules.includes('./pc-dist/zadark/js/zadark-main.min'),acquired&&!compact,'ZaDark main hook loads only on the main-app path');
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
console.log('PASS actual bootstrap: exclusive lock routes, tray-update install, plus Linux second-instance and one-click tray activation');
