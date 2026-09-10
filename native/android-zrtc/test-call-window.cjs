const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const create=require('./call-window.cjs');
const ipcMain=new EventEmitter(),windows=[];
class Window extends EventEmitter {
  constructor(options){super();this.options=options;windows.push(this);this.messages=[];
    this.webContents=new EventEmitter();
    this.webContents.session={setPermissionRequestHandler:fn=>this.permission=fn,setPermissionCheckHandler:fn=>this.check=fn};
    this.webContents.setWindowOpenHandler=fn=>this.open=fn;
    this.webContents.send=(...args)=>this.messages.push(args);
  }
  async loadFile(file){assert.ok(file.endsWith('call-window.html'));}
  show(){this.shown=true;}
  destroy(){this.destroyed=true;}
  isDestroyed(){return !!this.destroyed;}
}
const turn=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  const host=create({BrowserWindow:Window,ipcMain});
  const stage=new AbortController();
  const dialing=host.dialog('dialing',{signal:stage.signal,video:true});
  const canceled=assert.rejects(dialing,/canceled/);await turn();
  const window=windows[0];assert.ok(window.shown);
  assert.equal(window.options.webPreferences.sandbox,true);assert.equal(window.check(),false);
  assert.deepEqual(window.open(),{action:'deny'});
  stage.abort();await canceled;assert.ok(!window.destroyed);
  const signal=new AbortController().signal;
  let active=host.dialog('active',{signal,video:true,muteControl:true,muted:false});await turn();
  const state=window.messages.at(-1);assert.equal(state[0],'linux-call-state');assert.equal(state[2].muted,false);
  const frame={format:'I420',width:2,height:2,sequence:1n,pixels:Buffer.alloc(6)};
  const remote=host.render(frame,'remote'),local=host.render(frame,'local');await turn();
  await assert.rejects(host.render(frame,'remote'),/unavailable/);
  const frames=window.messages.filter(m=>m[0]==='linux-call-frame');assert.equal(frames.length,2);
  for(const message of frames)ipcMain.emit('linux-call-painted',{sender:window.webContents},message[1],true);
  await Promise.all([remote,local]);
  window.messages.splice(window.messages.indexOf(state)+1);
  ipcMain.emit('linux-call-action',{sender:{}},state[1],'toggle');
  ipcMain.emit('linux-call-action',{sender:window.webContents},state[1]-1,'end');
  ipcMain.emit('linux-call-action',{sender:window.webContents},state[1],'answer');
  assert.equal(window.messages.at(-1),state,'Foreign/stale/inapplicable actions ignored');
  ipcMain.emit('linux-call-action',{sender:window.webContents},state[1],'toggle');assert.equal(await active,'toggle');
  assert.equal(window.messages.at(-1)[0],'linux-call-busy');
  active=host.dialog('active',{signal,video:true,muteControl:true,muted:true});await turn();
  assert.equal(windows.length,1,'Mute acknowledgement reuses the call window');
  assert.equal(window.messages.at(-1)[2].startedAt,state[2].startedAt);
  assert.equal(window.messages.at(-1)[2].muted,true);
  window.emit('close',{preventDefault(){}});assert.equal(await active,'end');
  host.dispose();assert.ok(window.destroyed);assert.equal(ipcMain.listenerCount('linux-call-action'),0);
  await assert.rejects(host.dialog('dialing',{signal}),/unavailable/);
  const incoming=create({BrowserWindow:Window,ipcMain});
  const consent=incoming.dialog('consent',{signal});await turn();
  const second=windows[1],id=second.messages.at(-1)[1];
  ipcMain.emit('linux-call-action',{sender:second.webContents},id,'answer');assert.equal(await consent,true);
  second.emit('close',{preventDefault(){}});
  assert.equal(await incoming.dialog('active',{signal,muteControl:true}),'end','Close during command/stage gap must not be lost');
  incoming.dispose();
  console.log('PASS persistent call window: stage transitions, ACK state, scoped actions, duration, close, consent, cleanup');
})().catch(error=>{console.error(error);process.exitCode=1;});
