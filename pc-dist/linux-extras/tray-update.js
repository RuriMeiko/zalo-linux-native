// Linux-only tray entry: "Kiểm tra cập nhật" between "Mở Zalo" and "Thoát".
//
// Zalo builds its tray menu once from a template (main-dist/compact-app.js) and calls
// Tray#setContextMenu. Patching that bundle would break on every upstream update, so this
// module wraps the public Electron API instead: Tray#setContextMenu is replaced with a
// version that rebuilds menus still containing the untouched "Mở Zalo"/"Thoát" pair and
// splices one extra item after "Mở Zalo". bootstrap.js loads this file before
// main-dist/compact-app, so the prototype is already patched when Zalo creates its Tray.
// CommonJS on purpose: Electron 22 embeds Node 16, which cannot require() an .mjs file.
'use strict';
const {spawn} = require('node:child_process');
const {access} = require('node:fs/promises');
const path = require('node:path');

const MENU_LABEL = 'Kiểm tra cập nhật';
const OPEN_LABEL = 'Mở Zalo';
const QUIT_LABEL = 'Thoát';
const INSTALLED_MARKER = 'INSTALL-COMPLETE.json';
const EXIT = {OK: 0, UPDATE_AVAILABLE: 10, RUNNING: 3};

// Only menus that still carry Zalo's own anchors are touched, so unrelated context
// menus (chat bubbles, image viewers) are never rewritten.
function isZaloMenu(template) {
  if (!Array.isArray(template)) return false;
  const labels = template.map(item => item && item.label);
  const open = labels.indexOf(OPEN_LABEL), quit = labels.indexOf(QUIT_LABEL);
  if (open < 0 || quit < 0 || quit < open) return false;
  return !labels.includes(MENU_LABEL);
}

// Pure builder so the insertion point is testable without Electron.
function insertUpdateItem(template, options) {
  const opts = options || {};
  const label = opts.label || MENU_LABEL;
  if (!Array.isArray(template)) throw new TypeError('Menu template must be an array');
  if (typeof opts.click !== 'function') throw new TypeError('Menu item needs a click handler');
  if (!isZaloMenu(template)) return template.slice();
  const open = template.findIndex(item => item && item.label === OPEN_LABEL);
  const out = template.slice();
  out.splice(open + 1, 0, {label, click: opts.click, enabled: opts.enabled !== false});
  return out;
}

function describeResult(code, signal, stdout) {
  if (signal) return {ok: false, title: MENU_LABEL, body: 'Không kiểm tra được: tiến trình bị dừng (' + signal + ').'};
  if (code === EXIT.OK) return {ok: true, title: MENU_LABEL, body: 'Bạn đang dùng bản mới nhất.'};
  if (code === EXIT.UPDATE_AVAILABLE)
    return {ok: true, title: MENU_LABEL, body: 'Có bản mới. Thoát hẳn Zalo rồi mở lại để cập nhật.'};
  if (code === EXIT.RUNNING)
    return {ok: true, title: MENU_LABEL, body: 'Có bản mới nhưng Zalo đang chạy. Thoát hẳn rồi mở lại.'};
  const reason = String(stdout || '').split('\n').map(line => line.trim())
    .find(line => /failed|error|fatal/i.test(line));
  return {
    ok: false,
    title: MENU_LABEL,
    body: reason ? reason.replace(/^\[update\]\s*/, '') : 'Kiểm tra cập nhật thất bại.'
  };
}

function updaterCommand(input) {
  return {
    command: input.node || process.execPath,
    args: [input.script, '--check', '--app-dir', input.appDir]
  };
}

// Source checkouts have no INSTALL-COMPLETE.json: there is nothing to swap out, so
// tell the user to git pull instead of running a no-op updater.
async function resolveUpdateTarget(appDir) {
  if (typeof appDir !== 'string' || !path.isAbsolute(appDir)) return null;
  try { await access(path.join(appDir, INSTALLED_MARKER)); } catch { return null; }
  const script = path.join(appDir, 'scripts', 'update-native.mjs');
  try { await access(script); } catch { return null; }
  return {appDir, script};
}

// Runs the read-only check and always resolves with {ok,title,body}; never rejects.
async function runUpdateCheck(options) {
  const opts = options || {};
  const target = await resolveUpdateTarget(opts.appDir);
  if (!target) return {ok: false, title: MENU_LABEL, body: 'Bản chạy từ mã nguồn: hãy dùng git pull.'};
  const command = updaterCommand({appDir: target.appDir, script: target.script, node: opts.node});
  return await new Promise(resolve => {
    let output = '', settled = false, timer;
    const finish = value => { if (settled) return; settled = true; clearTimeout(timer); resolve(value); };
    let child;
    try {
      child = (opts.spawnProcess || spawn)(command.command, command.args, {stdio: ['ignore', 'pipe', 'pipe']});
    } catch {
      finish({ok: false, title: MENU_LABEL, body: 'Không chạy được tiến trình kiểm tra.'});
      return;
    }
    if (child.stdout) child.stdout.on('data', chunk => { output += chunk; });
    if (child.stderr) child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', () => finish({ok: false, title: MENU_LABEL, body: 'Không chạy được tiến trình kiểm tra.'}));
    child.once('close', (code, signal) => finish(describeResult(code, signal, output)));
    timer = setTimeout(() => {
      try { child.kill('SIGTERM'); } catch {}
      finish({ok: false, title: MENU_LABEL, body: 'Kiểm tra quá lâu; thử lại sau.'});
    }, opts.timeoutMs || 180000);
    if (timer.unref) timer.unref();
  });
}

// Copies a built MenuItem back into a plain template object. Submenus are copied
// recursively because Zalo's "Đổi trạng thái" entry has its own checkbox list.
function itemToTemplate(item) {
  const out = {};
  for (const key of ['label', 'type', 'checked', 'enabled', 'visible', 'accelerator', 'role', 'sublabel', 'toolTip'])
    if (item[key] !== undefined) out[key] = item[key];
  if (typeof item.click === 'function') out.click = item.click;
  if (item.submenu && Array.isArray(item.submenu.items)) out.submenu = item.submenu.items.map(itemToTemplate);
  return out;
}

function menuToTemplate(menu) {
  if (!menu || !Array.isArray(menu.items)) return null;
  return menu.items.map(itemToTemplate);
}

// Installs the tray hook. Returns a handle so callers/tests can inspect the result.
function install(options) {
  const opts = options || {};
  const electron = opts.electron;
  const Menu = opts.Menu;
  if (!electron || !electron.Tray || !Menu)
    return {installed: false, reason: 'electron Tray/Menu unavailable'};
  const Tray = electron.Tray;
  if (!Tray.prototype || Tray.prototype.__zaloLinuxUpdatePatched)
    return {installed: true, reason: 'already patched'};
  let busy = false;
  const notify = message => {
    try {
      if (opts.Notification && typeof opts.Notification.isSupported === 'function' && opts.Notification.isSupported())
        new opts.Notification({title: message.title, body: message.body}).show();
      else (opts.logger || console).log('[update] ' + message.title + ': ' + message.body);
    } catch {
      (opts.logger || console).log('[update] ' + message.title + ': ' + message.body);
    }
  };
  const onClick = async () => {
    if (busy) return; // a second click while the check runs would race the same git call
    busy = true;
    try { notify(await runUpdateCheck({appDir: opts.appDir, spawnProcess: opts.spawnProcess})); }
    catch { notify({ok: false, title: MENU_LABEL, body: 'Kiểm tra cập nhật thất bại.'}); }
    finally { busy = false; }
  };
  const original = Tray.prototype.setContextMenu;
  Tray.prototype.setContextMenu = function (menu) {
    try {
      const template = menuToTemplate(menu);
      if (isZaloMenu(template))
        return original.call(this, Menu.buildFromTemplate(insertUpdateItem(template, {click: onClick})));
    } catch (error) {
      (opts.logger || console).error('[update] tray patch failed:', error && error.message);
    }
    return original.call(this, menu);
  };
  Object.defineProperty(Tray.prototype, '__zaloLinuxUpdatePatched', {value: true, configurable: true});
  return {installed: true, onClick};
}

module.exports = {
  MENU_LABEL, isZaloMenu, insertUpdateItem, describeResult, updaterCommand,
  resolveUpdateTarget, runUpdateCheck, itemToTemplate, install
};
