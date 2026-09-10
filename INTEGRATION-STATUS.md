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

### Launch and publication checkpoint

The launcher now supports explicit `experimentalVideo: true` plus a selected
`videoDevice` (`/dev/videoN`); default voice launch still strips inherited video
flags. Configuration tests pass, but no real camera was opened in this check.
See `NATIVE-LAUNCH.md` for the development-only opt-in and validation limits.

GitHub CLI authentication remains invalid. A read-only SSH authentication check
using `ssh -F /dev/null -o BatchMode=yes -o ConnectTimeout=10
-o StrictHostKeyChecking=yes -T git@github.com` successfully authenticated as
`RuriMeiko` (GitHub's expected no-shell response exits with code 1). The default
system SSH configuration currently reports a file-ownership error; the explicit
empty config avoids loading that broken file while retaining host-key checking.
No credentials were displayed or changed. Authentication does not prove write
permission to the final independent repository; no push has occurred.

### Incoming lifecycle owner checkpoint

`native/android-zrtc/incoming-call-owner.mjs` now composes invitation setup,
explicit consent, answer/API/ACK gates, native media readiness and a supplied
media task. `test-incoming-call-owner.mjs` verifies local decline, consent
timeout even when the UI promise never settles, ignored late consent, exclusive
worker ownership, matching remote cancellation, media-task joining before
native stop, and listener cleanup/reuse. These tests use synthetic transport
and worker events; the owner is **not yet called by the desktop agent**.

Integration contracts: the caller must supply authenticated transport and
independently verified desktop/native caller identity mapping. Consent UI must
close on its abort signal and must not start media. The media task must stop
and join its camera/audio/render resources on abort; the owner deliberately
does not release the native worker while that task is still running. Local
decline currently cleans up locally only: pre-answer rejection signaling still
needs implementation before UI wiring is complete.

After successful native media start, local shutdown now sends desktop command
409 (`sendEndCall(toId, callId)`) after the media task joins. Matching remote
cancel/end controls suppress this echo. The owner tests cover exactly one local
end request and guaranteed native cleanup even if the end API rejects; the
desktop signaling test checks the actual renderer method's 409 API mapping.
This is synthetic verification, not evidence of remote-account call teardown.

The owner also subscribes to classified `nativeFault` and payload-free
`workerClosed` events. Either aborts outstanding consent/media and follows the
same joined cleanup, without exposing native diagnostic strings. Tests inject
both events during consent and active media and verify listener removal and
ownership reuse. `test-worker.mjs` against the rebuilt home recovery runtime
passes five real initialization/stop cycles and verifies exactly one
payload-free event on orderly process shutdown. This does not yet demonstrate
hardware unplug recovery or crash handling in the real desktop UI.

`node native/android-zrtc/test-incoming-owner-native.mjs
/home/rurimeiko/zalo-native-recovery/runtime` also passes against the real
rebuilt native worker. Three complete owner cycles each perform explicit
synthetic consent, mocked 407/402/ACK, native media start, at least 20 newly
encoded and decoded H.264 frames, exact 480x360 I420 pixel verification, silent
PCM advancement, and local 409 cleanup. Frame counters are checked as per-cycle
deltas, not accumulated totals. After each cycle, call info and snapshots are
unavailable and PCM counters remain stopped. Transport/native call listeners
are removed. The fixture uses only UDP localhost and a uniquely named temporary
PulseAudio null sink, unloaded in cleanup; it never captures the camera or real
microphone, contacts an account, or saves frame data. Desktop signaling and
consent are still simulated: this does not replace actual incoming UI wiring.

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
