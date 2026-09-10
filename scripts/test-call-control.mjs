#!/usr/bin/env node
// Deterministic control/UI lifecycle checks only: no live account, camera,
// microphone, GUI process or native runtime is required by these fixtures.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(process.argv.length!==2)throw new Error('Usage: node scripts/test-call-control.mjs');
const tests=[
  'native/qt-call-cap-linux/test-native-identity.js',
  'native/qt-call-cap-linux/test-desktop-signaling.js',
  'native/qt-call-cap-linux/test-outgoing-setup.js',
  'native/android-zrtc/test-incoming-video-control.mjs',
  'native/android-zrtc/test-incoming-answer-session.mjs',
  'native/android-zrtc/test-incoming-call-owner.mjs',
  'native/android-zrtc/test-native-call-ui.mjs',
  'native/android-zrtc/test-video-media-session.mjs',
  'native/android-zrtc/test-incoming-desktop.mjs',
  'native/android-zrtc/test-incoming-desktop-owner.mjs',
  'scripts/test-video-lock-bridge.cjs',
  'scripts/test-native-launch.mjs',
];
for(const test of tests) {
  const result=spawnSync(process.execPath,[path.join(root,test)],{cwd:root,stdio:'inherit',timeout:60000});
  if(result.error || result.signal || result.status!==0) {
    console.error(`FAIL ${test}`);process.exit(1);
  }
}
console.log(`PASS ${tests.length} call control/lifecycle suites; live two-account media acceptance is separate`);
