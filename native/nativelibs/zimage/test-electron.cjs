'use strict';
// Real Electron nativeImage; synthetic pixels only, no account or windows.
const assert=require('node:assert/strict');
const {app,nativeImage}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const parent=path.join(app.getPath('home'),'zalo-native-recovery');fs.mkdirSync(parent,{recursive:true});
app.setPath('userData',fs.mkdtempSync(path.join(parent,'zimage-fixture-')));
app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
  const {Image}=await require('./index.js')(null);
  for(const [width,height,boundW,boundH,expected] of [
    [80,40,20,20,{width:20,height:10}],
    [40,80,20,20,{width:10,height:20}],
    [80,40,60,10,{width:20,height:10}],
    [8,4,20,20,{width:8,height:4}],
  ])for(const format of ['png','jpeg']) {
    const source=nativeImage.createFromBitmap(Buffer.alloc(width*height*4,255),{width,height}).toPNG();
    const output=await Image.thumbnail(source,boundW,boundH,format,80);
    assert.deepEqual(nativeImage.createFromBuffer(output).getSize(),expected,`${format} ${width}x${height} inside ${boundW}x${boundH}`);
  }
  await assert.rejects(Image.thumbnail(Buffer.from('not an image'),20,20,'png',80));
  console.log('PASS real Electron zimage: landscape/portrait/rectangular bounds, no enlargement, PNG/JPEG decode and invalid input');
  app.exit(0);
}).catch(error=>{console.error(error.message);app.exit(1);});
