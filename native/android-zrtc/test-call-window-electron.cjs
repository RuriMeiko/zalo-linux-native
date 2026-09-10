'use strict';
// Isolated visual/control fixture. No Zalo profile, network, camera or mic.
const {app,BrowserWindow,ipcMain}=require('electron');
const path=require('node:path');
app.setPath('userData',path.join(app.getPath('home'),'zalo-native-recovery','call-window-fixture-profile'));
app.whenReady().then(async()=>{
  const create=require('./call-window.cjs');
  const host=create({BrowserWindow,ipcMain}),controller=new AbortController();
  const timeout=setTimeout(()=>{controller.abort();host.dispose();app.exit(1);},180000);
  try {
    const accepted=await host.dialog('consent',{signal:controller.signal,video:true});
    if(!accepted)throw new Error('Fixture was not answered');
    let muted=false,toggles=0;
    for(;;) {
      const action=await host.dialog('active',{signal:controller.signal,video:true,muteControl:true,muted});
      if(action==='end')break;
      muted=!muted;toggles++;
    }
    if(toggles<2)throw new Error('Fixture requires mute and unmute');
    console.log('PASS Electron call window: consent, persistent mute/unmute controls, end (synthetic ACK, no media)');
    host.dispose();clearTimeout(timeout);app.quit();
  } catch(error){host.dispose();clearTimeout(timeout);console.error(error.message);app.exit(1);}
});
