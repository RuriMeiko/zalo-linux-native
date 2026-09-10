# Independent Linux project: completion and publication gates

Status: development, not a complete native Linux release.

## Functionality

- [x] One real outgoing voice call initiated from the Zalo UI via CDP; the user
  confirmed audio in both directions on 2026-09-09.
- [x] Logitech C922 frames pass through original native VideoSource to an I420
  callback in a local test.
- [ ] Native video encoder/send path, remote decode/display and video-call UI.
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
- [ ] Confirm independent project name, owner and visibility; create a new repository,
  not an overwrite of the upstream repository or existing user work.
- [ ] Authenticate the GitHub CLI locally; never put a token into chat or source files.
- [ ] Inspect the exact staged file list and secret-scan the proposed publication.
- [ ] Preserve applicable attribution/license notices and source provenance.
- [ ] Push to the verified new remote; read back its commit and README to confirm.
- [ ] Publish an accurately labelled release only when its acceptance gates pass.

At the last check, `gh api user` reported that GitHub CLI was not authenticated.
No new GitHub repository or independent release has been created by this step.
