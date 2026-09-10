'use strict';
const {contextBridge,ipcRenderer}=require('electron');
let subscribed=false;
contextBridge.exposeInMainWorld('linuxCall',{
  subscribe(onState,onBusy) {
    if(subscribed || typeof onState!=='function' || typeof onBusy!=='function')throw new Error('Invalid call subscription');
    subscribed=true;
    ipcRenderer.on('linux-call-state',(_event,id,state)=>onState(id,state));
    ipcRenderer.on('linux-call-busy',(_event,id)=>onBusy(id));
  },
  act(id,action) {
    if(Number.isSafeInteger(id) && ['answer','end','toggle'].includes(action))
      ipcRenderer.send('linux-call-action',id,action);
  }
});
