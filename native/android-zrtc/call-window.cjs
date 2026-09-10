'use strict';
const path=require('node:path');
// One window per call. The owner closes it only after media shutdown; changing
// dialog stages or waiting for a mute ACK must not destroy the window.
module.exports=function createCallWindow({BrowserWindow,ipcMain}) {
  let window,loading,pending,disposed=false,revision=0,startedAt=null,endQueued=false;
  const settle=(error,value)=>{
    const current=pending;if(!current)return;
    pending=null;current.signal.removeEventListener('abort',current.abort);
    if(error)current.reject(error);else current.resolve(value);
  };
  const action=(event,id,value)=>{
    if(!window || event.sender!==window.webContents || !pending || id!==revision)return;
    const kind=pending.kind;
    const allowed=kind==='consent'?['answer','end']:kind==='active'?['toggle','end']:['end'];
    if(!allowed.includes(value))return;
    // Lock controls until the owner has acknowledged the next state.
    window.webContents.send('linux-call-busy',revision);
    settle(null,kind==='consent'?value==='answer':kind==='active'?value:true);
  };
  ipcMain.on('linux-call-action',action);
  const ensure=()=>{
    if(loading)return loading;
    const created=new BrowserWindow({width:500,height:640,minWidth:360,minHeight:420,
      title:'Zalo — Cuộc gọi',show:false,autoHideMenuBar:true,backgroundColor:'#172023',
      webPreferences:{preload:path.join(__dirname,'call-window-preload.cjs'),
        nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,partition:'zalo-linux-call'}});
    window=created;
    created.webContents.session.setPermissionRequestHandler((_web,_permission,callback)=>callback(false));
    created.webContents.session.setPermissionCheckHandler(()=>false);
    created.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    created.webContents.on('will-navigate',event=>event.preventDefault());
    created.webContents.on('render-process-gone',()=>settle(new Error('Call window unavailable')));
    created.on('close',event=>{
      if(disposed)return;
      event.preventDefault();
      if(pending)action({sender:created.webContents},revision,'end');
      else endQueued=true; // Preserve close while a mute command is in flight.
    });
    loading=created.loadFile(path.join(__dirname,'call-window.html'));
    return loading;
  };
  return {
    async dialog(kind,{signal,video=false,muted=false,muteControl=false}={}) {
      if(disposed || pending || !['consent','dialing','active','error'].includes(kind) || !signal || signal.aborted)
        throw new Error('Call window unavailable');
      await ensure();
      if(disposed || signal.aborted)throw new Error('Call window canceled');
      // A second request can have been awaiting the same page load.
      if(pending)throw new Error('Call window already waiting');
      if(endQueued)return kind==='consent'?false:kind==='active'?'end':true;
      if(kind==='active' && startedAt===null)startedAt=Date.now();
      return new Promise((resolve,reject)=>{
        const abort=()=>settle(new Error('Call window canceled'));
        pending={kind,signal,abort,resolve,reject};signal.addEventListener('abort',abort,{once:true});
        try {
          window.webContents.send('linux-call-state',++revision,{kind,video:video===true,
            muted:muted===true,muteControl:muteControl===true,startedAt});
          window.show();
        } catch {settle(new Error('Call window unavailable'));}
      });
    },
    dispose() {
      if(disposed)return;disposed=true;settle(new Error('Call window closed'));
      ipcMain.removeListener('linux-call-action',action);
      if(window && !window.isDestroyed())window.destroy();window=null;
    }
  };
};
