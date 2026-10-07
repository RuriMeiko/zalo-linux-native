const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

for (const file of [
  'lazy/default-login-main-startup-shared-worker-znotification.9e3e92e88644da772301.js',
  'compact-app-pc.e08d0d44f38873747a6b.js',
  'search-worker.e08d0d44f38873747a6b.js',
]) {
  const source = fs.readFileSync(path.join(__dirname, '../pc-dist', file), 'utf8');
  const start = source.indexOf('        xwfN: function(');
  const end = source.indexOf('\n        },', start);
  assert.ok(start > 0 && end > start);
  const factory = source.slice(start + '        xwfN: '.length, end) + '\n        }';
  for (const [platform, arch, release, expected] of [
    ['linux', 'x64', '6.8.0', true], ['linux', 'x64', '7.0.0', true],
    ['linux', 'arm64', '7.0.0', false],
    ['darwin', 'x64', '18.0.0', false], ['darwin', 'arm64', '24.0.0', true],
  ]) {
    let selected;
    const load = () => ({a: {jxl: {osx_native_target: 19}}});
    load.d = (_, key, get) => {selected = get;};
    const context = {$znode: {os: {platform: () => platform, arch: () => arch,
      release: () => {assert.notEqual(platform, 'linux', 'Linux must not use a macOS version gate'); return release;}}}};
    vm.runInNewContext(`(${factory})`, context)({}, {}, load);
    assert.equal(selected()(), expected, `${file}: ${platform}/${arch}/${release}`);
  }
}
console.log('PASS native JXL selection in main, compact viewer and search bundles');
