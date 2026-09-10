// Holds native ownership across the invitation/peer response. Does not claim
// accepted media from an API ACK or an observed answer control message.
export async function inviteOutgoing(worker,signaling,mapped,ready,
  {calleeId,signal,video=false,onPhase=()=>{},onAnswer,beforeCleanup=async()=>{},timeoutMs=45000}={}) {
  if(typeof beforeCleanup!=='function')throw new TypeError('Invalid invitation cleanup');
  if(typeof video!=='boolean')throw new TypeError('Invalid invitation media type');
  if(typeof calleeId!=='string' || !/^[1-9][0-9]{0,19}$/.test(calleeId)) throw new Error('Invalid invitation peer');
  if(!Number.isInteger(timeoutMs) || timeoutMs<1) throw new Error('Invalid invitation timeout');
  const {callId,partnerId,session}=mapped.configuration;
  let sent=false,remoteEnded=false,done=false,ringing=false,answered=false,resolve,reject,timer,queue=Promise.resolve();
  const outcome=new Promise((res,rej)=>{resolve=res;reject=rej;});
  outcome.catch(()=>{}); // may abort while the API request is still awaiting ACK
  const finish=(error,value)=>{if(done)return;done=true;error?reject(error):resolve(value);};
  const current=()=>{if(signal?.aborted || done) throw new Error('Invitation canceled');};
  const native=async(operation,args)=>{
    const reply=await worker.request(operation,args);
    if(reply.code!==0) throw new Error('Native invitation operation failed');
    return reply;
  };
  const onControl=control=>{
    const data=control?.data;
    if(control?.act_type!=='voip' || !data || String(data.callId)!==String(callId) ||
       String(data.uidFrom)!==String(partnerId) || done) return;
    if(control.act==='cancel' || control.act==='endcall') {
      remoteEnded=true;finish(null,{reason:'remote-ended',callReady:false});
      signaling.cancel(408);return;
    }
    queue=queue.then(async()=>{
      if(done) return;
      switch(control.act) {
        case 'ringring':
          if(ringing) break;ringing=true;
          await native('callEvent',{event:'RECEIVED_407'});
          if(!done) onPhase('peer-ringing');
          break;
        case 'answer':
          if(answered) break;answered=true;
          onPhase('peer-answer-observed');
          if(onAnswer) {
            await onAnswer(control,{current});current();
            clearTimeout(timer); // retain ownership until explicit stop or native/remote end
          } else finish(null,{reason:'answer-observed',control,callReady:false});
          break;

      }
    }).catch(error=>finish(error));
  };
  const onFault=event=>{
    if(event.requestId===ready.requestId && ['onCallErr','onCallAutoHangup','onCallChangeZRTP'].includes(event.event))
      finish(new Error('Native invitation ended'));
  };
  const abort=()=>{signaling.cancel(416);signaling.cancel(408);finish(new Error('Invitation canceled'));};
  const onRuntimeFault=()=>{finish(new Error('Native runtime failed'));signaling.cancel(408);};
  signaling.on('control',onControl);worker.on('callEvent',onFault);worker.on('nativeFault',onRuntimeFault);
  worker.exited?.then(()=>{if(!done) onRuntimeFault();});
  signal?.addEventListener('abort',abort,{once:true});
  try {
    current();
    const codecs=await native('audioCodecs'),extra=await native('extendData');
    let list,extension;
    try {list=JSON.parse(codecs.data);extension=JSON.parse(extra.data);} catch {throw new Error('Invalid native invitation offer');}
    if(!Array.isArray(list) || !list.length || !extension || typeof extension!=='object' || Array.isArray(extension))
      throw new Error('Invalid native invitation offer');
    current();await native('callEvent',{event:'SEND_416'});current();
    timer=setTimeout(()=>finish(new Error('Invitation response timeout')),timeoutMs);
    sent=true; // a timeout does not prove the server failed to deliver
    await signaling.request(416,{calleeId,callId,session,codec:codecs.data,extendData:extra.data,
      rtpAddress:ready.rtpAddress,rtcpAddress:ready.rtcpAddress});
    await native('callEvent',{event:'SEND_416_SUCCESS'});
    if(!done && !ringing) onPhase('invite-sent'); // not remote ringing
    return await outcome;
  } finally {
    clearTimeout(timer);signal?.removeEventListener('abort',abort);
    signaling.off('control',onControl);worker.off('callEvent',onFault);worker.off('nativeFault',onRuntimeFault);
    done=true;await queue;
    // A pending invitation and a connected call use different desktop APIs.
    // Command 405 maps to /api/voicecall/cancel and stops peer ringing;
    // command 409 is reserved for a peer that already answered.
    try {await beforeCleanup();}
    finally {if(sent && !remoteEnded) {
      const command=answered?409:405;
      const payload=answered?{toId:calleeId,callId}:{toId:calleeId,callId,callType:video?1:0};
      try {await signaling.request(command,payload);onPhase('remote-cleanup-ack');}
      catch {onPhase('remote-cleanup-failed');}
    }}
  }
}
