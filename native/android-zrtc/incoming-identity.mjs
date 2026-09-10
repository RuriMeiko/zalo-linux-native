import {randomInt} from 'node:crypto';
import {decodeIncomingVoice,decodeIncomingVideo} from './incoming-control.mjs';
import {callerResponse} from './caller-response.mjs';
// Obtain independently authenticated identity before trusting uidTo. The
// provisional decode checks shape only; no worker, 416 invitation or media is
// started here. The probe has a distinct call ID and its session/config is
// never applied to the incoming worker. Live server interaction needs QA.
export async function resolveIncomingIdentity(transport,identity,message,{signal,videoEnabled=false,clientVersion=0,
  nextCallId=()=>randomInt(1,0x80000000)}={}) {
  const ticket=identity.ticket();
  if(!ticket.account || !signal || signal.aborted)throw new Error('Incoming identity unavailable');
  try {return identity.resolve(ticket);}catch {}
  const data=message?.data?.data;
  const raw=data?.uidTo;
  const candidate=typeof raw==='string' && /^[1-9][0-9]{0,9}$/.test(raw)?Number(raw):raw;
  if(!Number.isInteger(candidate) || candidate<1 || candidate>0xffffffff ||
    typeof data?.uidN!=='string' || !/^[1-9][0-9]{0,19}$/.test(data.uidN))throw new Error('Invalid incoming identity envelope');
  let decoded,video=false;
  try {decoded=decodeIncomingVoice(message,{nativeLocalId:candidate,clientVersion});}
  catch {
    if(!videoEnabled)throw new Error('Unsupported incoming identity offer');
    decoded=decodeIncomingVideo(message,{nativeLocalId:candidate,clientVersion,experimentalVideo:true});video=true;
  }
  let callId=nextCallId();
  if(!Number.isInteger(callId) || callId<1 || callId>0x7fffffff)throw new Error('Invalid identity probe ID');
  if(callId===decoded.key.callId)callId=callId===0x7fffffff?1:callId+1;
  const abort=()=>transport.cancel(401);
  signal.addEventListener('abort',abort,{once:true});
  try {
    const response=await transport.request(401,{calleeId:data.uidN,callId,codec:'[]',type:video?3:1});
    if(signal.aborted)throw new Error('Incoming identity canceled');
    const mapped=callerResponse(response,{callId,clientVersion,video,experimentalVideo:videoEnabled,abortOnServerChange:true});
    if(mapped.configuration.userId!==candidate || mapped.configuration.partnerId!==decoded.key.callerId)
      throw new Error('Authenticated incoming identity mismatch');
    identity.remember(ticket,mapped.configuration.userId);
    return identity.resolve(ticket);
  } finally {signal.removeEventListener('abort',abort);}
}
