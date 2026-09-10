"use strict";
// Renderer handleSendSignal/handleRecvSignal owns authenticated HTTPS. No
// account session key crosses this boundary. Numeric commands are not ZRTC
// enum ordinals. Responses carry only command, so allow one request per command.
const {EventEmitter} = require('events');
const FIELDS = Object.freeze({
    401:['calleeId','callId','codec','type'],
    416:['calleeId','rtcpAddress','rtpAddress','codec','extendData','session','callId'],
    407:['callerId','callId'],
    408:['calleeId','callId'],
    402:['callerId','callId','status','codec','extendData','rtcpAddress','rtpAddress','session'],
    405:['toId','callId','callType'],
    409:['toId','callId'],
});
class DesktopSignaling extends EventEmitter {
    constructor(send, {timeoutMs=15000}={}) {
        super();
        if(typeof send!=='function' || !Number.isInteger(timeoutMs) || timeoutMs<1)
            throw new TypeError('Invalid signaling transport');
        this.send=send; this.timeoutMs=timeoutMs; this.pending=new Map();
        this.expired=new Set(); this.closed=false;
    }
    request(command,data) {
        if(this.closed) return Promise.reject(new Error('Signaling transport closed'));
        if(!Number.isInteger(command) || !Object.hasOwn(FIELDS,command) ||
            !data || typeof data!=='object' || Array.isArray(data))
            return Promise.reject(new Error('Unsupported signaling request'));
        if(this.pending.has(command) || this.expired.has(command))
            return Promise.reject(new Error('Signaling command busy or expired'));
        const fields=FIELDS[command], payload={};
        if(Object.keys(data).some(k=>!fields.includes(k)))
            return Promise.reject(new Error('Unexpected signaling field'));
        for(const key of fields) {
            if(key==='extendData' && data[key]===undefined) continue;
            if(!Object.hasOwn(data,key) || !['string','number'].includes(typeof data[key]) ||
                (typeof data[key]==='number' && !Number.isFinite(data[key])))
                return Promise.reject(new Error('Missing or invalid signaling field: '+key));
            payload[key]=data[key];
        }
        return new Promise((resolve,reject)=>{
            const timer=setTimeout(()=>{
                this.pending.delete(command);
                // A late command-only response cannot safely be assigned to
                // another call. Require a fresh IPC connection after timeout.
                this.expired.add(command);
                reject(new Error('Signaling response timeout'));
            },this.timeoutMs);
            this.pending.set(command,{resolve,reject,timer,callId:String(payload.callId)});
            try { this.send({type:'sendSignal',command,data:payload}); }
            catch(error) {
                clearTimeout(timer);this.pending.delete(command);
                this.expired.add(command);reject(error);
            }
        });
    }
    receive(message) {
        if(this.closed || !message || typeof message!=='object') return false;
        if(message.type==='control') {
            const control=message.data;
            if(!control || typeof control!=='object' || control.act_type!=='voip' ||
                typeof control.act!=='string' || !control.data || typeof control.data!=='object') return false;
            this.emit('control',control); return true;
        }
        if(!['recvSignal','recvSignalError'].includes(message.type) || !Number.isInteger(message.command)) return false;
        const entry=this.pending.get(message.command);
        if(!entry) return false;
        if(message.type==='recvSignalError') {
            if(!message.data || String(message.data.callId)!==entry.callId) return false;
            this.pending.delete(message.command);clearTimeout(entry.timer);
            const error=new Error('Desktop signaling API failed');
            error.command=message.command;
            error.code=Number.isInteger(message.data.errorCode)?message.data.errorCode:null;
            entry.reject(error);return true;
        }
        this.pending.delete(message.command);clearTimeout(entry.timer);
        // The renderer's kCOK response decoder already decrypted/validated
        // both envelopes and supplies r.data here. Do not unwrap data again.
        // Delivery still does not imply media negotiation or a connected call.
        entry.resolve(message.data);return true;
    }
    close() {
        this.closed=true;
        for(const entry of this.pending.values()) {
            clearTimeout(entry.timer);entry.reject(new Error('Signaling transport closed'));
        }
        this.pending.clear();this.removeAllListeners();
    }
    cancel(command) {
        const entry=this.pending.get(command);
        if(!entry) return false;
        this.pending.delete(command);clearTimeout(entry.timer);
        // Do not reuse on this IPC connection: the host may still return a
        // command-only success for this canceled request.
        this.expired.add(command);
        entry.reject(new Error('Signaling request canceled'));return true;
    }
}
module.exports={DesktopSignaling};
