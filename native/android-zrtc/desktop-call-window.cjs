'use strict';
const {attachCallUIHost}=require('./call-ui-pipe.cjs');
const {attachVideoPipeReceiver}=require('./video-pipe.cjs');
const createWindow=require('./call-window.cjs');
module.exports=function attachDesktopCallWindow(controlStream,videoStream,electron,options) {
  const host=attachCallUIHost(controlStream,()=>createWindow(electron),options);
  const receiver=videoStream?attachVideoPipeReceiver(videoStream,{render:frame=>host.render(frame),clear:()=>host.clearVideo()}):null;
  if(videoStream) {
    videoStream.once('close',()=>host.dispose());videoStream.once('end',()=>host.dispose());
  }
  controlStream.once('close',()=>receiver?.close());
  return {setLocked:host.setLocked,dispose(){host.dispose();receiver?.close();}};
};
