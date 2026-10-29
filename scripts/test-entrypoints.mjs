import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const name of ['start.sh','update.sh']) {
  const script=readFileSync(root+name,'utf8');
  assert.equal(spawnSync('/bin/bash',['-n',root+name]).status,0);
  assert.ok(!script.includes('/tmp/'));
  assert.ok(!script.includes('realdtn2/'));
  assert.ok(!/\b(rm|sudo|wget|unzip|mkfifo)\b/.test(script));
}
const schema=readFileSync(root+'scripts/test-native-call-schema.sh','utf8');
assert.equal(spawnSync('/bin/bash',['-n',root+'scripts/test-native-call-schema.sh']).status,0);
assert.ok(!schema.includes('/home/'+'rurimeiko/'));
assert.ok(!schema.includes('/tmp/'));
const schemaUsage=spawnSync('/bin/bash',[root+'scripts/test-native-call-schema.sh'],{encoding:'utf8'});
assert.equal(schemaUsage.status,1);assert.match(schemaUsage.stderr,/Usage:/);
const start=readFileSync(root+'start.sh','utf8');
assert.ok(start.includes('scripts/native-launch.mjs" "$@"'));
assert.ok(!start.includes('update.sh'));
assert.ok(!start.includes('--no-sandbox'));
const launched=spawnSync('/bin/bash',[root+'start.sh','--invalid-option'],{cwd:'/',encoding:'utf8',timeout:5000});
assert.equal(launched.status,1);
assert.match(launched.stderr,/Usage: node scripts\/native-launch.mjs/);
// update.sh installs and updates; an unknown flag is still a usage error.
const rejected=spawnSync('/bin/bash',[root+'update.sh','--install'],{encoding:'utf8',timeout:5000});
assert.equal(rejected.status,2);assert.match(rejected.stderr,/unknown option/);
const update=readFileSync(root+'update.sh','utf8');
assert.ok(update.includes('https://github.com/RuriMeiko/zalo-linux-native.git'));
assert.ok(update.includes('scripts/update-native.mjs'));
assert.ok(update.includes('--rollback'));
// It must never destroy a checkout that holds local work.
assert.ok(!update.includes('reset --hard'));
assert.ok(update.includes('status --porcelain'));
// The wrapper fetches and checks out the project on purpose, but must never
// force-reset a tree that holds local changes (guarded above).
assert.ok(/git -C "\$ZALO_REPO_DIR" fetch/.test(update));
assert.ok(!/reset --hard/.test(update));
const legacyPackage=readFileSync(root+'build-appimage.sh','utf8');
assert.equal(spawnSync('/bin/bash',['-n',root+'build-appimage.sh']).status,0);
assert.ok(!/\b(wget|curl|unzip|rm|sudo)\b/.test(legacyPackage));
const guardedPackage=spawnSync('/bin/bash',[root+'build-appimage.sh'],{encoding:'utf8',timeout:5000});
assert.equal(guardedPackage.status,2);assert.match(guardedPackage.stderr,/disabled/);
assert.match(legacyPackage,/build-native-appdir\.mjs/);
console.log('PASS native entrypoints: argument forwarding, no upstream auto-update/download or implicit sandbox bypass, install-or-update wrapper that never resets a dirty checkout');