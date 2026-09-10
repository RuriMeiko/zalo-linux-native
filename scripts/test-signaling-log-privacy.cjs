// Exercise the actual bundled signaling methods with synthetic private data.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
for(const shared of [false,true]) {
  const source=fs.readFileSync(path.join(__dirname,'..',shared?
    'pc-dist/lazy/default-login-main-startup-shared-worker-znotification.9e3e92e88644da772301.js':
    'pc-dist/compact-app-pc.e08d0d44f38873747a6b.js'),'utf8');
  function method(name,next) {
    const start=source.indexOf(`                ${name}(`,source.indexOf('"[zcall-v2] call-helper:"'));
    const end=source.indexOf(`                ${next}(`,start);
    assert.ok(start>0 && end>start);return source.slice(start,end);
  }
  const logs=[],sent=[],api=[];
  const privateData={callerId:'456',callId:789,status:0,codec:'private-codec',
    extendData:'private-extension',rtcpAddress:'127.0.0.1:9001',rtpAddress:'127.0.0.1:9000',session:'private-session'};
  const response={session:'private-response',url:'private-url'};
  const service={default:{sendAnswerCall(...args){api.push(args);return {
    then(fn){fn(response);return {catch(){}};}
  };}}};
  const activation={a:{BACKGROUND_2_FOREGROUND:1},b:{activeApp(){}}};
  const settings={default:{call:{using_queue:false}}};
  const context=shared?{o:service,I:activation,u:settings}:{s:service,v:activation,A:settings};
  const Handler=vm.runInNewContext(`(class {
    ${method('handleSendSignal','handleSendSignalError')}
    ${method('handleSendSignalError','isNoNetwork')}
    ${method('handleRecvSignal','isIncomingCallEvent')}
  })`,context);
  const handler=new Handler();
  handler.logInfo=handler.logError=(...args)=>logs.push(args);
  handler._sendToNative=message=>sent.push(message);
  handler.handleRecvSignal=handler.handleRecvSignal.bind(handler);
  handler.handleSendSignal(null,402,privateData);
  assert.deepEqual(api,[['456',789,0,'private-codec','private-extension','127.0.0.1:9001','127.0.0.1:9000','private-session']]);
  assert.equal(sent[0].data,response,'redaction must not strip transport payload');
  handler.handleSendSignal(null,999,privateData);
  handler.handleSendSignalError(402,{error_code:17,message:'private-error',request:privateData});
  assert.deepEqual(logs,[['call-send-signal',402],['call-recv-signal',402],
    ['call-send-signal',999],['call-send-signal not supported',999],['call-send-signal error 402',17]]);
  assert.ok(!JSON.stringify(logs).includes('private-'));
}
console.log('PASS both bundled signaling log boundaries: send/receive/error/unsupported redacted; original 402 payload and response retained');
