// Execute the actual bundled titlebar class with boundary stubs, no account.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const shared = process.argv.includes('--shared');
const source = fs.readFileSync(path.join(root, shared ? 'pc-dist/lazy/default-login-main-startup-shared-worker-znotification.9e3e92e88644da772301.js' : 'pc-dist/compact-app-pc.e08d0d44f38873747a6b.js'), 'utf8');
const moduleStart = source.indexOf('y1FZ: function');
const start = source.indexOf(shared ? 'class C extends' : 'class R extends', moduleStart);
const end = source.indexOf(shared ? 't.b = Object(I.e)' : 't.b = Object(v.e)', start);
assert.ok(moduleStart > 0 && end > start);
const calls = [];
const react = {Component: class {}, Fragment: 'fragment', createElement: (type, props, ...children) => ({type, props: props || {}, children})};
const context = {
  window: {$zenv: {isPreloaded: true}},
  r: {a: react}, o: {a: 'fragment'}, a: {a: Object.assign}, S: false,
  f: {b: value => value}, I: {a: 'account-extra', c: 'existing-menu'},
  A: {default: {logAction() {}}}, l: {default: {stopKeepingAlive() {calls.push('stop-activity');}}},
  u: {GeneralActions: {APP_LOCK_STATUS_CHANGED: 'lock'}},
  h: {ModalManagerV2: {openModal: value => calls.push(value)}},
  g: {ModalIdentitiesDefine: {SET_APP_LOCK: 'set-passcode'}}, T: {c: 'main'}
};
if (shared) Object.assign(context, {
  i: context.r, r: context.o, E: context.f, v: context.I,
  u: context.A, A: context.u, _: context.g, R: context.T
});
const Header = vm.runInNewContext(`(${source.slice(start, end).trim()})`, context);
const header = Object.create(Header.prototype);
header.props = {user: {zaloName: 'Test account'}, status: {isSetPassCode: false},
  closeActivityWhenLock: () => calls.push('close-viewers'), dispatch: value => calls.push(value)};
header.state = {isFocus: true, isMaximized: false, pendingUpdate: false};
const flatten = node => !node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flatMap(flatten)];
const buttons = () => flatten(header.render()).filter(node => node.type === 'button');
assert.equal(buttons().length, 4);
assert.ok(flatten(header.render()).some(node => node.children.includes('Zalo - Test account')));
buttons()[0].props.onClick({stopPropagation() {}});
assert.equal(calls[0].name, 'set-passcode');
calls.length = 0;
header.props.status.isSetPassCode = true;
buttons()[0].props.onClick({stopPropagation() {}});
assert.deepEqual(calls.slice(0, 2), ['close-viewers', 'stop-activity']);
assert.equal(calls[2].type, 'lock');
assert.equal(calls[2].payload.isAppLock, true);
header.props.status.isAppLock = true;
assert.equal(buttons().length, 3);
header.props.loginMode = true;
assert.equal(buttons()[1].props.disabled, true);
header.props.loginMode = false;
header.props.isPopupWindow = true;
assert.equal(buttons().length, 3);
header.props.isPopupWindow = false;
header.props.className = 'image-show__title MediaViewer';
header.props.title = 'Ảnh kiểm thử';
header.props.onClose = () => calls.push('close-image-only');
header.props.status.isAppLock = false;
assert.equal(buttons().length, 3, 'image viewer must retain all window controls without lock button');
assert.ok(flatten(header.render()).some(node => node.children.includes('Ảnh kiểm thử')));
for (const button of buttons()) {
  assert.equal(button.children[0].type, 'svg', 'window symbols must not depend on font glyphs');
  assert.equal(button.children[0].props.viewBox, '0 0 16 16');
}
buttons().find(button => button.props['aria-label'] === 'Đóng cửa sổ').props.onClick({stopPropagation() {}});
assert.equal(calls.at(-1), 'close-image-only');
header.state.isMaximized = true;
assert.ok(buttons().some(button => button.props['aria-label'] === 'Khôi phục'));
const css = flatten(header.render()).find(node => node.type === 'style').children.join('');
assert.ok(css.includes('width:30px;height:30px'));
assert.ok(css.includes('-webkit-app-region:no-drag'));
assert.ok(css.includes('#titleBar.image-show__title{height:46px;min-height:46px'));
assert.ok(css.includes('.media-viewer .media-viewer__title-bar{height:46px;min-height:46px'));
if (process.argv.includes('--html')) {
  header.state.isMaximized = false;
  const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  const render = node => {
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node !== 'object') return escape(node);
    if (node.type === 'fragment') return node.children.map(render).join('');
    if (node.type === 'style') return '<style>' + node.children.join('') + '</style>';
    const attributes = Object.entries(node.props).filter(([key]) => !key.startsWith('on') && key !== 'style').map(([key,value]) => {
      const name = ({className:'class',strokeWidth:'stroke-width',strokeLinecap:'stroke-linecap',strokeLinejoin:'stroke-linejoin'})[key] || key;
      return typeof value === 'boolean' ? value ? ` ${name}` : '' : ` ${name}="${escape(value)}"`;
    }).join('');
    return `<${node.type}${attributes}>${node.children.map(render).join('')}</${node.type}>`;
  };
  const cssFiles = fs.readdirSync(path.join(root,'pc-dist')).filter(name => name.endsWith('.css'));
  process.stdout.write('<!doctype html><meta charset="utf-8"><title>Header regression fixture</title>' +
    cssFiles.map(name => `<link rel="stylesheet" href="file://${root}/pc-dist/${name}">`).join('') +
    '<style>body{margin:0;background:#222;color:white}.fixture{width:800px;margin:40px auto;border:1px solid #555}.fixture-content{height:160px;display:grid;place-items:center}</style>' +
    '<div class="fixture media-viewer"><div class="media-viewer__title-bar">' + render(header.render()) +
    '</div><div class="fixture-content">Ảnh kiểm thử — không có dữ liệu tài khoản</div></div>');
} else console.log(`PASS ${shared ? 'shared/login' : 'compact'} Linux header: account title, controls, existing passcode/lock actions, login/locked/popup guards`);
