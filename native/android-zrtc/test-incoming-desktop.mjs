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
  if(scenario==='start-error')assert.deepEqual(dialogs,['error']);
  if(scenario==='startup-cancel')assert.deepEqual(dialogs,[]);
}
const videoMessage={...message,data:{...message.data,data:{...message.data.data,params:JSON.stringify({...params,
  video:{enable:1},extendData:JSON.stringify({callType:1,video:{codec:[{name:'h264',payload:97}]}})})}}};
const defer=()=>{let resolve;return {promise:new Promise(r=>{resolve=r;}),resolve};};
for(const scenario of ['video-error','dialog-error','local-end','parent-abort']) {
  const transport=new EventEmitter(),controller=new AbortController(),ready=defer(),finish=defer();
  const events=[];let started=0;
  const task=async(kind,signal)=>{
    const aborted=defer();
    const onAbort=()=>aborted.resolve();
    signal.addEventListener('abort',onAbort,{once:true});
    if(signal.aborted)onAbort();
    if(++started===2)ready.resolve();
    try {
      await ready.promise;
      if((scenario==='video-error' && kind==='video') || (scenario==='dialog-error' && kind==='dialog'))
        throw Error(scenario);
      if(scenario==='local-end' && kind==='dialog')return true;
      await aborted.promise;
      await finish.promise; // joins remain pending after abort is delivered
    } finally {signal.removeEventListener('abort',onAbort);events.push(kind+'-joined');}
  };
  const running=runIncomingDesktop(transport,videoMessage,{nativeLocalId:123,clientVersion:0,runtime:'/fixture',
    videoEnabled:true,device:'/dev/video0',sink:{},pcm:{source:'mic',sink:'speaker'},signal:controller.signal},{
    startWorker:async(_runtime,args)=>{
      assert.equal(args.cpuVideo,true);assert.equal(args.experimentalVideoNetwork,true);
      return {close:async()=>{events.push('closed');}};
    },
    owner:async(worker,_transport,_message,o)=>{
      assert.equal(await o.requestConsent({video:true,signal:o.signal}),true);
      await o.runMedia(worker,{video:true,signal:o.signal});
    },
    dialog:async(kind,{signal})=>{
      if(kind==='consent')return true;
      if(kind==='error'){
        assert.equal(events.at(-1),'closed','error shown only after worker closed');
        events.push('error-shown');return true;
      }
      return task('dialog',signal);
    },
    videoMedia:async(_worker,{signal})=>task('video',signal),
  });
  const outcome=scenario.endsWith('error')?assert.rejects(running,new RegExp(scenario)):running;
  await ready.promise;
  if(scenario==='parent-abort')controller.abort();
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(!events.includes('closed'),'worker must remain alive until media tasks join');
  finish.resolve();await outcome;
  assert.equal(events.at(-1),scenario.endsWith('error')?'error-shown':'closed');
  assert.ok(events.includes('video-joined') && events.includes('dialog-joined'));
  assert.equal(transport.listenerCount('control'),0);
}
console.log('PASS desktop incoming driver: identity, GTK hooks, startup cancellation, video/dialog faults, parent/local stop, joined cleanup');
