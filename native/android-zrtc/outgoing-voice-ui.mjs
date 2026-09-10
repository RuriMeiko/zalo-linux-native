import {callDialog,activeCallControls} from './native-call-ui.mjs';

export async function withOutgoingVoiceUI(worker,{signal},runCall,dialog=callDialog) {
  const controller=new AbortController(),abort=()=>controller.abort();
  signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted)abort();
  let stage,task,failure,answered=false,cleanup;
  const stopUI=async()=>{stage?.abort();await task;};
  const open=kind=>{
    const currentStage=new AbortController();stage=currentStage;
    const stop=()=>currentStage.abort();controller.signal.addEventListener('abort',stop,{once:true});
    if(controller.signal.aborted)stop();
    task=Promise.resolve().then(()=>{
      if(currentStage.signal.aborted)return;
      return kind==='dialing'?dialog(kind,{signal:currentStage.signal}):
        activeCallControls(worker,{signal:currentStage.signal},dialog);
    }).then(()=>{if(!currentStage.signal.aborted)controller.abort();})
      .catch(error=>{if(!currentStage.signal.aborted){failure=error;controller.abort();}})
      .finally(()=>controller.signal.removeEventListener('abort',stop));
  };
  const beforeCleanup=()=>cleanup??=(async()=>{
    await stopUI();
    const reply=await worker.request('stop');
    if(reply?.code!==0)throw new Error('Outgoing audio shutdown failed');
  })();
  try {
    if(controller.signal.aborted)throw new Error('Outgoing call canceled');
    open('dialing');
    const result=await runCall({signal:controller.signal,beforeCleanup,onAnswered:async()=>{
      if(answered)throw new Error('Outgoing UI already answered');
      answered=true;await stopUI();
      if(controller.signal.aborted)throw new Error('Outgoing call canceled');
      open('active');
    }});
    if(failure)throw failure;
    return result;
  } catch(error) {throw failure??error;}
  finally {
    signal?.removeEventListener('abort',abort);controller.abort();await beforeCleanup();
  }
}
