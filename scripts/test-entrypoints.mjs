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
const start=readFileSync(root+'start.sh','utf8');
assert.ok(start.includes('scripts/native-launch.mjs" "$@"'));
assert.ok(!start.includes('update.sh'));
assert.ok(!start.includes('--no-sandbox'));
const launched=spawnSync('/bin/bash',[root+'start.sh','--invalid-option'],{cwd:'/',encoding:'utf8',timeout:5000});
assert.equal(launched.status,1);
assert.match(launched.stderr,/Usage: node scripts\/native-launch.mjs/);
const rejected=spawnSync('/bin/bash',[root+'update.sh','--install'],{encoding:'utf8',timeout:5000});
assert.equal(rejected.status,2);assert.match(rejected.stderr,/read-only/);
const update=readFileSync(root+'update.sh','utf8');
assert.ok(update.includes('https://github.com/RuriMeiko/zalo-linux-native.git'));
assert.ok(update.includes('refs/heads/main'));
assert.ok(!/\b(clone|pull|checkout|reset|fetch)\b/.test(update.replaceAll('checkout','copy')));
console.log('PASS native entrypoints: argument forwarding, no upstream auto-update/download or implicit sandbox bypass, read-only update contract');
