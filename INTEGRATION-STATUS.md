# Full-app recovery integration — 2026-09-10

Development checkout: `/home/rurimeiko/zalo-linux-native`.
This is a Git worktree: its shared Git database remains in
`/home/rurimeiko/zalo-native-recovery/.git`. Both directories are persistent
home directories; retain both until a standalone clone/backup is verified.
The running installed Zalo application has not been replaced or restarted.

## Inputs and history

- Base: `00dd2503aa54669508770537774b7ae00540a032`, fetched from
  `https://github.com/RuriMeiko/zalo-linux-native.git`, branch
  `port/linux-native-modules`; 13,243 tracked files with original history.
- Recovered sources: tracked `source/` at recovery commit `82c503a`, copied
  with relative paths intact. The untracked, unfinished incoming-call owner
  was deliberately not imported. `RECOVERY-MANIFEST.json` records the earlier
  reconstruction snapshot, not the hashes of subsequent implementation edits.
- Desktop bundles and viewer assets: the previously verified, home-only
  recovery fixture. Only application code/assets were copied, never account
  profiles or call captures. Viewer provenance is retained in
  `pc-dist/linux-extras/PROVENANCE.md`; publication permission is unresolved.

Verified integrated bundle SHA-256 values:

| File | SHA-256 |
| --- | --- |
| `main-dist/main.js` | `4dcce44da0b35071a1c86dcf3e655deb87c18c89bdc40d00ae71bd13b4c82cc2` |
| `pc-dist/compact-app-pc.e08d0d44f38873747a6b.js` | `02eb10f4ce35344c06e192d4d44765ff008954d19b2cb6304c1251da14e4a9e7` |
| `pc-dist/lazy/default-login-main-startup-shared-worker-znotification.9e3e92e88644da772301.js` | `379b15193342a8cf673a6614e07c5a6d241b013d35301250a94b3b29d61c55ce` |

## Checks run against this full tree

All commands below passed from this checkout:

```sh
node native/qt-call-cap-linux/test-desktop-signaling.js
node native/qt-call-cap-linux/test-outgoing-setup.js
node native/qt-call-cap-linux/test-signal-schema.js
node native/android-zrtc/test-incoming-answer-session.mjs
node scripts/test-native-launch.mjs
node scripts/test-linux-header.cjs
node scripts/test-linux-header.cjs --shared
node scripts/test-video-lock-bridge.cjs
node scripts/test-signaling-log-privacy.cjs
node scripts/test-viewer-extras.cjs
node --check main-dist/main.js
git diff --check
```

Before importing the recovered bundles, the desktop signaling test failed on
the upstream renderer: its API-error response timed out instead of delivering
the expected error code. The same test passes after integration, including
capability negotiation and safe error delivery. Tests exercise extracted app
methods with synthetic API responses, not a real account.

## Still required before release

- Connect incoming consent/UI and media ownership to the actual app, including
  verified native identity mapping and remote reject/end-call signaling.
- Rebuild and package the worker reproducibly with reviewed dependencies; run
  the full native suite from the integrated checkout.
- Verify incoming/outgoing two-account audio and video, camera/device changes,
  long calls, and cancellation. Previous loopback tests do not prove these.
- Verify live header/passcode behavior, printer/clipboard, and locked video
  privacy. Current tests do not exercise the real desktop or hardware.
- Review upstream/proprietary and viewer redistribution permissions, retain
  credits, finalize the independent repository destination, publish `main`,
  and verify the remote commit. No push or new release is implied here.

This remains an Electron desktop port with native Linux media, not a complete
rewrite in Qt/GTK. See `PORT-CHECKLIST.md` and `RELEASE-CHECKLIST.md` for the
broader requirements; this checkpoint does not supersede their open gates.
