import {resolveIncomingIdentity} from './incoming-identity.mjs';

// Failures before the incoming owner exists still need visible feedback.
// Keep this boundary separate from the owner's own error dialog, so a failed
// call is never reported twice. Cancellation (remote end, lock, account change)
// must not reopen a window.
export async function prepareIncomingDesktop(transport,identity,message,options,
  {resolveName,dialog,resolveIdentity=resolveIncomingIdentity}) {
  const {signal}=options;
  try {
    if(signal.aborted)throw new Error('Incoming call canceled');
    const nativeLocalId=await resolveIdentity(transport,identity,message,options);
    if(signal.aborted)throw new Error('Incoming call canceled');
    const peerName=await resolveName(message?.data?.data?.uidN,signal);
    if(signal.aborted)throw new Error('Incoming call canceled');
    return {nativeLocalId,peerName};
  } catch(error) {
    if(!signal.aborted) {
      // No untrusted error text, identities, parameters or credentials cross
      // the presentation boundary. Error presentation is bounded by the pipe.
      try {await dialog('error',{signal});}catch {}
    }
    throw error;
  }
}
