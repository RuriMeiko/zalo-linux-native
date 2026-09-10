const assert=require('node:assert/strict');
const {DesktopSignaling}=require('./desktop-signaling');
const {OutgoingSetup}=require('./outgoing-setup');
const data={partner:[{id:'9999999999999999999'}],type:1};
(async()=>{
  for(const mode of ['success','error','cancel','timeout','consumer-error']) {
    const frames=[];let consumed=0;
    const signaling=new DesktopSignaling(msg=>{
      frames.push(msg);
      if(['success','consumer-error'].includes(mode)) queueMicrotask(()=>signaling.receive({type:'recvSignal',command:401,data:{fromId:123}}));
      if(mode==='error') queueMicrotask(()=>signaling.receive({type:'recvSignalError',command:401,data:{callId:789,errorCode:7}}));
    },{timeoutMs:30});
    const setup=new OutgoingSetup(signaling,{callId:()=>789,onConfig:async(config,ctx)=>{
      consumed++;assert.deepEqual(config,{fromId:123});assert.equal(ctx.callId,789);
      if(mode==='consumer-error') throw new Error('Invalid native config');
      return {callReady:false};
    }});
    await assert.rejects(setup.start({...data,type:3}),/voice/);
    const active=setup.start(data);
    const result=mode==='success'?active:assert.rejects(active,/failed|canceled|timeout|Invalid/);
    await assert.rejects(setup.start(data),/busy/);
    if(mode==='cancel') await setup.stop();
    await result;
    assert.equal(consumed,['success','consumer-error'].includes(mode)?1:0);
    assert.deepEqual(frames,[{type:'sendSignal',command:401,data:{calleeId:data.partner[0].id,callId:789,codec:'[]',type:1}}]);
    assert.equal(setup.active,null);
    await setup.stop();signaling.close();
  }
  const requests=[];
  const videoSetup=new OutgoingSetup({request:async(cmd,body)=>{requests.push({cmd,body});return {};},cancel(){}},
    {allowVideo:true,callId:()=>789,onConfig:async(_config,ctx)=>{assert.equal(ctx.video,true);assert.equal(ctx.calleeId,data.partner[0].id);return {callReady:false};}});
  await assert.rejects(videoSetup.start({...data,type:2}),/voice/);
  await assert.rejects(videoSetup.start({...data,type:6}),/voice/);
  const mutable={type:3,partner:[{id:data.partner[0].id}]};
  const pending=videoSetup.start(mutable);mutable.type=1;mutable.partner[0].id='111';
  await pending;
  assert.deepEqual(requests,[{cmd:401,body:{calleeId:data.partner[0].id,callId:789,codec:'[]',type:3}}]);
  assert.throws(()=>new OutgoingSetup({}, {onConfig(){},allowVideo:1}),/boolean/);
  console.log('PASS outgoing setup: default voice gate, explicit video type 3, immutable intent, 401 transport, busy/cancel/error/timeout; no false ringing');
})().catch(e=>{console.error(e);process.exitCode=1;});
