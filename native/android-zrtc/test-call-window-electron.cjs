'use strict';
// Isolated visual/control fixture. No Zalo profile, network, camera or mic.
const {app,BrowserWindow,ipcMain}=require('electron');
const path=require('node:path');
app.setPath('userData',path.join(app.getPath('home'),'zalo-native-recovery','call-window-fixture-profile'));
app.whenReady().then(async()=>{
  const {Duplex}=require('node:stream');
  function pair(){let a,b;
    a=new Duplex({read(){},write(chunk,_encoding,done){b.push(Buffer.from(chunk));done();},destroy(error,done){b.push(null);done(error);}});
    b=new Duplex({read(){},write(chunk,_encoding,done){a.push(Buffer.from(chunk));done();},destroy(error,done){a.push(null);done(error);}});
    return [a,b];
  }
  const [controlClient,controlHost]=pair(),[videoClient,videoHost]=pair();
  const host=require('./desktop-call-window.cjs')(controlHost,videoHost,{BrowserWindow,ipcMain},{locked:false});
  const client=require('./call-ui-pipe.cjs').createCallUIClient(controlClient);
  const video=require('./video-pipe.cjs').createVideoPipeSink(videoClient),controller=new AbortController();
  const timeout=setTimeout(()=>{controller.abort();host.dispose();app.exit(1);},180000);
  try {
    const accepted=await client.dialog('consent',{signal:controller.signal,video:true});
    if(!accepted)throw new Error('Fixture was not answered');
    let muted=false,toggles=0;
    for(;;) {
      const actionTask=client.dialog('active',{signal:controller.signal,video:true,muteControl:true,muted});
      if(toggles===0)await video.render({format:'I420',width:4,height:4,sequence:1n,
        pixels:Buffer.from([50,90,150,210,50,90,150,210,50,90,150,210,50,90,150,210,90,90,180,180,150,150,80,80])});
      const action=await actionTask;
      if(action==='end')break;
      muted=!muted;toggles++;
    }
    if(toggles<2)throw new Error('Fixture requires mute and unmute');
    await video.clear();await client.clear();
    console.log('PASS Electron call window over control/video pipes: consent, synthetic I420, persistent mute/unmute, end (no live media)');
    host.dispose();clearTimeout(timeout);app.quit();
  } catch(error){host.dispose();clearTimeout(timeout);console.error(error.message);app.exit(1);}
});
