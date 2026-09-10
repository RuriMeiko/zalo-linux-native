'use strict';
const {randomUUID}=require('node:crypto');
const {peerName}=require('../android-zrtc/call-presentation.cjs');
// Use the existing renderer contact lookup. A unique response ticket prevents
// delayed results from an earlier call/account from naming a new call.
class IncomingName {
  constructor(send,{timeoutMs=750}={}) {
    if(typeof send!=='function' || !Number.isInteger(timeoutMs) || timeoutMs<1 || timeoutMs>2000)throw new TypeError('Invalid name lookup');
    this.send=send;this.timeoutMs=timeoutMs;this.pending=null;
  }
  resolve(id,signal) {
    if(this.pending || typeof id!=='string' || !/^[1-9][0-9]{0,19}$/.test(id) || !signal || signal.aborted)return Promise.resolve('');
    return new Promise(resolve=>{
      const requestId=randomUUID();
      const done=value=>{
        if(this.pending?.requestId!==requestId)return;
        clearTimeout(this.pending.timer);signal.removeEventListener('abort',abort);
        this.pending=null;resolve(value);
      };
      const abort=()=>done('');
      this.pending={id,requestId,done,timer:setTimeout(abort,this.timeoutMs)};
      signal.addEventListener('abort',abort,{once:true});
      try {this.send({type:'request',command:'getAliasName',data:{noisedId:id,requestId}});}
      catch {done('');}
    });
  }
  receive(message) {
    if(message?.type!=='response' || message.command!=='getAliasName')return false;
    const task=this.pending,data=message.data;
    if(task && data?.requestId===task.requestId && data.noisedId===task.id)task.done(peerName(data.aliasName));
    return true;
  }
}
module.exports={IncomingName};
