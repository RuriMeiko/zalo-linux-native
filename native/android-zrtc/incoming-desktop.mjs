import {NativeWorker} from './worker-client.mjs';
import {runIncomingCall} from './incoming-call-owner.mjs';
import {decodeIncomingVoice,decodeIncomingVideo,incomingControlKey} from './incoming-control.mjs';
import {callDialog,activeCallControls} from './native-call-ui.mjs';
import {runVideoMedia} from './video-media-session.mjs';
import {createManagedCamera} from './managed-camera.mjs';
export async function runIncomingDesktop(transport,message,{nativeLocalId,clientVersion,runtime,pcm,
  videoEnabled=false,device,sink,signal,onPhase=()=>{}},
  {startWorker=NativeWorker.start,owner=runIncomingCall,dialog=callDialog,videoMedia=runVideoMedia}={}) {
  let params;
  if(typeof message?.data?.data?.params!=='string' || Buffer.byteLength(message.data.data.params)>65536)
    throw new Error('Invalid incoming media intent');
  try {params=JSON.parse(message?.data?.data?.params);}catch {throw new Error('Invalid incoming media intent');}
  const video=params?.video?.enable===1,context={nativeLocalId,clientVersion,video};
  if(video && !videoEnabled)throw new Error('Incoming video disabled');
  const decoded=video?decodeIncomingVideo(message,{...context,experimentalVideo:true}):decodeIncomingVoice(message,context);
  const callerId=message.data.data.uidN;
  if(typeof callerId!=='string' || !/^[1-9][0-9]{0,19}$/.test(callerId))throw new Error('Missing authenticated desktop caller');
  if(video && (!/^\/dev\/video[0-9]+$/.test(device??'') || !sink))throw new Error('Incoming video device/display unavailable');
  const controller=new AbortController(),abort=()=>controller.abort();
  let remoteCanceled=false,failure;
  const earlyControl=event=>{
    if(!['cancel','endcall'].includes(event?.act))return;
    try {const key=incomingControlKey({type:'control',data:event});
      if(key.callId===decoded.key.callId && key.callerId===decoded.key.callerId){remoteCanceled=true;controller.abort();}
    }catch {}
  };
  let worker;
  const duringStartup=earlyControl;
  signal.addEventListener('abort',abort,{once:true});transport.on('control',duringStartup);
  try {
    if(signal.aborted)abort();
    if(controller.signal.aborted)throw new Error('Incoming call canceled');
    worker=await startWorker(runtime,{network:true,pcm,cpuVideo:video,experimentalVideoNetwork:video});
    if(controller.signal.aborted)throw new Error('Incoming call canceled');
    return await owner(worker,transport,message,{context,callerId,signal:controller.signal,onPhase,
      requestConsent:options=>dialog('consent',options),
      runMedia:async(native,options)=>{
        const cameraControl=video?createManagedCamera():undefined;
        const mediaAbort=new AbortController(),stopMedia=()=>mediaAbort.abort();
        options.signal.addEventListener('abort',stopMedia,{once:true});
        if(options.signal.aborted)stopMedia();
        let failure;
        const guard=task=>Promise.resolve().then(task).catch(error=>{if(!mediaAbort.signal.aborted)failure??=error;})
          .finally(()=>{mediaAbort.abort();controller.abort();});
        try {
          await Promise.all([
            guard(()=>activeCallControls(native,{video,signal:mediaAbort.signal,cameraControl},dialog)),
            ...(video?[guard(()=>videoMedia(native,{device,sink,signal:mediaAbort.signal,cameraControl}))]:[])
          ]);
          if(failure)throw failure;
        } finally {options.signal.removeEventListener('abort',stopMedia);mediaAbort.abort();}
      }});
  } catch(error) {failure=error;throw error;}
  finally {
    controller.abort();signal.removeEventListener('abort',abort);transport.off('control',duringStartup);
    try {if(worker)await worker.close();}
    finally {
      // Never interpolate raw errors, account data or remote strings. The
      // original failure still propagates if the notification cannot open.
      if(failure && !signal.aborted && !remoteCanceled) {
        try {await dialog('error',{video,signal});}catch {}
      }
    }
  }
}
