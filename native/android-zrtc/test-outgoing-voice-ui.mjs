import assert from 'node:assert/strict';
import {withOutgoingVoiceUI} from './outgoing-voice-ui.mjs';
const wait=signal=>new Promise(resolve=>{if(signal.aborted)resolve();else signal.addEventListener('abort',resolve,{once:true});});
for(const mode of ['local-end','remote-end','mute','dialog-failure']) {
  const events=[],controller=new AbortController();let toggled=false;
  const worker={request:async(op,args)=>{events.push(op);return {code:0};}};
  const run=withOutgoingVoiceUI(worker,{signal:controller.signal},async({signal,onAnswered,beforeCleanup})=>{
    await Promise.resolve();await onAnswered();
    if(mode==='remote-end')controller.abort();
    await wait(signal);await beforeCleanup();events.push('end-api');return 'finished';
  },async(kind,{signal})=>{
    events.push(kind);
    if(kind==='dialing'){await wait(signal);events.push('dialing-joined');return true;}
    if(mode==='dialog-failure')throw Error('fixture UI error');
    if(mode==='remote-end'){await wait(signal);return 'end';}
    if(mode==='mute' && !toggled){toggled=true;return 'toggle';}
    return 'end';
  });
  if(mode==='dialog-failure')await assert.rejects(run,/fixture UI error/);
  else assert.equal(await run,'finished');
  assert.ok(events.indexOf('dialing-joined')<events.indexOf('stop'));
  assert.ok(events.indexOf('stop')<events.indexOf('end-api'));
  assert.equal(events.filter(x=>x==='stop').length,1);
  assert.equal(events.includes('microphoneMute'),mode==='mute');
}
console.log('PASS outgoing voice UI: dialing transition, acknowledged mute, local/remote end, UI failure, stop before server cleanup');
