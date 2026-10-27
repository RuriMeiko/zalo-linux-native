'use strict';
// Guards the Ctrl+V image path: one paste event must produce exactly one image.
//
// Two upload paths exist for a pasted picture:
//   * Zalo's own _callPasteData, which reads clipboardData.files from the event;
//   * the preload shim, which converts the native clipboard bitmap into a File
//     and dispatches a synthetic drop on #dragOverlayInputbox.
//
// The shim must only act when the event carries no image file. When it acted
// anyway, one Ctrl+V produced two images: Zalo uploaded the real file (7858
// bytes in the captured trace) next to the shim's re-encoded copy (153 bytes).
//
// The shim decides in the capture phase on document, so the payload it inspects
// is the same one Zalo later sees.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PRELOAD = path.join(__dirname, '..', 'main-dist', 'preload-render.js');

function loadShim({native = {}, dropTarget = true} = {}) {
    const source = fs.readFileSync(PRELOAD, 'utf8');
    const end = source.indexOf('__ZaBUNDLENAME__');
    assert.ok(end > 0, 'shim block must stay at the top of the preload');
    const shim = source.slice(0, end);

    const listeners = [];
    const dropped = [];
    const overlay = {
        style: {},
        dispatchEvent(event) { if (event.type === 'drop') dropped.push(event); return true; },
    };
    const target = {
        closest(selector) { return selector === '#chatView' ? {} : null; },
    };
    const document = {
        getElementById(id) { return id === 'dragOverlayInputbox' && dropTarget ? overlay : null; },
        addEventListener(type, handler, capture) { listeners.push({type, handler, capture}); },
    };
    class FakeEvent {
        constructor(type, init = {}) {
            this.type = type;
            this.clipboardData = init.clipboardData || init.dataTransfer;
            this.dataTransfer = init.dataTransfer;
            this.defaultPrevented = false;
            this.immediateStopped = false;
        }
        preventDefault() { this.defaultPrevented = true; }
        stopImmediatePropagation() { this.immediateStopped = true; }
    }
    const window = {
        addEventListener(type, handler) { if (type === 'DOMContentLoaded') this.ready = handler; },
        $zelectronNative: native,
    };
    const context = {
        window, document, console,
        File: class File { constructor(parts, name, options = {}) { this.name = name; this.type = options.type; } },
        DataTransfer: class DataTransfer { constructor() { this.items = {add: () => { this.count = (this.count || 0) + 1; }}; } },
        DragEvent: class DragEvent extends FakeEvent {},
        atob: s => Buffer.from(s, 'base64').toString('binary'),
        fetch: async () => ({blob: async () => ({type: 'image/png'})}),
        require: (name) => name === 'fs' ? {readdirSync: () => [], unlinkSync() {}} : require(name),
        $zelectronNative: native,
    };
    vm.createContext(context);
    vm.runInContext(shim, context, {filename: PRELOAD});
    window.ready();
    const paste = listeners.find(l => l.type === 'paste' && l.capture);
    assert.ok(paste, 'capture-phase paste listener must be registered');
    return {paste: paste.handler, dropped, overlay, FakeEvent, target, listeners};
}

const pngBase64 = Buffer.from('not-a-real-png').toString('base64');
const bitmaps = {getClipboardImagePNG: () => pngBase64};
// insertClipboardImage() is async (it awaits fetch for a file path), so a drop
// lands on a later tick. Flush before asserting on it.
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

(async () => {
// 1. The event already carries the image file (the common Linux case for a real
//    screenshot or a copied file): Zalo uploads it, the shim must stay out.
//    Before the fix the shim also dropped its own copy, so the picture appeared
//    twice.
{
    const {paste, dropped, FakeEvent, target} = loadShim({native: bitmaps});
    const file = {type: 'image/png', name: 'image.png', size: 7858};
    const event = new FakeEvent('paste', {dataTransfer: {files: [file], items: [{kind: 'file', type: 'image/png'}], types: ['Files']}});
    event.target = target;
    paste(event);
    assert.equal(event.defaultPrevented, false, 'Zalo must keep its own upload');
    assert.equal(event.immediateStopped, false, 'Zalo\'s listener must still run');
    await settle();
    assert.equal(dropped.length, 0, 'the shim must not add a second image');
}

// 2. Bitmap-only clipboard (copy from a page that offers no file): the shim is
//    the only way the picture reaches the composer, so it must insert exactly one.
{
    const {paste, dropped, FakeEvent, target} = loadShim({native: bitmaps});
    const event = new FakeEvent('paste', {dataTransfer: {files: [], items: [], types: ['image/png']}});
    event.target = target;
    paste(event);
    assert.equal(event.defaultPrevented, true, 'the shim owns this paste');
    assert.equal(event.immediateStopped, true, 'Zalo must not also poll the clipboard');
    await settle();
    assert.equal(dropped.length, 1, 'exactly one synthetic drop');
}

// 3. One gesture can reach several capture listeners; only the first may insert.
{
    const {paste, dropped, FakeEvent, target} = loadShim({native: bitmaps});
    const first = new FakeEvent('paste', {dataTransfer: {files: [], items: [], types: ['image/png']}});
    first.target = target; paste(first);
    const second = new FakeEvent('paste', {dataTransfer: {files: [], items: [], types: ['image/png']}});
    second.target = target; paste(second);
    await settle();
    assert.equal(dropped.length, 1, 'one Ctrl+V must never insert two images');
}

// 4. Text-only paste is never hijacked.
{
    const {paste, dropped, FakeEvent, target} = loadShim({native: {getClipboardImagePNG: () => null}});
    const event = new FakeEvent('paste', {dataTransfer: {files: [], items: [], types: ['text/plain'], getData: () => 'hello'}});
    event.target = target;
    paste(event);
    assert.equal(event.defaultPrevented, false);
    await settle();
    assert.equal(dropped.length, 0);
}

// 5. Mixed clipboard (text plus a bitmap, copying from a document): Zalo keeps
//    it, otherwise the text half would be silently dropped.
{
    const {paste, dropped, FakeEvent, target} = loadShim({native: bitmaps});
    const data = {files: [], items: [], types: ['text/plain', 'image/png'], getData: () => 'some copied text'};
    const event = new FakeEvent('paste', {clipboardData: data, dataTransfer: data});
    event.target = target;
    paste(event);
    assert.equal(event.defaultPrevented, false, 'the text payload must survive');
    await settle();
    assert.equal(dropped.length, 0);
}

// 6. Pastes outside the chat view (search box, dialogs) are left alone.
{
    const {paste, dropped, FakeEvent} = loadShim({native: bitmaps});
    const event = new FakeEvent('paste', {dataTransfer: {files: [], items: [], types: ['image/png']}});
    event.target = {closest: () => null};
    paste(event);
    assert.equal(event.defaultPrevented, false);
    await settle();
    assert.equal(dropped.length, 0);
}

// 7. A clipboard file path (copied file in a file manager) is handled when the
//    event carries no file, and ignored when the extension is not an image.
{
    const {paste, dropped, FakeEvent, target} = loadShim({
        native: {getClipboardImagePNG: () => null, getClipboardFilePath: () => '/tmp/holiday.png'},
    });
    const event = new FakeEvent('paste', {dataTransfer: {files: [], items: [], types: []}});
    event.target = target;
    paste(event);
    assert.equal(event.defaultPrevented, true, 'a copied image file is inserted');
    await settle();
    assert.equal(dropped.length, 1);

    const text = loadShim({native: {getClipboardImagePNG: () => null, getClipboardFilePath: () => '/tmp/notes.txt'}});
    const plain = new text.FakeEvent('paste', {dataTransfer: {files: [], items: [], types: []}});
    plain.target = text.target;
    text.paste(plain);
    assert.equal(plain.defaultPrevented, false, 'a non-image file path is left to Zalo');
    await settle();
    assert.equal(text.dropped.length, 0);
}

// 8. The drop target is optional: without it nothing is dispatched and nothing throws.
{
    const {paste, dropped, FakeEvent, target} = loadShim({native: bitmaps, dropTarget: false});
    const event = new FakeEvent('paste', {dataTransfer: {files: [], items: [], types: ['image/png']}});
    event.target = target;
    paste(event);
    await settle();
    assert.equal(dropped.length, 0, 'no overlay, no drop');
}

// 9. A missing native bridge must not break pasting.
{
    const {paste, dropped, FakeEvent, target} = loadShim({native: null});
    const event = new FakeEvent('paste', {dataTransfer: {files: [], items: [], types: []}});
    event.target = target;
    paste(event);
    await settle();
    assert.equal(dropped.length, 0);
}

})();

console.log('PASS clipboard paste shim: an event that already carries an image file is left to Zalo (no second upload), bitmap-only and file-path clipboards get exactly one synthetic drop, text/mixed/outside-chat pastes untouched');