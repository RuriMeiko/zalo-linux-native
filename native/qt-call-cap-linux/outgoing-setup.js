"use strict";
const {randomInt}=require('crypto');

// First leg of outgoing setup. Authenticated HTTPS stays in the renderer.
// onConfig must validate/apply the decoded response; a 401 response is never
// treated as remote ringing. 416 must wait for actual native media readiness.
class OutgoingSetup {
    constructor(signaling,{onConfig,onPhase=()=>{},callId=()=>randomInt(1,0x80000000),allowVideo=false}={}) {
        if(typeof onConfig!=='function') throw new TypeError('Missing native config consumer');
        if(typeof allowVideo!=='boolean')throw new TypeError('Video opt-in must be boolean');
        this.allowVideo=allowVideo;
        this.signaling=signaling;this.onConfig=onConfig;this.onPhase=onPhase;
        this.callId=callId;this.active=null;this.generation=0;
    }
    start(data) {
        if(this.active) return Promise.reject(new Error('Outgoing setup busy'));
        if(!(data?.type===1 || this.allowVideo && data?.type===3) || !Array.isArray(data.partner) || data.partner.length!==1 ||
           typeof data.partner[0]?.id!=='string' || !/^[1-9][0-9]{0,19}$/.test(data.partner[0].id))
            return Promise.reject(new Error('Only one-to-one voice setup is supported'));
        const callId=this.callId();
        const calleeId=data.partner[0].id,type=data.type,video=type===3;
        if(!Number.isInteger(callId) || callId<1 || callId>0x7fffffff)
            return Promise.reject(new Error('Invalid outgoing call ID'));
        const generation=++this.generation;
        this.abort=new AbortController();
        const current=()=>{if(generation!==this.generation) throw new Error('Outgoing setup canceled');};
        // Publish busy before callbacks can re-enter start().
        this.active=Promise.resolve().then(async()=>{
            current();this.onPhase('requesting-config');current();
            const config=await this.signaling.request(401,{
                calleeId,callId,codec:'[]',type,
            });
            current();this.onPhase('received-config');current();
            const result=await this.onConfig(config,{callId,calleeId,video,current,signal:this.abort.signal});
            current();return result;
        });
        return this.active.finally(()=>{this.active=null;});
    }
    async stop() {
        ++this.generation;this.abort?.abort();this.signaling.cancel(401);
        if(this.active) await this.active.catch(()=>{});
    }
}
module.exports={OutgoingSetup};
