import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../bootstrap.js',import.meta.url),'utf8');
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
console.log('PASS actual bootstrap: one instance-lock attempt, denied normal/compact routes never load app, acquired routes remain exclusive');
