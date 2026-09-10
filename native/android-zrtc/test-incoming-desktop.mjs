import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {runIncomingDesktop} from './incoming-desktop.mjs';
const params={id:789,protocol:1,sessId:'fixture',settings:{},zrtc_config:{},rtpIP:'127.0.0.1:9000',
  rtcpIP:'127.0.0.1:9001',video:{enable:0},extendData:'{}'};
const message={type:'control',data:{act_type:'voip',act:'request',data:{uidFrom:'456',uidTo:'123',uidN:'9999999999999999999',
  callId:'789',codec:'[{"name":"opus/16000/1","payload":112}]',params:JSON.stringify(params)}}};
for(const scenario of ['accept','ignore','startup-cancel','start-error','missing-identity']) {
  const transport=new EventEmitter(),controller=new AbortController();let starts=0,closes=0,owners=0;const dialogs=[];
  const options={nativeLocalId:scenario==='missing-identity'?undefined:123,clientVersion:0,runtime:'/fixture',
    pcm:{source:'mic',sink:'speaker'},signal:controller.signal};
  const deps={startWorker:async(_runtime,args)=>{
    starts++;assert.equal(args.network,true);assert.equal(args.cpuVideo,false);
    if(scenario==='start-error')throw Error('fixture start failed');
    if(scenario==='startup-cancel')transport.emit('control',{act_type:'voip',act:'cancel',data:{callId:'789',uidFrom:'456'}});
    return {close:async()=>{closes++;}};
  },dialog:async(kind)=>{dialogs.push(kind);return scenario!=='ignore';},owner:async(worker,_transport,_message,o)=>{
    owners++;assert.equal(o.callerId,message.data.data.uidN);assert.equal(o.context.nativeLocalId,123);
    const accepted=await o.requestConsent({video:false,signal:o.signal});
    if(accepted)await o.runMedia(worker,{video:false,signal:o.signal});
    assert.equal(o.signal.aborted,accepted);
    return {accepted};
  }};
  if(scenario==='missing-identity')await assert.rejects(runIncomingDesktop(transport,message,options,deps),/identity/);
  else if(scenario==='start-error')await assert.rejects(runIncomingDesktop(transport,message,options,deps),/fixture start failed/);
  else if(scenario==='startup-cancel')await assert.rejects(runIncomingDesktop(transport,message,options,deps),/canceled/);
  else assert.deepEqual(await runIncomingDesktop(transport,message,options,deps),{accepted:scenario==='accept'});
  assert.equal(transport.listenerCount('control'),0);
  assert.equal(starts,scenario==='missing-identity'?0:1);
  assert.equal(closes,['missing-identity','start-error'].includes(scenario)?0:1);
  assert.equal(owners,['accept','ignore'].includes(scenario)?1:0);
  if(scenario==='accept')assert.deepEqual(dialogs,['consent','active']);
}
console.log('PASS desktop incoming driver: validated identity/caller, GTK hooks, local end, startup cancel/error and cleanup');
