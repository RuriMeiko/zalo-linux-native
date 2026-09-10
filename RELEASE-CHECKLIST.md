# Independent Linux project: completion and publication gates

Status: development, not a complete native Linux release.

## Functionality

- [x] One real outgoing voice call initiated from the Zalo UI via CDP; the user
  confirmed audio in both directions on 2026-09-09.
- [x] Logitech C922 frames pass through original native VideoSource to an I420
  callback in a local test.
- [ ] Native video encoder/send path, remote decode/display and video-call UI.
  Implemented and locally deployed; synthetic H.264 and Electron UI checks pass.
  Current-build two-account acceptance remains open, so this release gate stays unchecked.
- [ ] Incoming call notification, answer/reject and verified incoming media.
- [ ] Reliable call controls, microphone/speaker/camera selection, mute and hangup.
- [ ] Device disconnect/reconnect and Bluetooth profile-change recovery.
- [ ] Unified Ghostty-inspired header, account title, window controls and
  passcode lock: verify main/login/child windows and real unlock behavior.
- [ ] Supplied Print Patcher feature parity: drawing/text/arrows/rectangles,
  undo/redo, clipboard, preview and native print dialog. Isolated Chromium
  drawing/recolor/preview/lock tests pass; actual Zalo acceptance is pending.
  See [LINUX-DESKTOP-EXTRAS.md](LINUX-DESKTOP-EXTRAS.md).
- [ ] Automated regression suite covering the released configuration, plus
  fresh-install and user-assisted voice/video acceptance tests.

The detailed evidence and outstanding work are in [PORT-CHECKLIST.md](PORT-CHECKLIST.md).
Do not substitute successful module tests for these end-to-end gates.

## Reproducibility and packaging

- [ ] Remove developer-specific absolute paths from install and production launch.
  A separate JSON-configured development launcher is implemented and unit-tested
  ([NATIVE-LAUNCH.md](NATIVE-LAUNCH.md)); installer/default-shortcut migration and
  clean-machine verification remain open.
- [ ] Make native runtime acquisition, pinned versions/hashes and build steps
  reproducible, with redistribution permission checked for each component.
- [ ] Make normal launch select the verified native path without test-only env flags.
- [ ] Package and test on a clean supported Linux system, without existing caches.
- [ ] Document supported architectures, devices, dependencies and known limitations.
- [ ] Keep remote debugging opt-in and loopback-only; never enable it by default.
- [ ] No credentials, account profiles, call captures, device serials, personal
  screenshots, logs, APK caches or arbitrary build outputs in the published tree.

## Attribution and GitHub

- [x] Record upstream origin, predecessor author names and the inspected revision
  in [CREDITS.md](CREDITS.md).
- [ ] Resolve component licensing before publishing extracted client assets or binaries.
- [x] Confirm independent project name, owner and visibility: GitHub repository
  API on 2026-09-10 reports `RuriMeiko/zalo-linux-native`, public, `fork: false`.
  The user-supplied destination is already independent; no deletion/recreation
  or fork detachment is needed. Its default branch remains
  `port/linux-native-modules`. Read back with `git ls-remote --symref` on
  2026-09-10: remote `main` exists at `a49188eaaabca79be3752489c3bf53e2dc18a748`.
- [ ] Change GitHub default branch to `main` (pushing main does not do this).
- [ ] Authenticate the GitHub CLI locally; never put a token into chat or source files.
- [ ] Inspect the exact staged file list and secret-scan the proposed publication.
- [ ] Preserve applicable attribution/license notices and source provenance.
- [x] Push development commits to the independent remote's `main`; remote hash
  readback confirms publication. This is source publication, not a binary release.
- [ ] Publish an accurately labelled release only when its acceptance gates pass.

The earlier GitHub CLI token check failed, but SSH publication works and
development commits have been pushed repeatedly. The default branch is still
the old branch as verified above; redistribution review and a validated binary
release remain pending. Changing default-branch settings requires an authorized
GitHub API/CLI or browser session, not an SSH Git push.

Pre-publication review found no matches for the checked private-key/GitHub-token
and long session-key assignment patterns in the new native modules, scripts,
viewer assets and recovery manifest. This is a limited pattern scan, not proof
that the complete inherited repository history is free of personal data.
The viewer-specific publication concern has been resolved. No separate viewer
author credit is requested. Fabric.js retains its upstream license notice;
this does not relicense the proprietary client or establish binary-release
readiness.
