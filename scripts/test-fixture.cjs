'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
module.exports=function testFixture(prefix) {
  if(!/^[a-z0-9-]+$/.test(prefix))throw new Error('Invalid fixture prefix');
  const parent=path.join(os.homedir(),'zalo-native-recovery');
  fs.mkdirSync(parent,{recursive:true});
  return fs.mkdtempSync(path.join(parent,prefix+'-'));
};
