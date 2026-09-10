# Full-app recovery integration — 2026-09-10

Development checkout: `/home/rurimeiko/zalo-linux-native`.
This is a Git worktree: its shared Git database remains in
`/home/rurimeiko/zalo-native-recovery/.git`. Both directories are persistent
home directories; retain both until a standalone clone/backup is verified.
On 2026-09-10, with the user's explicit approval, the installed application was
restarted with the incoming/voice/video trial at `b9ec2fb`. The main bundle was
copied from this checkout after reviewing its diff; the previous installed main
bundle is backed up under `~/.local/state/zalo-native-test/restart-20260910/`.
The helper process was verified to run from this checkout with native setup,
network, media, video and incoming flags enabled. The account profile was not
copied or edited. This proves deployment, not successful two-account calling.

Local configuration: `~/.config/zalo-native-linux/launch.json` (mode 0600).
Preflight passed for the pinned runtime, Logitech C922 camera `/dev/video0`,
webcam microphone and HDMI output. Bluetooth playback was unavailable at this
check. A fresh helper still needs a validated outgoing configuration before it
can accept incoming calls. User-assisted voice/video testing remains pending.

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
  `pc-dist/linux-extras/PROVENANCE.md`; third-party notices are retained.

Historical initial integration bundle SHA-256 values (not current hashes):

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

The project `start.sh` now forwards to the configured native launcher, without
upstream auto-update, automatic Electron download or implicit sandbox bypass.
`update.sh` is a read-only independent-main revision check; it no longer deletes
and replaces installed files. `scripts/test-entrypoints.mjs` checks shell syntax,
argument forwarding and this non-mutating contract without contacting GitHub or
launching Electron. Existing installed launchers were not changed. Installer,
AppImage integration and verified automatic updates remain required work.

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
permission to the final independent repository by itself. Subsequent SSH pushes
published `main`, including the incoming trial commit `b9ec2fb`.

A subsequent public repository API check confirmed that the supplied
`RuriMeiko/zalo-linux-native` repository already has `fork: false` and public
visibility. SSH `push --dry-run main:main` succeeded, followed by actual pushes.
The remote default branch still requires changing to `main`.
The viewer-specific publication concern has been resolved; third-party notices
remain applicable (see `RELEASE-CHECKLIST.md`). The independent repository
name no longer needs to block development or require destructive recreation.

### Incoming lifecycle owner checkpoint

The agent now has an opt-in incoming dispatcher (`experimentalIncoming` in the
launcher). It invokes `incoming-desktop.mjs` and the tested incoming owner,
using native GTK consent/active-call dialogs and the existing video media pump.
Early remote cancellation, account changes, helper shutdown and passcode lock
abort the incoming attempt. Main forwards lock state only from its authenticated
main-window sender, without starting an idle helper. Tests cover dialog process
abort/cleanup, driver startup cancellation, account identity and lock forwarding.
A real GTK consent dialog was opened and aborted successfully without any call
or device capture. No real-account incoming acceptance was performed.

Older notes below saying the owner is not invoked by the agent describe the
previous checkpoint, superseded by this opt-in wiring. First-incoming identity
bootstrap and true remote rejection are still missing. The installed helper
has now been restarted with this trial; see the deployment checkpoint above.

The production desktop agent now binds its native local ID to the authenticated
outgoing 401 configuration for the current desktop account. The account ticket
is captured before sending 401, so delayed responses cannot bind a replacement
account. Repeated init/device updates preserve the same-account binding;
switches invalidate it and cancel active outgoing setup. No desktop ID is
truncated or persisted. `test-native-identity.js` covers binding/conflicts and
the production `OutgoingSetup` delayed-response boundary. The dispatcher now
consumes this identity, but a fresh helper has no verified native identity until a validated outgoing
configuration is obtained. First-call incoming bootstrap remains open.

`native/android-zrtc/incoming-call-owner.mjs` now composes invitation setup,
explicit consent, answer/API/ACK gates, native media readiness and a supplied
media task. `test-incoming-call-owner.mjs` verifies local decline, consent
timeout even when the UI promise never settles, ignored late consent, exclusive
worker ownership, matching remote cancellation, media-task joining before
native stop, and listener cleanup/reuse. These tests use synthetic transport
and worker events; the desktop agent now invokes this owner through the opt-in
incoming driver.

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
