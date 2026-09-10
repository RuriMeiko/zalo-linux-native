# Microphone mute backend

Worker command 17 (`microphoneMute`, `{muted: boolean}`) gates recording PCM
before `nativeDataIsRecorded`. Muted blocks are zero-filled. Playback is not
modified. The mutex spans the recording callback, so setter acknowledgment
waits for any earlier callback to return. Already encoded/in-flight audio is
not recalled. The microphone device remains open; this is transmission mute,
not device shutdown. Native stop resets the gate for the next call.

Commands require an active initialized call and exactly one 32-bit 0/1 value;
idle requests return `-ENOTCONN`. The JS encoder rejects coercible booleans.

Verification:

- `test-capture-gate.c`: nonzero synthetic PCM, zeroing/restoration over 1,000
  cycles and setter acknowledgment blocked while a callback owns the gate.
  Compile with `cc -std=c11 -Wall -Wextra -Werror -pthread`.
- `test-microphone-mute-wire.mjs`: command framing and strict input validation.
- Rebuilt native worker: `test-worker.mjs` covers idle rejection; the incoming
  owner native fixture toggles mute/unmute in three media cycles and verifies
  rejection after stop. Its PCM is silent; it does not prove remote audible mute.

Trial build: `~/zalo-native-recovery/mute-check/runtime`. Existing installed
runtime was not overwritten. Rebuild the worker before running these updated
native fixtures; older workers do not implement command 17.

Still required: connect explicit UI controls in outgoing/incoming sessions,
acknowledged mute state and error recovery, then real two-account verification.
No mute button is currently claimed operational in the installed application.
