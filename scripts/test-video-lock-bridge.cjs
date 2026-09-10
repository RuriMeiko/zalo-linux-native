const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
for(const file of ['pc-dist/compact-app-pc.e08d0d44f38873747a6b.js','pc-dist/lazy/default-login-main-startup-shared-worker-znotification.9e3e92e88644da772301.js']) {
  const text=fs.readFileSync(path.join(root,file),'utf8');
  const method=text.match(/setAppLock\(e\) \{([\s\S]*?)\n                \}/)[1];
  const messages=[],object={};
  const call=vm.runInNewContext(`(function(e){${method}})`,{$zcall:{sendDataToNative:message=>messages.push(JSON.parse(JSON.stringify(message)))}});
  call.call(object,true);call.call(object,false);
  assert.equal(object._appLock,false);
  assert.deepEqual(messages,[true,false].map(data=>({type:'update',command:'linux-app-lock',data,_optional:true})));
}
const main=fs.readFileSync(path.join(root,'main-dist/main.js'),'utf8');
const body=main.match(/if \(t && t.command === "linux-app-lock"\) \{([\s\S]*?)\n                        \}/)[1];
const sender={},updates=[];
const context={w:{webContents:sender},linuxVideoLocked:false,linuxVideoDisplay:{setLocked:value=>updates.push(value)}};
const handle=vm.runInNewContext(`(function(e,t){${body}})`,context);
handle({sender:{}},{data:true});assert.equal(updates.length,0);
handle({sender},{data:'true'});assert.equal(updates.length,0);
handle({sender},{data:true});assert.equal(context.linuxVideoLocked,true);assert.deepEqual(updates,[true]);
handle({sender},{data:false});assert.equal(context.linuxVideoLocked,false);assert.deepEqual(updates,[true,false]);
console.log('PASS actual bundled lock bridge: both stores, optional boolean event, main sender/type guards');
