# Unified call window — implementation checkpoint

The user supplied three Zalo desktop reference images: centered avatar/ringing,
incoming answer/end, and active video with a bottom control row. The new
`call-window.cjs` owns one isolated Electron window per call; its `dialog` method
matches the existing call owner's consent/dialing/active interface. Stage changes
and mute acknowledgements update the existing window, not separate GTK dialogs.
The production main/helper integration now uses inherited fd 4 for bounded
control messages and fd 3 for existing binary video frames. `desktop-call-window.cjs`
joins both pipes to this same window. Incoming and outgoing voice/video inject
the new dialog adapter, and clear it after worker shutdown. Lock and pipe closure
dispose the host. **These source changes have not yet been deployed/restarted
in the user's running app. Update main and helper together.**

## Verified on 2026-09-10

- `node native/android-zrtc/test-call-window.cjs`: reuse across stages and mute
  acknowledgements, stable duration origin, consent, close during an ACK gap,
  sender/revision/action validation, cleanup, sandbox permissions.
- `node native/android-zrtc/test-call-ui-pipe.cjs`: real duplex protocol and
  composed host (mock Electron) verify pre-frame dialing, shared video display,
  controls, cancellation ACK, reuse after clear, lock and disconnect teardown.
- `node scripts/test-call-control.mjs`: now includes 16 lifecycle suites.
- Real Electron 22 fixture `test-call-window-electron.cjs`, operated through
  agent-browser on loopback CDP port 9234: Answer → mute → unmute → End passed.
  This fixture now exercises both control and binary video pipes, with a
  synthetic 4×4 I420 frame. It uses synthetic mute acknowledgements and no
  account/network/live media. The same window remains visible after answering.
- Visual screenshots inspected, stored under the persistent recovery directory:
  `~/zalo-native-recovery/call-window-incoming.png` and `call-window-muted.png`.
  The integrated synthetic video screenshot is `call-window-video-pipes.png`.

## Remaining before live acceptance

- Deploy matching main/helper and test actual two-account signaling/media.
- Add local preview into this same window. Remote frames are wired already.
- Real contact name/avatar with bounded, non-logging, account-scoped transport.
- Camera off/on must control actual capture; its button is explicitly disabled
  in this checkpoint, not presented as functional.
- Validate reported microphone failure with real audio, not fixture text changes.
- Incoming red button remains **Bỏ qua** (local ignore), not verified remote reject.
- First-incoming native identity bootstrap and complete two-account acceptance.

Visual direction follows the supplied references: dark charcoal, centered avatar,
restrained system typography, red end and green answer. OS window decorations are
retained. No external fonts/assets, network permissions, renderer Node access or
profile reads are required. Generic identity is an explicit placeholder pending
the authenticated contact bridge, not a guessed contact.
