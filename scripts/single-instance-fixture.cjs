'use strict';
// Fixture only: no production bootstrap/migration, account, window or media.
const {app}=require('electron');
const path=require('node:path');
const profile=process.env.ZALO_INSTANCE_FIXTURE_PROFILE;
if(!profile || !path.isAbsolute(profile) || !profile.includes('/zalo-native-recovery/instance-fixture-'))app.exit(2);
app.setPath('userData',profile);
app.disableHardwareAcceleration();
const held=app.requestSingleInstanceLock();
console.log(held?'FIXTURE_HELD':'FIXTURE_DENIED');
if(!held)app.exit(0);
else if(process.argv.includes('--probe-only')) {
  app.releaseSingleInstanceLock();app.exit(0);
} else {
  app.on('second-instance',()=>console.log('FIXTURE_SECOND_INSTANCE'));
  app.whenReady().then(()=>setInterval(()=>{},1000));
}
