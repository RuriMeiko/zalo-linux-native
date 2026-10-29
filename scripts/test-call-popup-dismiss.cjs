'use strict';
// Regression guard for the incoming-call popup: it must disappear when the
// remote party hangs up or the user presses the red button / window X, even
// while a dialog promise is still waiting.
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const createCallWindow = require('../native/android-zrtc/call-window.cjs');

const ipcMain = new EventEmitter();
const created = [];

class Window extends EventEmitter {
    constructor() {
        super();
        created.push(this);
        this.destroyed = false;
        this.messages = [];
        this.webContents = new EventEmitter();
        this.webContents.session = {setPermissionRequestHandler() {}, setPermissionCheckHandler() {}};
        this.webContents.setWindowOpenHandler = () => {};
        this.webContents.send = (channel, ...args) => this.messages.push([channel, ...args]);
    }
    async loadFile() {}
    show() {}
    focus() {}
    moveTop() {}
    flashFrame() {}
    setAlwaysOnTop() {}
    isDestroyed() { return this.destroyed; }
    destroy() { this.destroyed = true; }
}

const turn = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
const lastState = window => window.messages.filter(m => m[0] === 'linux-call-state').at(-1);
const click = (window, action) => ipcMain.emit('linux-call-action', {sender: window.webContents}, lastState(window)[1], action);

async function withWindow(fn) {
    created.length = 0;
    const host = createCallWindow({BrowserWindow: Window, ipcMain});
    try { await fn(host); }
    finally {
        host.dispose();
        for (const window of created) if (!window.isDestroyed()) window.destroy();
    }
}

(async () => {
    // 1. Remote hangup while the consent dialog waits: the owner calls clear();
    //    the window must be gone and the waiting promise must settle.
    await withWindow(async host => {
        const controller = new AbortController();
        const consent = host.dialog('consent', {signal: controller.signal});
        const rejected = assert.rejects(consent, /closed|canceled/);
        await turn();
        const window = created[0];
        assert.equal(window.isDestroyed(), false);
        host.dispose();
        await rejected;
        assert.equal(window.isDestroyed(), true, 'clear() must destroy the popup window');
    });

    // 2. Red end button with no dialog waiting (the remote already left): the
    //    click cannot be consumed by any promise, so the window closes itself.
    await withWindow(async host => {
        const controller = new AbortController();
        const dialing = host.dialog('dialing', {signal: controller.signal});
        const rejected = assert.rejects(dialing, /closed|canceled/);
        await turn();
        const window = created[0];
        controller.abort();
        await rejected;
        // The window survives a cancelled stage: the owner reuses it.
        click(window, 'end');
        await turn(1800);
        assert.equal(window.isDestroyed(), true, 'end with no pending dialog must close the popup');
    });

    // 3. Window X on a popup with no waiting dialog also closes it.
    await withWindow(async host => {
        await host.notifyIncoming({video: false});
        await turn();
        const window = created[0];
        assert.equal(window.isDestroyed(), false);
        window.emit('close', {preventDefault() {}});
        await turn(1800);
        assert.equal(window.isDestroyed(), true, 'X must close the popup, not defer forever');
    });

    // 4. A new incoming call must not inherit the previous "end" click.
    await withWindow(async host => {
        const controller = new AbortController();
        const dialing = host.dialog('dialing', {signal: controller.signal});
        const canceled = assert.rejects(dialing, /closed|canceled/);
        await turn();
        const window = created[0];
        controller.abort();              // owner cancels the stage, window is reused
        await canceled;
        click(window, 'end');            // no dialog waiting: arms the idle close
        await host.notifyIncoming({video: true});
        await turn(1800);
        assert.equal(window.isDestroyed(), false, 'idle close must be cancelled by the next call');
        const consent = host.dialog('consent', {signal: new AbortController().signal});
        await turn();
        click(window, 'answer');
        assert.equal(await consent, true, 'the next call can still be answered');
    });

    // 5. clear() during an active call drops the window and ends the loop.
    await withWindow(async host => {
        const controller = new AbortController();
        const active = host.dialog('active', {signal: controller.signal, muteControl: true});
        const rejected = assert.rejects(active, /closed|canceled/);
        await turn();
        const window = created[0];
        assert.equal(lastState(window)[2].kind, 'active');
        host.dispose();
        await rejected;
        assert.equal(window.isDestroyed(), true);
    });

    // 6. Mute is still an ordinary in-call action while the call is live.
    await withWindow(async host => {
        const controller = new AbortController();
        const active = host.dialog('active', {signal: controller.signal, muteControl: true});
        await turn();
        const window = created[0];
        click(window, 'toggle');
        assert.equal(await active, 'toggle', 'the mute button must still resolve');
        controller.abort();
    });

    console.log('PASS call popup dismissal: remote hangup clear, red end with no dialog, window X, no stale end click, active teardown');
})().catch(error => { console.error(error); process.exitCode = 1; });
