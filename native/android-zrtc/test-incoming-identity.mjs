import assert from 'node:assert/strict';
import {resolveIncomingIdentity} from './incoming-identity.mjs';
import identities from '../qt-call-cap-linux/native-identity.js';
import signaling from '../qt-call-cap-linux/desktop-signaling.js';
const message=(video=false)=>({type:'control',data:{act_type:'voip',act:'request',data:{uidFrom:'456',uidTo:'123',uidN:'9999999999999999999',callId:'789',
  codec:'[{"name":"opus/16000/1","payload":112}]',params:JSON.stringify({id:789,protocol:1,sessId:'fixture',settings:{},zrtc_config:{},
    rtpIP:'127.0.0.1:9000',rtcpIP:'127.0.0.1:9001',video:{enable:video?1:0},
    ...(video?{extendData:JSON.stringify({callType:1,video:{codec:[{name:'h264',payload:97}]}})}:{})})}}});
const config=id=>({id,fromId:123,toId:456,protocol:1,sessId:'fixture',settings:{},zrtc_config:{},
  changeZRTP:{enable:0},servers:[{rtpaddr:'127.0.0.1:9000',rtcpaddr:'127.0.0.1:9001'}]});
const fresh=()=>{const identity=new identities.NativeIdentity();identity.setAccount('8888888888888888888');return identity;};
for(const video of [false,true]) {
  const identity=fresh(),sent=[];
  const transport={async request(command,payload){sent.push({command,payload});return config(payload.callId);},cancel(){}};
  assert.equal(await resolveIncomingIdentity(transport,identity,message(video),{
    signal:new AbortController().signal,videoEnabled:video,nextCallId:()=>789}),123);
  assert.equal(sent.length,1);assert.equal(sent[0].command,401);assert.equal(sent[0].payload.callId,790);
  assert.equal(sent[0].payload.calleeId,'9999999999999999999');assert.equal(sent[0].payload.type,video?3:1);
  assert.equal(identity.resolve(),123);
  assert.equal(await resolveIncomingIdentity(transport,identity,message(video),{signal:new AbortController().signal}),123);
  assert.equal(sent.length,1,'Bound identity must not create further configuration probes');
}
for(const change of [{fromId:124},{toId:457},{id:901},{fromId:'8888888888888888888'}]) {
  const identity=fresh();
  await assert.rejects(resolveIncomingIdentity({request:async()=>({...config(900),...change}),cancel(){}},identity,message(),
    {signal:new AbortController().signal,nextCallId:()=>900}));
  assert.throws(()=>identity.resolve(),/unavailable/);
}
const switched=fresh();
await assert.rejects(resolveIncomingIdentity({async request(){switched.setAccount('7777777777777777777');return config(900);},cancel(){}},
  switched,message(),{signal:new AbortController().signal,nextCallId:()=>900}),/account changed/);
assert.throws(()=>switched.resolve(),/unavailable/);
const noAccount=new identities.NativeIdentity();let requests=0;
const denied={async request(){requests++;return config(900);},cancel(){}};
await assert.rejects(resolveIncomingIdentity(denied,noAccount,message(),{signal:new AbortController().signal}));
await assert.rejects(resolveIncomingIdentity(denied,fresh(),message(true),{signal:new AbortController().signal}));
const malformed=message();malformed.data.data.params='{"private';
await assert.rejects(resolveIncomingIdentity(denied,fresh(),malformed,{signal:new AbortController().signal}),e=>!e.message.includes('private'));
assert.equal(requests,0);
const controller=new AbortController(),identity=fresh(),sent=[];
const transport=new signaling.DesktopSignaling(frame=>sent.push(frame),{timeoutMs:100});
const canceled=resolveIncomingIdentity(transport,identity,message(),{signal:controller.signal,nextCallId:()=>900});
const rejection=assert.rejects(canceled,/canceled/);controller.abort();await rejection;
assert.throws(()=>identity.resolve(),/unavailable/);
const next=resolveIncomingIdentity(transport,identity,message(),{signal:new AbortController().signal,nextCallId:()=>901});
assert.equal(transport.receive({type:'recvSignal',command:401,data:config(900)}),false);
transport.receive({type:'recvSignal',command:401,data:config(901)});assert.equal(await next,123);
assert.ok(sent.every(frame=>frame.command===401),'Identity probe must never invite, answer or start media');transport.close();
console.log('PASS first-incoming identity: independently authenticated IDs, distinct probe ID, voice/video gates, cache, account switch, cancellation/retry, no media/signaling invitation');
