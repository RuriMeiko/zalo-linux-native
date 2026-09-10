const assert=require('node:assert/strict');
const {Duplex}=require('node:stream');
const {EventEmitter}=require('node:events');
const {createCallUIClient}=require('./call-ui-pipe.cjs');
const {createVideoPipeSink}=require('./video-pipe.cjs');
const attach=require('./desktop-call-window.cjs');
function pair(){let a,b;
  a=new Duplex({read(){},write(chunk,_encoding,done){b.push(Buffer.from(chunk));done();},destroy(error,done){b.push(null);done(error);}});
  b=new Duplex({read(){},write(chunk,_encoding,done){a.push(Buffer.from(chunk));done();},destroy(error,done){a.push(null);done(error);}});
  return [a,b];
}
const ipcMain=new EventEmitter(),windows=[];
class Window extends EventEmitter {
  constructor(){super();windows.push(this);this.messages=[];this.webContents=new EventEmitter();
    this.webContents.session={setPermissionRequestHandler(){},setPermissionCheckHandler(){}};
    this.webContents.setWindowOpenHandler=()=>{};
    this.webContents.send=(channel,...args)=>{
      this.messages.push([channel,...args]);
      if(channel==='linux-call-frame')ipcMain.emit('linux-call-painted',{sender:this.webContents},args[0],true);
    };
  }
  async loadFile(){}
  show(){}
  destroy(){this.destroyed=true;}
  isDestroyed(){return !!this.destroyed;}
}
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function act(window,action){const state=window.messages.filter(m=>m[0]==='linux-call-state').at(-1);
  ipcMain.emit('linux-call-action',{sender:window.webContents},state[1],action);
}
const watchdog=setTimeout(()=>{console.error('FAIL unified call pipe test stalled');process.exit(1);},10000);
(async()=>{
  const [clientStream,hostStream]=pair(),[videoClient,videoHost]=pair();
  const host=attach(hostStream,videoHost,{BrowserWindow:Window,ipcMain},{locked:false});
  const client=createCallUIClient(clientStream),video=createVideoPipeSink(videoClient);
  const dialingAbort=new AbortController();
  const dialing=client.dialog('dialing',{signal:dialingAbort.signal,video:true});
  const aborted=assert.rejects(dialing,/canceled/);await turn();
  assert.equal(windows.length,1,'Dialing opens before any frame');
  dialingAbort.abort();await aborted;
  const signal=new AbortController().signal;
  let active=client.dialog('active',{signal,video:true,muteControl:true,muted:false});await turn();
  await video.render({format:'I420',width:2,height:2,sequence:1n,pixels:Buffer.alloc(6,128)});
  assert.equal(windows.length,1,'Video renders in the existing call window');
  assert.ok(windows[0].messages.some(m=>m[0]==='linux-call-frame'));
  act(windows[0],'toggle');assert.equal(await active,'toggle');
  active=client.dialog('active',{signal,video:true,muteControl:true,muted:true,cameraControl:true,cameraEnabled:true});await turn();
  act(windows[0],'camera');assert.equal(await active,'camera');
  active=client.dialog('active',{signal,video:true,muteControl:true,muted:true,cameraControl:true,cameraEnabled:false});await turn();
  assert.equal(windows[0].messages.filter(m=>m[0]==='linux-call-state').at(-1)[2].cameraEnabled,false);
  act(windows[0],'end');assert.equal(await active,'end');
  await video.clear();assert.ok(!windows[0].destroyed,'Frame clear cannot destroy controls before owner cleanup');
  await client.clear();assert.ok(windows[0].destroyed);
  const consent=client.dialog('consent',{signal});await turn();act(windows[1],'answer');assert.equal(await consent,true);
  active=client.dialog('active',{signal,muteControl:true});const locked=assert.rejects(active,/unavailable/);await turn();
  host.setLocked(true);await locked;assert.ok(windows[1].destroyed);
  await client.clear();await assert.rejects(client.dialog('dialing',{signal}),/unavailable/);
  host.setLocked(false);await client.clear();
  active=client.dialog('active',{signal,muteControl:true});const disconnected=assert.rejects(active,/closed/);await turn();
  host.dispose();await disconnected;video.close();client.close();
  assert.equal(ipcMain.listenerCount('linux-call-action'),0);assert.equal(ipcMain.listenerCount('linux-call-painted'),0);
  // Oversize/unrecognized protocol input must fail closed without opening UI.
  const [bad,receiver]=pair();let created=0;
  const badHost=require('./call-ui-pipe.cjs').attachCallUIHost(receiver,()=>{created++;throw Error();});
  bad.write('x'.repeat(4097));await turn();assert.ok(receiver.destroyed);assert.equal(created,0);badHost.dispose();bad.destroy();
  console.log('PASS unified call pipes: pre-frame dialing, shared video window, mute/end, stage cancellation, clear/reuse, lock, disconnect, bounded input');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>clearTimeout(watchdog));
