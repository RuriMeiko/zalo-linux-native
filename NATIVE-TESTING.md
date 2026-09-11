# Native regression checks

From the checkout on Linux x86_64 with the native addons built and FFmpeg on PATH:

```sh
node scripts/test-native-regression.mjs

# Exercise native/runtime-facing commands with Electron 22's embedded Node.
ELECTRON_RUN_AS_NODE=1 /absolute/path/to/electron \
  scripts/test-native-regression.mjs
```

This runs 21 commands, including the 25-suite call-control runner, native module
contracts, filesystem behavior, JPEG XL addon, synthetic video thumbnail,
image encoder boundaries, bundled header/viewer/privacy checks and installer/
integrity-verifier/menu/entrypoint tests. Each command has a timeout; a failed or explicitly skipped
test prevents an overall PASS. Run outside a restricted subprocess sandbox if
it prevents the entrypoint tests from executing Bash/Node normally.
The installer fixture executes its generated launcher with `PATH=/nonexistent`;
success proves it uses the recorded absolute Node path and Bash builtins rather
than relying on interactive NVM initialization, `node`, or `dirname` lookup.
When the aggregate itself runs through Electron, the installer fixture alone is
intentionally delegated to a plain Node executable: the installer's documented
public interface is a Node CLI and it records that executable in the installed
launcher. Every native/runtime-facing command remains on Electron's embedded
Node. Electron 22 uses Node 16, so test fixtures avoid newer-only globals such
as `structuredClone`.

Filesystem fixtures use unique directories in `~/zalo-native-recovery`.
The file-utilities test no longer deletes fixed `/tmp/fu-*` paths. The trash
test stubs the home-directory lookup instead of rewriting HOME. Some tests
remove their own synthetic fixture; others retain it and print its path.
No account profile, camera or microphone is used by this runner.

The zcall legacy stub test may print expected unsupported-method diagnostics;
it tests a wrapper contract, **not the production native call backend**. Header
and viewer checks use mocked boundaries. Do not interpret this runner as real
media or complete desktop acceptance.

Separate real-runtime checks include:

```sh
/absolute/path/to/electron --no-sandbox native/nativelibs/zimage/test-electron.cjs
node scripts/test-single-instance-electron.mjs /absolute/path/to/electron
/absolute/path/to/electron --no-sandbox native/android-zrtc/test-call-window-electron.cjs
/absolute/path/to/electron --no-sandbox native/android-zrtc/test-call-window-electron.cjs --preparation-only
/absolute/path/to/electron --no-sandbox native/android-zrtc/test-video-electron.cjs \
  --native-loopback /absolute/path/to/runtime
```

The no-sandbox flag above is explicit for this development fixture, not a
recommendation for production security. The call-window fixture is interactive:
answer, toggle mic off/on, toggle camera off/on, then end. Its preparation-only
variant requires pressing Cancel and verifies that no worker or invitation was
created. The native-loopback video fixture uses synthetic pixels, a private Pulse
null sink and localhost UDP; it exercises native H.264 encode/decode, the snapshot
pump and Electron canvas ACK without contacting an account.

On 2026-09-11, Electron 22.3.27 passed the full 21-command aggregate, zimage,
cross-directory single-instance, both call-window paths, the reusable video
display pipe and the native video loopback. The native loopback completed three
cycles with 81 decoded 480x360 frames and 64 Electron paint ACKs. These checks
cover the runtime currently configured for the installed development app. Actual
two-account voice/video, device reconnect, installed-menu launch, final packaged
runtime, clean-machine packaging and component licensing remain independent
release gates.
