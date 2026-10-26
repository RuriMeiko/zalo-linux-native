// Linux-only tray extension: adds "Kiểm tra cập nhật" between "Mở Zalo" and "Thoát".
// Loaded before main-dist/compact-app so Tray#setContextMenu is already wrapped when Zalo
// creates its tray icon. Any failure here must never prevent Zalo from starting.
function installTrayUpdate() {
    try {
        const path = require('path');
        const {app, Menu, Notification, Tray} = require('electron');
        const {install} = require('./pc-dist/linux-extras/tray-update.js');
        install({electron: {Tray}, Menu, Notification, app, appDir: path.resolve(__dirname)});
    } catch (error) {
        console.error('[update] tray entry unavailable:', error && error.message);
    }
}

const handleEntryCompactApp = () => {
    return require('./main-dist/compact-app');
};

function bootstrap() {
    require('./libs/perf-tracing/runtime');
    perf.record(perf.STARTUP);
    require('./main-dist/migration');
    perf.record(perf.MIGRATION_DONE);

    const isCompactApp = process.argv.some(e => e.startsWith('--launch-compact-app'));

    if (!require('electron').app.requestSingleInstanceLock()) {
        return require('./main-dist/second-instance');
    }
    installTrayUpdate();
    if (isCompactApp) return handleEntryCompactApp();
    perf.record(perf.MAIN_SCRIPT);
    require('./pc-dist/zadark/js/zadark-main.min');
    return require('./main-dist/main');
}

bootstrap();
