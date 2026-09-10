const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const file = path.join(__dirname, '../pc-dist/linux-extras/viewer.js');
const source = fs.readFileSync(file, 'utf8');
const loader = fs.readFileSync(path.join(__dirname, '../pc-dist/linux-extras/loader.js'), 'utf8');
for (const html of ['compact-app.html','popup-viewer.html'])
  assert.ok(fs.readFileSync(path.join(__dirname, '../pc-dist', html), 'utf8').includes('<script src="linux-extras/loader.js"></script>'),
    `${html} must load viewer actions directly`);
assert.ok(loader.includes('.media-viewer__footer action-group'));
assert.ok(source.includes('cont.querySelector("action-group, .action-group")'));
const cut = source.indexOf('  // src/index.js');
assert.ok(cut > 0);
let locked = false, removed = 0, printed = 0, iframe, image;
const timers = new Map();
const body = {appendChild(element) {element.parentNode = body;}, removeChild(element) {element.parentNode = null; removed++;}};
const document = {
  querySelector() {return locked ? {} : null;}, body,
  createElement(type) {
    assert.equal(type, 'iframe');
    image = {};
    const listeners = new Map();
    iframe = {setAttribute() {}, contentWindow: {
      document: {open() {}, write(html) {assert.ok(html.includes('@page{size:A4 portrait;margin:10mm;'));}, close() {}, getElementById() {return image;}},
      focus() {}, print() {printed++;},
      addEventListener(name, fn) {listeners.set(name, fn);}, removeEventListener(name) {listeners.delete(name);},
      finish() {listeners.get('afterprint')?.();}
    }};
    return iframe;
  }
};
const context = {document, window: {}, console,
  setTimeout(fn) {const id = Symbol(); timers.set(id, fn); return id;}, clearTimeout(id) {timers.delete(id);}};
vm.runInNewContext(source.slice(0, cut) + 'globalThis.testAPI = {print: require_print(), layout: require_print_layout()};})();', context);
const {print, layout} = context.testAPI;
print.doPrint('data:image/png;base64,fixture');
assert.equal(timers.size, 1);
image.onload();
assert.equal(printed, 1);
assert.equal(timers.size, 0);
assert.equal(removed, 0, 'Do not destroy print content while native dialog is open');
iframe.contentWindow.finish();
assert.equal(removed, 1);
iframe.contentWindow.finish();
assert.equal(removed, 1);
print.doPrint('fixture'); image.onerror();
assert.equal(removed, 2); assert.equal(timers.size, 0);
print.doPrint('fixture'); locked = true; image.onload();
assert.equal(printed, 1); assert.equal(removed, 3);
print.doPrint('fixture'); assert.equal(removed, 3);
locked = false;
assert.throws(() => print.doPrint('fixture', {size: 'A4;bad', orient: 'portrait', fit: 'contain', marginMm: 10, border: false}), /Invalid print settings/);
assert.throws(() => print.doPrint('fixture', {size: 'A4', orient: 'portrait', fit: 'contain', marginMm: NaN, border: false}), /Invalid print settings/);
const portrait = layout.computePageBox('A4', 'portrait', 700, 460);
const landscape = layout.computePageBox('A4', 'landscape', 700, 460);
assert.ok(portrait.h > portrait.w && landscape.w > landscape.h);
assert.ok(portrait.w <= 700 && portrait.h <= 460 && landscape.w <= 700 && landscape.h <= 460);
console.log('PASS actual viewer print module: dialog lifetime, image failure, lock guard, settings validation, page dimensions');
