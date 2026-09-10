# Unified call window — implementation checkpoint

The user supplied three Zalo desktop reference images: centered avatar/ringing,
incoming answer/end, and active video with a bottom control row. The new
`call-window.cjs` owns one isolated Electron window per call; its `dialog` method
matches the existing call owner's consent/dialing/active interface. Stage changes
and mute acknowledgements update the existing window, not separate GTK dialogs.
The production main/helper integration now uses inherited fd 4 for bounded
control messages, fd 3 for remote binary video frames and fd 5 for local preview. `desktop-call-window.cjs`
joins both pipes to this same window. Incoming and outgoing voice/video inject
the new dialog adapter, and clear it after worker shutdown. Lock and pipe closure
dispose the host. **Deployed and restarted with approval on 2026-09-10 at
source checkpoint `3f34275`.** Main PID 1155420 and helper PID 1155938 were
verified alive, with control/video/preview fds 4/3/5 and the new native runtime
`~/zalo-native-recovery/mute-evidence-20260910/runtime`. Installed main SHA-256
matches source: `17bf42b421d1d8366e4fc72e9b80984b9a009701c40b7ab4c1fcff5d8cbdadc4`.
This is deployment evidence, not live two-account acceptance.

## Verified on 2026-09-10

- `node native/android-zrtc/test-call-window.cjs`: reuse across stages and mute
  acknowledgements, stable duration origin, consent, close during an ACK gap,
  sender/revision/action validation, cleanup, sandbox permissions.
- `node native/android-zrtc/test-call-ui-pipe.cjs`: real duplex protocol and
  composed host (mock Electron) verify pre-frame dialing, shared video display,
  controls, cancellation ACK, reuse after clear, lock and disconnect teardown.
- `node scripts/test-call-control.mjs`: now includes 19 lifecycle suites.
- Real Electron 22 fixture `test-call-window-electron.cjs`, operated through
  agent-browser on loopback CDP port 9234: Answer → mute → unmute → End passed.
  This fixture now exercises both control and binary video pipes, with a
  synthetic 4×4 I420 frame. Camera off/on and mute/unmute controls pass through
  the same window and protocol. It uses synthetic control acknowledgements and no
  account/network/live media. The same window remains visible after answering.
- Visual screenshots inspected, stored under the persistent recovery directory:
  `~/zalo-native-recovery/call-window-incoming.png` and `call-window-muted.png`.
  The integrated synthetic video screenshot is `call-window-video-pipes.png`.
- Camera controller: `test-managed-camera.mjs` checks joined off, off before
  first-frame readiness, resume ACK, stable timestamp origin across restart,
  capture failures, UI ACK ordering and continued remote-video ownership.
  A subsequent regression test reproduced false camera-off success when preview
  cleanup throws after capture cancellation. The controller now ignores only
  the expected `AbortError`, propagates other cleanup failures and rejects the
  off acknowledgement. This source fix does not imply a running helper reloaded it.
- `node native/android-zrtc/test-managed-camera-device.mjs /dev/video0` passed
  on the user's Logitech USB camera: three off/on cycles, no additional frames
  reaching the mock worker after off ACK, and new frames on resume. Frames were
  discarded in memory, not saved or transmitted. This is real V4L2/FFmpeg
  acquisition with mock native ACK, **not remote two-account video acceptance**.
- Local preview now consumes the same NV12 frames acknowledged by the native
  worker. A 160×120 I420 downscale travels on its own bounded binary pipe; no
  second camera capture is opened. The renderer allows one pending remote frame
  and one pending local frame, with separate acknowledgements. Preview memory
  is zeroed after painting and its canvas cleared/hidden when capture stops.
- Electron/CDP fixture verified `previewHidden: true`, `remoteHidden: false`
  after camera off, and visible preview after camera on. Synthetic screenshot:
  `~/zalo-native-recovery/call-window-local-preview.png`. The real USB device
  test also passed with preview conversion and clear-before-off assertions.

## Remaining before live acceptance

- Test actual two-account signaling/media on the deployed matching main/helper.
- Check local preview and video latency in actual two-account calls after deployment.
- Real contact name/avatar with bounded, non-logging, account-scoped transport.
- Camera off/on is now wired to joined capture shutdown/restart. Validate it
  during a real video call, including remote presentation: the peer may retain
  the last image until camera-state signaling is implemented/verified. No new
  camera frames are submitted while off; audio and remote video remain owned
  by the existing call. Preview is mirrored locally only, not in transmitted frames.
- Validate reported microphone failure with real audio, not fixture text changes.
- Incoming red button remains **Bỏ qua** (local ignore), not verified remote reject.
- First-incoming native identity bootstrap and complete two-account acceptance.

Visual direction follows the supplied references: dark charcoal, centered avatar,
restrained system typography, red end and green answer. OS window decorations are
retained. No external fonts/assets, network permissions, renderer Node access or
profile reads are required. Generic identity is an explicit placeholder pending
the authenticated contact bridge, not a guessed contact.
