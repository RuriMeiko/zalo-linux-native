# Unified call window — implementation checkpoint

The user supplied three Zalo desktop reference images: centered avatar/ringing,
incoming answer/end, and active video with a bottom control row. The new
`call-window.cjs` owns one isolated Electron window per call; its `dialog` method
matches the existing call owner's consent/dialing/active interface. Stage changes
and mute acknowledgements update the existing window, not separate GTK dialogs.
The owning integration must call `dispose()` after media shutdown, on account
lock/switch, and on helper termination. **That production integration is not yet
wired; this checkpoint does not change the running Zalo app.**

## Verified on 2026-09-10

- `node native/android-zrtc/test-call-window.cjs`: reuse across stages and mute
  acknowledgements, stable duration origin, consent, close during an ACK gap,
  sender/revision/action validation, cleanup, sandbox permissions.
- Existing `node scripts/test-call-control.mjs`: all 12 lifecycle suites pass.
- Real Electron 22 fixture `test-call-window-electron.cjs`, operated through
  agent-browser on loopback CDP port 9234: Answer → mute → unmute → End passed.
  This fixture uses synthetic acknowledgements and no account/network/media.
- Visual screenshots inspected, stored under the persistent recovery directory:
  `~/zalo-native-recovery/call-window-incoming.png` and `call-window-muted.png`.

## Remaining before live acceptance

- Bridge the helper to this host and ensure outgoing UI opens before media frames.
- Feed remote video and local preview into this same window, not a second viewer.
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
