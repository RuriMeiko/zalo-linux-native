import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const electron=process.argv[2];
if(process.argv.length!==3 || !path.isAbsolute(electron??''))throw new Error('Usage: node scripts/test-single-instance-electron.mjs ABSOLUTE_ELECTRON');
const parent=path.join(homedir(),'zalo-native-recovery');await mkdir(parent,{recursive:true});
const fixture=await mkdtemp(path.join(parent,'instance-fixture-'));
const profile=path.join(fixture,'profile');await mkdir(profile);
for(const name of ['first app','second app']) {
  const directory=path.join(fixture,name);await mkdir(directory);
  await writeFile(path.join(directory,'package.json'),JSON.stringify({name:'zalo-instance-fixture',version:'1.0.0',main:'index.cjs'}));
  await writeFile(path.join(directory,'index.cjs'),`require(${JSON.stringify(fileURLToPath(new URL('./single-instance-fixture.cjs',import.meta.url)))});\n`);
}
const children=[];
function launch(name,probe=false) {
  const env={...process.env,ZALO_INSTANCE_FIXTURE_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(electron,['--no-sandbox',path.join(fixture,name),...(probe?['--probe-only']:[])],{env,stdio:['ignore','pipe','pipe']});
  const state={events:[],closed:false};
  children.push({child,state});
  let output='';
  child.stdout.on('data',chunk=>{
    output+=chunk.toString();if(output.length>4096){child.kill();return;}
    const lines=output.split('\n');output=lines.pop();
    state.events.push(...lines.filter(line=>/^FIXTURE_(HELD|DENIED|SECOND_INSTANCE)$/.test(line)));
  });
  child.stderr.resume(); // Electron diagnostics only; never load account data.
  child.on('error',()=>{state.error=true;});
  state.exit=new Promise(resolve=>child.on('close',(code,signal)=>{state.closed=true;state.code=code;state.signal=signal;resolve();}));
  return {child,state};
}
async function until(predicate,label) {
  const deadline=Date.now()+15000;
  while(!predicate()) {if(Date.now()>deadline)throw new Error(`Fixture timed out: ${label}`);await new Promise(resolve=>setTimeout(resolve,25));}
}
try {
  const first=launch('first app');
  await until(()=>first.state.events.includes('FIXTURE_HELD') || first.state.closed || first.state.error,'first owner');
  assert.ok(first.state.events.includes('FIXTURE_HELD'));
  const second=launch('second app',true);
  await until(()=>second.state.closed,'second denial');assert.equal(second.state.code,0);
  assert.deepEqual(second.state.events,['FIXTURE_DENIED']);
  await until(()=>first.state.events.includes('FIXTURE_SECOND_INSTANCE'),'first owner notification');
  assert.equal(first.state.closed,false);
  first.child.kill('SIGTERM');await until(()=>first.state.closed,'owner exit');
  const replacement=launch('second app',true);
  await until(()=>replacement.state.closed,'replacement acquisition');assert.equal(replacement.state.code,0);
  assert.deepEqual(replacement.state.events,['FIXTURE_HELD']);
  console.log('PASS real Electron: different installation directories share profile lock, second instance notifies first, replacement acquires after exit');
} finally {
  for(const {child,state} of children)if(!state.closed) {
    child.kill('SIGTERM');
    const force=setTimeout(()=>{if(!state.closed)child.kill('SIGKILL');},2000);
    try {await until(()=>state.closed,'fixture cleanup');}finally {clearTimeout(force);}
  }
}
console.log(`Synthetic profile retained: ${fixture}`);
