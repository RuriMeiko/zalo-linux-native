# Full-app recovery integration — 2026-09-11

## Electron 22 runtime acceptance — source checkpoint

The complete 20-command account-free regression runner passes when invoked by
Electron 22.3.27 in Node mode. Native/runtime-facing commands therefore execute
against Electron's embedded Node 16 rather than only the developer's Node 22.
The installer fixture is the deliberate exception: its public contract is a
plain Node CLI and it pins that exact executable in `launch-installed.sh`.
Two fixtures were adjusted to avoid the newer-only `structuredClone` global,
and the aggregate runner now routes only the installer fixture through plain
Node while preserving Electron execution for the native module set.

Separate real Electron processes passed native zimage format/resize/file tests,
cross-installation single-instance locking, the shared incoming/active call
window (answer, mic off/on, camera off/on and end), and the outgoing preparation
cancel path. The latter produced no worker or invitation in its synthetic
signaling boundary. The reusable remote-video display fixture passed render,
clear, user close, reopen and renderer ACK behavior.

The strongest account-free media fixture ran the configured native runtime for
three cycles: synthetic I420 entered the original CPU H.264 encoder, traversed
localhost UDP, returned through the native decoder as verified 480x360 pixels,
then flowed through the snapshot/display pipe to a real Electron canvas. It
reported 81 decoded frames and 64 painted ACKs; independent FFmpeg decoding also
verified 27 received frames per cycle. This is meaningful renderer and media-
pipeline evidence, but the server and peer were local fixtures. It does not close
the current-build two-account, physical-device reconnect, final bundled-runtime,
clean-machine or licensing gates.

## Current authoritative deployment: `8d7a0d0`

The registered user-local installation was recoverably replaced from clean
checkpoint `8d7a0d0`. The previous complete snapshot is retained at
`~/zalo-native-recovery/installed-d3c9c88-before-8d7a0d0`; no account profile
was moved or inspected. The current installed verifier passes all 13,403
manifest entries. Strict runtime, Logitech camera, webcam microphone and HDMI
speaker preflight passed before installation. Launcher, Electron main and the
native call helper were then verified alive from
`~/.local/share/zalo-linux-native`.

This checkpoint keeps the unified incoming/outgoing voice/video window, NV21
camera conversion, acknowledged mic/camera controls and authenticated reject/
hangup signaling. It additionally restores viewer Edit/Print actions with Zalo
toolbar styling, presents bounded contact names/avatars, treats correlated peer
decline/end as normal call completion, and removes the competing 401 identity
probe that live testing showed was disconnecting the first incoming call after
a restart. All 25 call-control suites and all 20 aggregate regression commands
pass. Cold incoming, current-build rejection, remote camera state, device
reconnect and complete two-account voice/video controls still require live
acceptance; this is not a self-contained binary release.

Sections below are retained as chronological evidence and may describe older
source-only or deployed checkpoints. They do not supersede this section.

New-install launcher source now pins the absolute Node executable used during
installation, validates it is executable, and uses it for both manifest checking
and native launch. This removes dependence on desktop-session PATH/NVM setup and
fails with a bounded recovery instruction if that external runtime disappears.
Installer tests assert no bare `node` lookup remains. Existing registered snapshot
`529aa91` predates this launcher change and has not yet been replaced.
The generated launcher also avoids external `dirname`; a real `/bin/bash` fixture
with `PATH=/nonexistent` completed manifest verification and its synthetic target.
All 20 account-free regression commands subsequently passed.

Desktop registration now calls the complete installation verifier before any
menu write. Read-only `--check` accepts an existing entry only when it is a
canonical regular file whose contents exactly match; mismatch and write-mode
overwrite remain rejected. Synthetic tamper/existing-entry tests pass. The real
registered installation's 13,401 files and current menu entry both passed this
source `--check` without writes or launching an app.

## Registered installation replaced with verified snapshot `529aa91`

The non-running menu installation at `~/.local/share/zalo-linux-native` was
moved intact to the recoverable path
`~/zalo-native-recovery/installed-e10acc3-before-529aa91`; the active app was
revalidated as `~/.local/share/zalo`, so it was not stopped or modified. The
first reinstall attempt ran inside the restricted sandbox, could not see host
camera/Pulse devices, and stopped before creating the destination. The same
installer then ran with host device access and completed at the original menu
path. No recursive deletion or profile operation was performed.

The installed verifier twice passed all 13,401 manifest entries (once directly,
once through `launch-installed.sh --check`). Generated config/launcher integrity
is enabled; key testing/integration/viewer/credit docs are present; helper paths
resolve inside the installation; CDP is absent. Runtime/device preflight and
`desktop-file-validate` pass. The existing menu path therefore needs no rewrite.
The installed copy was not launched because a development app/call-test session
is still active. Runtime/Electron remain external, and menu launch, clean-machine
startup, licensing and two-account call gates remain open.

New-install integrity source: manifests now include the generated private config
and launcher as well as tracked payload files. `launch-installed.sh` streams and
checks every declared regular file's canonical path, mode and SHA-256 before
launching. Malformed/duplicate/traversal entries, symlinks, modified modes or
contents fail closed; no automatic overwrite occurs. Installer and dedicated
verifier fixtures pass, followed by all 20 aggregate regression commands.
Critical docs including testing/integration/viewer/header/call guidance are now
part of the tracked install allowlist. Existing installation snapshot `e10acc3`
predates this metadata and has not been replaced yet; it must not be described as
self-verifying. Runtime/Electron and licensing/clean-machine gates remain open.

Account-free aggregate regression: `node scripts/test-native-regression.mjs`
passed all 19 commands, including 25 call-control suites, native filesystem and
JPEG XL modules, synthetic media, mocked UI/privacy and installer checks.
Fixed-name destructive `/tmp/fu-*` fixture setup was removed; filesystem tests
now allocate home recovery directories. Trash tests no longer rewrite HOME.
See `NATIVE-TESTING.md` for coverage/limitations: legacy zcall stub diagnostics
do not constitute live call evidence, and GUI/media acceptance remains separate.

Electron image output now encodes actual single-frame WebP/GIF instead of
returning PNG bytes for those format requests. Resized nativeImage PNG is sent
to FFmpeg over pipes; only the pipe protocol is enabled, no shell/temp file,
30-second timeout and 32-MiB input/output bounds. Native PNG/JPEG stay in-process.
Real Electron + installed FFmpeg tests encode and decode all four formats across
landscape/portrait/unequal bounds/no-enlargement cases. Unit tests check format
signatures, fixed arguments and generic process-error handling. Source-only:
FFmpeg with libwebp/GIF encoders is an external dependency; animation, alpha/
color parity and the separate Sharp/vips fallback format behavior remain open.
Encoder options follow the [FFmpeg codec documentation](https://ffmpeg.org/ffmpeg-codecs.html#libwebp).

The optional zimage vips fallback now uses a unique mode-0700 directory under
`~/.cache/zalo-native/thumbnails`, not predictable output files in `/tmp`.
Cache symlink traversal is rejected; the exact output and empty operation
directory are removed in finally, including thrown spawn failures. Cleanup
remains best-effort on filesystem errors/process crash. Its API now rejects
asynchronously instead of throwing synchronously for CLI failures.
`test-vips-temp.cjs` uses real filesystem operations with a mocked vips process
and verifies location, permissions and normal/error cleanup; codec/format parity
is not established. The existing image contract test also passes. This source
change has not been copied into either installed app.

Additional zimage file-API fix: `resizeQA` previously ran its entire read/resize/
write operation twice when given a callback and swallowed Promise-only failures.
It now creates one operation; callback mode reports once, Promise-only mode
rejects on failure. Mock filesystem counters verify exactly one read/write;
the real Electron fixture writes/decodes a synthetic proportional thumbnail,
checks directory-as-output rejection and missing-input error callback. Both
test suites pass. No actual Zalo image/account was used; source is not yet
deployed and broader viewer/format parity remains incomplete.

New image-module source fix: a real Electron 22 synthetic fixture failed for an
80×40 PNG constrained to 20×20 (the old code distorted it to the square bounds).
NativeImage resizing now receives explicitly proportional dimensions instead
of Sharp's unsupported `fit` option. The same real fixture passes landscape,
portrait, rectangular bounds, no enlargement, PNG/JPEG decode and invalid input;
mocked contract tests pass too. No account, image files or app windows were used.
The running app/installed copy have not been updated for this change. Broader
format/alpha parity and actual application thumbnail acceptance are not proven.

Real Electron lock evidence: `test-single-instance-electron.mjs` launched two
different synthetic installation directories against one isolated profile.
The first acquired the lock; the second was denied and the first received
`second-instance`. After terminating/joining the first, a replacement acquired
the same lock. All fixture children exited; no production profile, migration,
window or media was used. Fixture retained at
`~/zalo-native-recovery/instance-fixture-a1XGw4`. This verifies Electron 22's
cross-directory lock with an explicitly shared profile, not the full Zalo
migration-before-lock path or actual menu activation of the installed copy.

Latest source-only bootstrap fix: compact startup no longer requests the
single-instance lock a second time after denial. The actual bootstrap is
executed in a VM fixture for acquired/denied normal/compact paths; each acquires
the lock once and loads exactly one entry module. This does not prove global
cross-installation exclusion or migration safety (migration still precedes the
lock). The running app and installed copy have not been updated for this fix.
The control suite now has 25 tests. Entrypoint tests failed in the restricted
subprocess environment and passed when rerun outside it; no real app was opened.

## User-local installation and menu registered

Source snapshot `e10acc3` was copied into the previously absent directory
`~/.local/share/zalo-linux-native`: 13,382 tracked files. Installation hashes
were checked during copy and independently read back against the manifest.
The copied launcher resolves its helper within that installation, not the
checkout. Its private config retains C922/HDMI and the external runtime, but
omits CDP. Electron/runtime remain external; this is not a self-contained release.

`~/.local/share/applications/zalo-linux-native.desktop` was registered with
exclusive creation and passes `desktop-file-validate`. Installed
`launch-installed.sh --check` passes actual runtime/device checks. No new app
was launched; the running app was left alone. Actual menu appearance and
launching this copy after quitting the old instance remain unverified.
No account profile was copied, moved or inspected.

## Latest actual restart: source checkpoint `6ac64ba`

This supersedes the deferred rollout and source-only deployment notes below.
The configured HDMI sink returned and strict host preflight passed. With no
native call worker found, old main 1155420 was terminated with approval; main
and helper 1155938 were confirmed gone. A first detached launcher attempt did
not survive and was confirmed absent. A directly tracked launcher then started
successfully: launcher PID 1547494, main PID 1547523, helper PID 1548043.

Selected helper environment was verified: runtime remains
`~/zalo-native-recovery/mute-evidence-20260910/runtime`, control/video/preview
fds are 4/3/5, incoming opt-in is enabled, source is the Logitech C922 microphone
and sink is the configured HDMI output. Installed main and compact renderer
hashes match source. No profile, audio selection or global device default was
changed. Startup output is private under
`~/.local/state/zalo-native-test/restart-6ac64ba.log`; account/chat log content
was not inspected. The tracked launcher must remain running.

The user has been invited to test **incoming first after this restart**, before
any outgoing call, to validate the uncached identity path. Then verify outgoing
voice/video, actual remote mute and camera off/on. This is verified deployment,
not a new two-account acceptance result; no calls were placed by this rollout.

## Latest rollout check: staged, restart deferred

The installed compact renderer was backed up to
`~/.local/state/zalo-native-test/preparation-deploy-350aa50/compact.before.js`
and updated with the correlated incoming-name response. Its SHA-256 now matches
source (`2155734cc9525898d74a1d454d3ceb42afe485ecaf6c55e8f1a97b2867e00f6c`).
Installed main and shared-worker already match source. Main resolves call-window
modules relative to the configured helper in the home checkout, so a matched
restart is still required to load the new helper/control protocol.

Restart was deliberately not performed: host-side `native-launch.mjs --check`
fails with `Selected sink is unavailable`. `pactl list short sinks` reports only
`auto_null`; neither a real HDMI nor Bluetooth output is currently available.
Both Logitech C922 and C270 microphone sources are present, and the host has
video0–video3. No audio default, launch configuration or account profile was
changed. Main PID 1155420 and helper PID 1155938 were revalidated alive; CDP
listed no call window and the process check found no native call worker. The
app remains on its previous running code, not a verified newly loaded build.
Reconnect/select a real output and rerun preflight before attempting restart.

## Source and earlier deployment evidence

Outgoing configuration/native failures now request the existing bounded generic
error dialog after preparation cleanup, instead of only recording setup-failed
and disappearing. Explicit cancellation and cancellation during cleanup suppress
notification. The callback receives no raw error/signaling/account identifiers;
notification failure cannot replace the original setup error. Regression tests
pass within the 24-suite runner. This helper change is not yet reloaded in the
installed running process.

The launcher now separates app startup from physical call-device readiness.
Runtime files/hash are still required; missing selected devices produce terminal
warnings on normal launch, while `--check` remains strict. Host-side preflight
was executed with the current config: launch mode returns only
`Selected sink is unavailable`, strict mode rejects as expected. No app was
started and no device was opened in this check. Tests cover missing camera,
non-device camera path, missing output, failed/malformed Pulse queries and
unchanged selections; all 24 call-control suites pass. This supersedes the
old device-presence startup blocker, not the outstanding live-call readiness
requirement or the fact that the installed app has not been restarted.

New source-only outgoing UI: `preparing` opens before configuration completes
and remains cancellable throughout native startup. Its Vietnamese status is
“Đang chuẩn bị cuộc gọi”, with “Hủy”; it does not claim remote ringing. The
preparation owner joins its dialog before the existing dialing/active owner
takes over. Both voice/video cancellation/failure fixtures and the composed
control-pipe stage transition pass. Deploy helper and window protocol together;
no live app restart or new two-account acceptance is claimed here.
The source has now passed isolated Electron 22 UI checks through agent-browser:
pre-configuration Hủy cancels the real setup/control-pipe composition with
synthetic signaling; a separate fixture passes answer, mic/camera toggles and
end with synthetic video. Local preview hides/restores without hiding remote
video. Both test processes exited 0. This strengthens UI evidence only; it does
not replace deployed/live media acceptance.

Latest signaling source fix: canceled/timed-out configuration command 401 can
be retried on the same helper using a fresh call ID. Success responses must
carry the exact numeric requested `id`; late successes/errors are ignored.
Used configuration IDs are not reused (bounded to 4,096 per connection).
Command-only responses for other commands still require connection replacement
after ambiguous cancellation/timeout. Regression tests cover both policies.
First-incoming identity acquisition is source-wired from the authenticated
renderer control delivered for the current account. Its bounded native `uidTo`
is bound to that account ticket before the incoming worker is created, and a
cached identity must match. The earlier distinct 401 probe was removed after
live testing showed that starting a competing outgoing configuration while a
cold incoming call was pending made the server tear down the real call. Fixture
tests cover voice/video envelopes, conflicts, missing account and cancellation.
Incoming preflight now reports identity/name preparation failures through the
existing bounded generic error dialog, without forwarding raw errors or caller
data. Cancellation at each await boundary suppresses the dialog and prevents
entry into the incoming owner. This source-only change has deterministic tests;
the running app has not been restarted for it.
The incoming driver's validation is also inside its error/cleanup boundary:
missing camera/display configuration, disabled video and invalid call data no
longer bypass notification. Regression cases prove no worker starts on these
failures and already-canceled attempts show nothing. Physical device failures
and actual two-account calls remain separate acceptance checks.

Latest deployed checkpoint (`3f34275`, 2026-09-10): unified call window is now wired to outgoing voice,
outgoing video and incoming call owners via a dedicated control pipe; remote
video frames render in that same window. Electron fixture with synthetic video,
Answer → mute → unmute → End passed through both pipes. This is not a new live
two-account acceptance result. App restart was approved and completed: main
PID 1155420, helper PID 1155938, matching installed/source main SHA-256 and
helper control/video/preview fds 4/3/5 verified. Runtime is now
`~/zalo-native-recovery/mute-evidence-20260910/runtime`; its real native tone
test passed three mute/unmute cycles at recording ingress (not a remote account).
Previous main/config backups are retained under
`~/.local/state/zalo-native-test/unified-call-20260910/`. Account data unchanged.
Camera off/on now controls capture shutdown/restart; three real USB camera
cycles passed with mock native ACK, and Electron control tests passed. Native
two-account camera-off presentation and contact presentation remain unverified/incomplete.
Local preview is now wired from the existing capture to a separate bounded pipe;
Electron fixtures verify hide on camera-off without hiding remote video, and
USB capture tests verify preview cleanup. Live acceptance remains pending. See
`native/android-zrtc/CALL-WINDOW.md`; the historical deployment notes below
must not be read as deployment evidence for the latest source.

Development checkout used for this test: `~/zalo-linux-native`.
This is a Git worktree: its shared Git database remains in
`~/zalo-native-recovery/.git`. Both directories are persistent
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

An earlier GitHub CLI authentication check failed. A read-only SSH authentication check
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
A later authorized GitHub CLI check returned repository admin permission.
Default branch was changed to `main` on 2026-09-10 and verified independently
with Git SSH: `HEAD -> refs/heads/main`, hash `19a76cd6399fa8e29e1826914e99fb1f07502473`.
The repository remains `fork: false`; old branches and predecessor history were retained.
The viewer-specific publication concern has been resolved; third-party notices
remain applicable (see `RELEASE-CHECKLIST.md`). The independent repository
name no longer needs to block development or require destructive recreation.

### Incoming lifecycle owner checkpoint

### CDP trial — outgoing voice UI

User follow-up confirms the voice call connected and End worked, while mute
was unreliable. The user also reports video visible at both ends after answer,
but no outgoing dialing UI or mic/end/camera controls for video. This is useful
live evidence, not full acceptance of the call feature or mute behavior.

The outgoing video branch now uses the shared dialing/active UI coordinator.
Capture begins only after answer/native readiness; cleanup joins camera and UI
before native stop and server end acknowledgment. Tests cover local/remote end
and camera failure. This source change has not restarted the live app. Camera
toggle remains unimplemented, and the reported mute issue is still open.

With explicit user approval, the app was relaunched with loopback-only CDP
port 9222 and the isolated `mute-check/runtime` build. Current renderer bundles
(compact header, lock forwarding and signaling-log redaction) were copied after
diff review; previous files remain in the home-only `cdp-trial-20260910` backup.
CDP verified the requested contact header and clicked the voice-call button.
The native worker and GTK “Đang gọi” process were observed. A later check found
both gone and no Pulse recording/playback streams. No reason for termination
or remote ringing/answer is established by these observations. User confirmation
is pending; this is not successful two-account voice acceptance.

Outgoing voice now has dialing and post-answer GTK controls, using the same
acknowledged mute coordinator as incoming. Invitation cleanup joins the UI and
stops native audio before awaiting server end acknowledgment. Synthetic UI and
invitation lifecycle tests pass. The dialing UI currently starts after native
server negotiation; earlier setup failures still need a visible error path.

Incoming startup/media failures now show a generic GTK error dialog after the
worker has closed. It suggests checking network and devices, contains no raw
exception or account strings, and auto-closes after 15 seconds. User abort and
matched remote cancellation suppress it. Tests cover error display ordering,
voice/video text, timeout exit, privacy and cancellation suppression. The
dialog is not a diagnostic claim identifying which device or network failed.

Disposal now removes the native event listener even if the worker rejects the
stop request (for example after a crash). Owner tests inject this failure both
during consent and active media and verify listener/ownership release. Desktop
driver tests additionally cover video-pump failure, active-dialog failure,
local hangup and parent abort, deliberately delaying task completion to verify
that worker closure waits for both media and UI cleanup. These are synthetic
failure tests, not real-account or hardware unplug acceptance.

Incoming local hangup now joins the UI/video task and disposes the native
session **before** awaiting desktop 409. Previously native PCM could remain
active until the end-call API replied or timed out. The owner regression holds
the 409 reply pending and checks stop ordering and ownership; the real native
fixture checks frozen PCM counters and unavailable call/video state inside the
delayed 409 handler. This change is not deployed by restarting the user's
current test session; a new helper invocation will load the updated module.

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
previous checkpoint, superseded by this opt-in wiring. The installed helper
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
~/zalo-native-recovery/runtime` also passes against the real
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
