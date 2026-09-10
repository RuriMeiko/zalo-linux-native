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
  Notification, answer and incoming media have two-account evidence. Reject now
  sends desktop command 405 for voice/video; current-build remote confirmation
  is the remaining sub-gate.
- [ ] Reliable call controls, microphone/speaker/camera selection, mute and hangup.
- [ ] Device disconnect/reconnect and Bluetooth profile-change recovery.
- [ ] Unified Ghostty-inspired header, account title, window controls and
  passcode lock: verify main/login/child windows and real unlock behavior.
- [ ] Supplied Print Patcher feature parity: drawing/text/arrows/rectangles,
  undo/redo, clipboard, preview and native print dialog. Isolated Chromium
  drawing/recolor/preview/lock tests pass; actual Zalo acceptance is pending.
  See [LINUX-DESKTOP-EXTRAS.md](LINUX-DESKTOP-EXTRAS.md).
- [ ] Automated regression suite covering the released configuration, plus
  fresh-install and user-assisted voice/video acceptance tests. The full
  20-command suite and separate Electron 22 GUI/native-video fixtures pass on
  2026-09-11; final-package and current-build live-account coverage are missing.

The detailed evidence and outstanding work are in [PORT-CHECKLIST.md](PORT-CHECKLIST.md).
Do not substitute successful module tests for these end-to-end gates.

## Reproducibility and packaging

- [ ] Remove developer-specific absolute paths from install and production launch.
  A separate JSON-configured development launcher is implemented and unit-tested
  ([NATIVE-LAUNCH.md](NATIVE-LAUNCH.md)). The user-local development installer
  ([NATIVE-INSTALL.md](NATIVE-INSTALL.md)) now verifies payload copies and passed
  a full local copy/preflight with its helper resolved inside the installation.
  New installs additionally verify their manifest, generated config and launcher
  before every start. The registered copy was recoverably replaced at snapshot
  `8d7a0d0`; its 13,403 entries and device/runtime preflight pass. The registered
  launcher starts main/helper from that copy. Clean-machine acceptance remains open.
  Self-contained runtime acquisition, default-shortcut migration and clean-machine
  verification remain open.
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
  or fork detachment is needed.
- [x] Change GitHub default branch to `main`: authorized repository PATCH
  succeeded on 2026-09-10, returning `default_branch: main` and `fork: false`.
  Independent Git SSH readback confirmed `HEAD -> refs/heads/main` at
  `19a76cd6399fa8e29e1826914e99fb1f07502473`. Old branches/history were not deleted.
- [x] Verify GitHub CLI authorization: repository API returned `admin: true`;
  no token was displayed, entered into chat or written into source files.
- [x] Inspect the exact staged file list and secret-scan the proposed publication.
  `scripts/audit-publication.mjs` now fails closed on unreadable/oversized tracked
  files and reports only path/rule, never matched values. Run both full-tree and
  `--staged` modes immediately before the publication commit. Reviewed inherited
  client identifiers/compiled-payload false positives are pinned by value hash and
  path in `PUBLICATION-AUDIT-ALLOWLIST.json`; the original values are not copied
  into the allowlist. Full-tree mode passed 13,438 tracked files with six
  hash-reviewed inherited matches; staged mode passed the exact 18-file
  publication set. Git history remains a separate review surface.
- [x] Preserve applicable attribution/license notices and source provenance:
  original Git author metadata is retained, CREDITS records the predecessor and
  independent repository, and the Fabric notice/license remains shipped.
- [x] Push development commits to the independent remote's `main`; remote hash
  readback confirms publication. This is source publication, not a binary release.
- [ ] Publish an accurately labelled release only when its acceptance gates pass.

An earlier GitHub CLI check failed; a fresh check later succeeded with admin
permission and enabled the default-branch change above. Development commits
have been pushed repeatedly. Redistribution review and a validated binary
release remain pending; repository independence is not release readiness.

Pre-publication review found no matches for the checked private-key/GitHub-token
and long session-key assignment patterns in the new native modules, scripts,
viewer assets and recovery manifest. This is a limited pattern scan, not proof
that the complete inherited repository history is free of personal data.
The viewer-specific publication concern has been resolved. No separate viewer
author credit is requested. Fabric.js retains its upstream license notice;
this does not relicense the proprietary client or establish binary-release
readiness.
