import assert from 'node:assert/strict';
import presentation from './call-presentation.cjs';
import setup from '../qt-call-cap-linux/outgoing-setup.js';
const {peerName}=presentation;
assert.equal(peerName('  Liên\n hệ\u202e thử  '),'Liên hệ thử');
assert.equal(peerName(null),'');assert.equal(peerName('a'.repeat(513)),'');
assert.equal(Array.from(peerName('🎥'.repeat(81))).length,80);
assert.equal(peerName('<b>Liên hệ</b>'),'<b>Liên hệ</b>','Name remains plain text, not parsed HTML');
let release,context;
const response=new Promise(resolve=>release=resolve);
const transport={async request(command,payload){
  assert.equal(command,401);assert.deepEqual(Object.keys(payload).sort(),['callId','calleeId','codec','type']);
  return response;
},cancel(){}};
const owner=new setup.OutgoingSetup(transport,{callId:()=>123,onConfig:async(_config,options)=>{context=options;return {};}});
const request={type:1,partner:[{id:'456',name:'Liên hệ ban đầu'}]};
const run=owner.start(request);request.partner[0].name='Tên bị sửa sau đó';release({});await run;
assert.equal(context.peerName,'Liên hệ ban đầu');assert.equal(context.calleeId,'456');
console.log('PASS call presentation: bounded Unicode/plain text, control stripping, immutable per-call name, no display name in signaling');
