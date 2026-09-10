# Native Linux port — current working checklist

Updated 2026-09-09. Objective: a complete native Linux app, including working
voice/video, with no Wine or Android emulator. This supersedes the stale
`/tmp/port-checklist.md`. Do not count a passing stub test as a working feature.
Do not publish a PR; finish native functionality before release claims.

## Review of existing implementation

| Component | Current evidence | Remaining |
|---|---|---|
| file-utilities | Current `test-linux.js` passes, including cancellation/hardlinks | Packaged Electron validation |
| file-utils | Current tests pass | Packaged Electron validation |
| zwalker | 14 current parity checks pass | Real backup workflow in app |
| zfile | Current filesystem tests pass | Packaged Electron validation |
| v8-profiles | Current inspector tests pass | Packaged Electron validation |
| mp4thumb | Real ffmpeg generation/cancellation tests pass | Bundle runtime dependency |
| zimage | Contract tests pass **with mocked Electron nativeImage** | Real Electron decode/resize smoke; broader formats still partial |
| zjxl | Native addon: 9 real encode/decode/resize/error checks pass | Packaging and all consumer formats; old docs incorrectly say CLI-only |
| call-v2 bridge | IPC/control implementation exists, call branch ends without media | Replace no-media path with authenticated native backend |
| installed Zalo | Different from repo; startup defaults to Wine proxy | Explicit native backend selection after readiness checks |
| Android ZRTC loader | Real Bionic load, SRTP init and Opus roundtrip pass | Integrate persistent worker into desktop |
| JNI platform layer | In progress: native context, metadata/ref/strings, VM attachment, native registration and PCM buffers | Lifecycle, full callback/exception/ref semantics, video/EGL |
| Audio transport | Both glibc helper and Bionic→glibc→Pulse null-sink roundtrips pass (440 Hz amplitude 12000); helpers reaped | Device loss, real-device selection and packaging |
| JNI audio plumbing | Real ZRTC recording/playout callbacks run through Pulse; 3 start/stop cycles pass, clean engine teardown | Connect streams to authenticated call/RTP and test two-way voice |
| Call callbacks | All 17 real `JniCallCallback` wrappers and network query pass typed fixture tests; 10,000 string callbacks reclaimed | IPC serialization, real network enum mapping, desktop event translation |
| Voice initialization | Native config selects voice mode; real `Peer::initialize` returns 0 with Linux-only EGL prerequisite adaptation; 3 PCM cycles and teardown pass | Persistent worker, real signaling/network validation |
| Persistent worker | Native configuration, bounded framing; real makeCall/callback IPC; 10 offline incoming codec negotiations and stop/retry pass | Accept, authenticated signaling and media; worker remains offline |
| Calling end to end | **Not working / not tested** | Session config + signaling mapping + acceptance + two-way media |

## Work sequence

- [x] Re-run existing module checks and identify mocked coverage.
- [x] Load the unmodified x86_64 ZRTC library in a standalone Bionic process.
- [x] Recover 173 JNI registrations from the pinned binary.
- [x] Implement native JNI boundary far enough for `setAndroidContext` to return 0.
- [x] Execute AudioManager cache-parameter and AudioRecord/Track direct-buffer callbacks.
- [x] Build native glibc Pulse helper; test synthetic audio through an isolated null sink.
- [x] Validate Bionic-to-glibc PCM transport and JNI record/playout callbacks.
- [x] Validate Bionic-to-glibc transport on isolated Pulse sink; reap both helpers.
- [x] Fix diagnostic lifecycle: load JNI globals, stop engine workers before destruction.
- [x] Fix recording argument order and re-cache native PCM buffers after each stop; 3 restart cycles pass.
- [x] Supply voice-only initialization without pretending an EGL/video backend exists.
- [ ] Implement typed call callbacks and authenticated session/config transport.
- [x] Port all 17 typed JNI callback events; test real wrappers and transient reference reclamation.
- [x] Add persistent native worker and bounded command protocol; configure native CallConfig and apply it on init.
- [x] Port enable-change-ZRTP JNI config setter: strict boolean TLV, native memory readback, 4 alternating real init/stop cycles, invalid raw boolean rejected without mutation. Full online server switching remains unfinished.
- [x] Forward native callback events through worker IPC with request correlation.
- [x] Execute offline native makeCall; use endCall before engine stop so retries work.
- [x] Recover 19 call-event codes and 4 network-type codes from APK DEX; add named call-event input to worker.
- [x] Wire native incomingCall and audio-codec query; test rejection cleanup and retry.
- [x] Negotiate native incoming Opus offer offline; fix diagnostic-init state leaking into later calls.
- [x] Recover media-state mapping from APK call driver; dispatch RINGING and verify real state callbacks.
- [x] Connect PCM host to persistent worker; EARLY/CONFIRMED start audio on a private null sink in 3 cycles, with stopped counters, reaped helpers and clean exit.
- [ ] Handle device opening failure/device loss in persistent worker; validate physical device selection.
- [x] Reject missing/removed Pulse device names before stream startup; 3 removed-null-sink attempts return ENODEV with zero frames and no helper children.
- [x] Audit desktop signaling grammar; implement/test sendSignal→renderer API→recvSignal transport boundary without extracting account keys.
- [ ] Wire desktop signaling transport into native call-session coordinator; consume live config and control events.
- [x] Map decoded legacy desktop CallConfig to native configuration/caller/callee commands; verify against actual vcmac wrapper and 5 native offline attempts.
- [x] Trace desktop response decoder; add opt-in sanitized API error replies and test actual renderer/decoder paths.
- [x] Add incoming-session coordinator through readiness/407 ACK/ringing/local stop; test missing readiness, server error, cancellation and timeout.
- [x] Add opt-in desktop control envelope decoder and IncomingSession.control; 3 real offline native attempts with duplicate/stale/parallel cancellation tests. Requires separately verified native local identity; not enabled in installed bridge.
- [ ] Implement incoming/outgoing/accept/hangup and recover failed calls.
- [x] User-assisted bidirectional voice test, 2026-09-09 14:32 ICT: CDP clicked voice call in Nguyễn Ngọc Thu Hà conversation; live 401/416, peer answer, original JNI codec update, 408 ACK and native media started. User explicitly confirmed “nghe dc âm thanh 2 chiều”. UGREEN Bluetooth source and sink used, no Wine/emulator.
- [x] CDP UI smoke: 2026-09-09 13:43:48 ICT, clicked voice-call button in Nguyễn Ngọc Thu Hà conversation; real helper captured request/makeCall. This proves UI dispatch only, not server signaling or ringing.
- [x] Live 401 roundtrip via the actual UI/renderer/bridge: 13:49:33 and 13:51:13 ICT. Response contains native uint32 fromId/toId, id, settings/zrtc_config/session/servers. Corrected response.id → CallConfig.callId and verified request correlation on the second attempt.
- [x] Live CDP retry at 13:56:56 ICT: authenticated 401 config passed normalization and real native initialize, producing configured-offline.
- [x] Add explicit worker network mode; real engine sends 2 UDP packets/76 bytes to a loopback test server and stops cleanly. Fixed libevent signal-wakeup socketpair denial. Offline defaults remain unchanged.
- [x] Live native network negotiation at 14:07:33 ICT: real UI request → 401 → native makeCall → onInitZrtpWithServer → native codec/extendData query, completing native-server-ready in about 0.51 s. No injected callback or synthetic server in this test.
- [x] Live outgoing invitation at 14:12:31 ICT: native offer → authenticated 416 ACK; user confirms invitation arrived. Received correlated answer at 14:12:42. This is not connected media.
- [x] Add original JNI updateCallerInfo boundary for peer codec/extendData; three offline native update/stop cycles pass.
- [x] Implement opt-in answer/media coordinator: validate accepted status, apply codec, ACK 408, dispatch CONFIRMED; retain invitation ownership until hangup. Synthetic tests cover ordering, failures, cancellation and duplicate answers. Enabled only with explicit PCM source/sink.
- [x] Exercise integrated outgoing answer with real native JNI/PCM on a private null sink: three start/stop cycles, moving record/play counters, no residual helpers. ACK is mocked; no remote audio proven.
- [x] Handle remote hangup before answer task/during ACK and runtime failure/worker exit during ACK; prevent subsequent media startup and release listeners/pending ACK.
- [x] Verify live answer/408 ACK and bidirectional media: native media launch with explicit UGREEN devices; 14:32:43 ICT answer, codec applied, 408 ACK, media started. Live PCM source/playback streams uncorked; user confirmed both directions audible. Camera/video and normal-launch packaging remain separate unfinished work.
- [x] User-assisted passive incoming-signaling schema test: 2026-09-09 13:28 ICT, real request and cancel reached the Linux helper. This proves delivery, not ringing/media.
- [ ] Implement and test video, camera switching, and screen share.
- [x] CPU capture adapter through the original VideoCapturer encode thread: three create/submit/join/destroy cycles each delivered 30 I420 frames on a non-owner thread; malformed input rejected, no callback after destruction. This is synthetic-frame lifecycle coverage, not a live call or camera-to-peer integration.
- [x] Worker exposes a strictly boolean videoCall configuration field and propagates original Peer initialization failure (-10 for missing EGL); three video failures followed by successful voice retries. Do not report makeCall acceptance as successful initialization.
- [x] Offline CPU Peer adapter binds the actual Peer-owned capturer without replacing its shared ownership. Original Peer CPU codec initialization succeeds for three video create/submit/stop cycles; Logitech -> ffmpeg NV12 -> worker IPC -> original Peer capture callback receives 30 real frames. Details and limitations: `native/android-zrtc/VIDEO-PEER.md`.
- [ ] Negotiate video codecs, prove encoded frames traverse real Peer RTP transport, and render remote frames before enabling live video in the agent. The running application still gates video requests.
- [x] Fix missing native supportVideoCall setter: actual offer now advertises callType 1/H.264 payload 97. Three offline answer/CONFIRMED cycles retain video mode and produce 27 encoded frames from 30 inputs each, alongside silent PCM. Test asserts actual encoded output, not merely capture submissions; real peer offer/answer and RTP delivery remain unverified.
- [x] Add separate experimental CPU-video network opt-in and loopback transport/lifecycle coverage. Three cycles encode locally and emit initialization UDP; the fixture receives only 3 x 38-byte setup datagrams, not video RTP. Server readiness/actual media transport remain open and the agent does not enable this opt-in.
- [x] Independently decode original engine H.264 via FFmpeg: 171 decoded 480x360 frames, 57 distinct image hashes for a moving synthetic pattern across three cycles. Preserve decoder frame cadence (passthrough). No RTP/network or remote window covered by this check.
- [x] Original WebRtcVideoCoding CPU/H.264 initialization and NV12 → native I420 → deliverFrame → encoded callback in an offline probe: three cycles, each 60 synthetic inputs yielded 57 nonempty encoded callbacks / 10,542 bytes. Native GetEncodeStats stayed 0/0; it is not used as success evidence. No remote video, decoder or Peer video integration proven.
- [x] Logitech C922 capture → NV12 → original native VideoSource → I420 callback, 30 real frames at 640x480; repeated after factoring CPU source ownership into video-source-linux.c. Reject malformed size/rotation before native dispatch. No textures/EGL, video encoder, remote video or in-call window wired yet.
- [ ] Verify all native modules under the packaged Electron runtime.
- [ ] Build a self-contained Linux package; smoke-test fresh installation.

### Live test diagnosis — 2026-09-09 13:28 ICT

- Schema log contains `control/request` at 06:28:14.667Z and
  `control/cancel` at 06:28:49.905Z. Installed app → native helper delivery works.
- Current helper has no `control` handler and does not start the native worker;
  it therefore never presents an incoming-call window. Outgoing `makeCall`
  still runs the no-media termination path. Neither is a functional call.
- Passive capture previously excluded `request/makeCall`; absence from this
  historical log cannot prove whether the outgoing button dispatched IPC.
  Capture now includes allowlisted makeCall/endCall/listDevice requests, with
  scalar data still redacted. Follow-up CDP click at 06:43:48.010Z verified
  outgoing voice UI dispatch; the makeCall partner.id is a 19-digit desktop ID.
  Do not pass it directly into native uint32 configuration. The next integration
  step is engine→host 401 and the authenticated renderer response, before 416.
- Host Pulse lists only an HDMI sink and its monitor source. No `/dev/video0`
  or `/dev/video1`; init schema reports null microphone/camera defaults.
  Do not relabel a playback monitor as a microphone or fake available devices.
- Real incoming envelope is `data.data`, with decimal-string uidFrom, uidTo,
  uidN, callId; codec and params are JSON strings. Params contains settings,
  zrtc_config, protocol, sessId, rtpIP, rtcpIP, id, userId, video.enable and
  extendData (another JSON string). Desktop local.id/uidN have 19 digits;
  **never cast those to native uint32**. Native identity direction, video flag
  interpretation and the config normalization must be verified before wiring.
- No further user call test is needed until the handler/worker/UI integration
  is ready. Do not advertise this launcher as an audio/video test release.


## Current development files

Outgoing setup now has an explicit `ZALO_ZCALL_NATIVE_SETUP=1` gate in the repo
agent, using `outgoing-setup.js` and `caller-response.mjs`. Only one-to-one voice
UI requests are accepted. It requests 401 via authenticated renderer APIs,
validates the response and can configure/close an offline native worker; it does
not send 416 or claim ringing. Runtime is explicitly supplied through
`ZALO_ZRTC_RUNTIME`. Empty codec array uses the shipped requestcall API's
supported empty-offer format; API typeRequest semantics still need final audit
before completing media negotiation. Do not infer it from UI enum numbers.

The installed renderer now includes the opt-in sanitized API error extension,
with backup next to the bundle ending `.before-native-signal-errors`.
Offline setup now applies configuration via real native initialize before
reporting configured-offline. Live UI retry at 13:56:56 ICT verified this path.
The optional offlineConfiguration mapper path carries enableChangeZrtp through
the original JNI setter instead of discarding it. The online mapper still
rejects enabled server switching unless the caller explicitly owns abort-on-change
handling. The network negotiation owner now rejects onCallChangeZRTP and closes
the worker rather than silently dropping that event; recovery remains unfinished.

Caller media mode comes explicitly from the UI voice request, consistent with
actual vcmac.setConfigData's separate isVideoCall argument; a regression test
uses response.video.enable=1 while verifying native setConfig still receives
isVideoCall=false. Dynamic ZRTP switching remains gated, not silently disabled.

`native/android-zrtc/`: `compat-jni.c`, `pcm-bridge.c`, `pcm-host.c`,
`call-boundary.c`, `run-call-check.sh`, `test-pcm.mjs` and the earlier loader probe.
Runtime/artifacts: `/home/rurimeiko/.cache/zrtc-native-21.12.01/`.

Diagnostic lifecycle fixed: call real `JNI_OnLoad`, and `Peer::stop(true)` before
destruction. With the optional Linux voice adaptation, `initialize` now returns
0; without it the Android EGL requirement still yields -10. Empty-config
`makeCall` returns false. The installed launcher has not been changed; no working
call is claimed.

Latest engine-audio evidence: `results/engine-pcm-test.log` in the runtime directory:
three cycles recorded 100/101/101 frames and played 166/166/166 frames, all native
start/stop return codes zero. Test uses only its temporary null sink and monitor;
Internet socket creation is denied. This proves native callbacks and restart,
not non-silent RTP media or an accepted call.

Voice initialization evidence: `results/voice-pcm-test.log`. The optional
`voice-platform.c` adaptation changes the EGL prerequisite **only for native
audio-only mode**, preserving all original audio/RTP/worker initialization.
`Peer::_initZrtcConfig` selects voice mode; no fake EGL object, mode memory write,
or forced success return is used. Test checks non-audio mode still rejects missing
EGL, then checks voice initialization returns 0, three real PCM cycles pass, and
stop returns normally. The original on-disk libzrtc hash is unchanged. Internet
socket creation is denied throughout; successful initialization does not prove
working network threads, authenticated signaling, or a connected call.

Callback evidence: `results/callback-test.log` contains the pass marker for all
17 native wrappers, network query and 10,000 transient strings. The bridge
preserves borrowed typed values for a synchronous sink; it does not log callback
payloads. No callback has yet been mapped to desktop signaling. JNI handles now
have locked reference counting and reusable slots, but implicit local frames,
full exceptions and long-lived class/method caching remain incomplete.

Worker tests: `node native/android-zrtc/test-worker.mjs RUNTIME_DIR` and
`test-worker-wire.mjs RUNTIME_DIR`. The worker's capability response explicitly
reports `offline:true, callReady:false`. No installed launcher points to it yet.
It is the process/control foundation, not a functioning desktop call backend.

`test-worker-call.mjs RUNTIME_DIR` now proves three offline native makeCall
attempts produce real `onMakeCall` and log callbacks through Node IPC, preserve
request IDs, reject concurrent attempts/config changes, and allow retry after
endCall/stop. Native acceptance is **not** a connected call. Empty server-list
fixtures and seccomp prohibit external calling. Incoming/accept and event-code
translation still need implementation before the installed app can use this.

Signaling evidence: `protocol-enums.mjs` records the original DEX hash and enum
ordinals. Native receiveCallEvent special-cases START_CALL=1 and
START_INCOMING_CALL=16, consistent with the DEX. Worker now accepts named events
and tests SEND_401/SEND_401_SUCCESS during three outgoing attempts. These are
not socket command IDs and must not be passed to setCallState. Accept/answer
workflow is not yet verified. Incoming ABI inspection identifies the first two
string arguments as RTP and RTCP addresses; the third is relayServer (confirmed
by the native log format). MediaCodecInfo codec and extension setters are wired.

`test-worker-incoming.mjs` validates 10 offline incoming negotiations, 60
early/codec-negotiation failures and 30 outgoing retries, including heap-backed
strings. Correction: the earlier empty codec list was queried before applying
CallConfig. After configuration, the real getter advertises `opus/16000/1`,
payload 112, frmPtime 20, dynamicFptime 0. This offer is accepted natively with
incoming debug stage 7 and initialized=true. It is not a connected call;
authenticated signaling, answer-state mapping and media remain.

Diagnostic-init cleanup correction: applying CallConfig marks isInCall while
controller state stays 6, so endCall(6) alone cannot clear it. Stop now recreates
diagnostically configured peers through native destructor/create/context APIs;
normal incoming/outgoing attempts retain their tested endCall/stop lifecycle.
No state-memory override or forced negotiation result is used.

Media-state evidence: classes5.dex (hash in `protocol-enums.mjs`) invokes
state 3 after SEND_407_SUCCESS and state 5 in its establish-call path. The
worker's new `callState` input separates these from signaling event ordinals
and socket command IDs. Ten incoming attempts emit real onCallState(3)
callbacks. EARLY probe reached PRE_START_DEVICE then failed for absent PCM
host and exited 78 through unsupported OpenSLES fallback. EARLY/CONFIRMED
now explicitly return -ENOTSUP until the tested Linux PCM bridge is connected
to the worker; no readiness or connected-state claim is made.

Update: `NativeWorker.start(runtime,{pcm:{source,sink}})` now opts into local
PCM explicitly; default mode still rejects EARLY/CONFIRMED. AF_UNIX sockets are
allowed in local-PCM mode for Pulse, while actual AF_INET/AF_INET6 creation is
checked to return EPERM at startup. `test-worker-pcm.mjs` passes 3 complete
incoming/RINGING/EARLY/CONFIRMED/stop cycles on its private null sink. Latest
cumulative counters: recorded 101/203/305, played 162/332/497. Counters stay
fixed after stop, helper-child list is empty, and worker exits 0.

Teardown fix: EARLY starts JNI capture before full RTP startup; native Peer
teardown alone left capture alive. Abort stack reached AudioDevice's destroyed
EventTimeWatcher via AudioRecordJni::DataIsRecorded. Worker now invokes real
StopRecording/StopPlayout before endCall/stop to join PCM callback threads.
This test proves local callback/device lifecycle, not RTP delivery or an
authenticated call. Device failure handling and desktop signaling remain.

Desktop signaling audit: shipped renderer lines 277529/277844 implement
authenticated APIs and return `recvSignal`; incoming events arrive as `control`
with `act_type:voip`. Earlier wire notes incorrectly treated numeric
host-to-engine sendSignal as the complete contract and proposed extracting
the account key. New `desktop-signaling.js` keeps authentication in the host,
correlates command-only replies, preserves server errors, and isolates late
responses after timeout. Tests execute the shipped renderer methods with API
spies for 401/416; this is not a live server test. Module is not yet wired to
the installed launcher/native session driver. Session config mapping remains.

Decoder/error-path correction: `kCOK` resolves decoded r.data and rejects API
errors before the bridge. Previous tests that supplied an error_code envelope
to handleRecvSignal only tested opaque delivery, not actual API behavior.
The repository renderer now forwards sanitized errors only after the engine
opts in with update/linux-native-capabilities `{signalingErrors:true}`.
`recvSignalError` carries callId and numeric errorCode (or null), never URLs,
error messages, session keys or the raw response. Actual renderer handler and
decoder tests pass; 406's existing log retry is preserved. Installed backend
unchanged. Native call-session coordinator still needs implementation.

Incoming coordinator update: `incoming-session.mjs` now sequences decoded config
→ native incomingCall → wait for real onIncomingCall → SEND_407/host request
→ successful desktop reply → SEND_407_SUCCESS → native RINGING callback.
The readiness ordering is backed by APK classes5.dex vz.p1.onIncomingCall,
which queues event 407 at offset 0x079440. Native incomingCall acceptance alone
must not send 407. Offline readiness timeout sends nothing and stops the engine.
Later state-machine tests explicitly inject readiness and mock desktop replies,
while using real native configuration/ringing/teardown. They cover error,
cancel-before-readiness, cancel-during-signaling, timeout and retry. Canceled or
expired command-only replies require a fresh IPC connection before command reuse.
Local stop is implemented; remote reject/end, answer, outgoing sequencing,
control/config decoding and installed-app wiring are still incomplete.

Audio failure handling update: OpenSLES shim now returns the SDK's
SL_RESULT_FEATURE_UNSUPPORTED instead of exiting 78. JNI PCM failures are counted;
worker state dispatch cleans up and returns ENODEV if startup reports failure.
Important finding: on the real Pulse/PipeWire server an invalid explicit device
name did not produce the anticipated startup error, unlike sandbox connection
denial. That early experiment was stopped/closed; it does not prove safe device
selection. NativeWorker now checks exact source/sink names via bounded pactl
queries at start and before EARLY/CONFIRMED. In-flight checks are invalidated by
stop/configure to avoid starting a canceled session. Test removes its null sink
after worker launch and proves zero PCM frames/helpers across 3 rejected starts.
Three normal null-sink PCM cycles still pass. Device pinning against disappearance
between check/open and movement during an active stream remains unimplemented;
do not claim physical-device selection or device-loss handling is complete.

Prepared passive user test: `bash scripts/test-native-call-schema.sh` launches
the installed Linux app directly (no updater, Wine proxy disabled), with the
repository bridge selected through ZALO_ZCALL_AGENT_PATH. Installed helper
launcher gained only that opt-in path override; its original is preserved as
`ZaloCall.before-native-schema-test`. Default launcher behavior is unchanged.
`signal-schema.js` records structural types to
`~/.local/state/zalo-native-test/signaling-schema.jsonl` (directory 0700/file
0600), omitting scalar values and numeric/dynamic keys. Raw capture and bridge
logs are disabled in this test launcher. This is not a functional media test:
user must quit existing Zalo, launch the script, receive a short call from a
separate account, then have the caller hang up. No microphone or media worker
is started by the diagnostic bridge. Await the user's test result before
claiming that the installed desktop supplies the expected control/config data.

Ownership correction: registerCallback stores pointers, but teardown destroys
adopted callbacks. Reusing a native callback after stop caused a double free.
The worker now creates one adapter per attempt and retains its local JNI ref
until teardown; it checks whether the constructor's single global ref has been
released before explicitly destroying an unadopted adapter. Class/method metadata
is interned to avoid per-attempt arena exhaustion. Implicit local frames remain
incomplete.
