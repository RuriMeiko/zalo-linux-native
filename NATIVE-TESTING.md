# Native regression checks

From the checkout on Linux x86_64 with the native addons built and FFmpeg on PATH:

```sh
node scripts/test-native-regression.mjs
```

This runs 20 commands, including the 25-suite call-control runner, native module
contracts, filesystem behavior, JPEG XL addon, synthetic video thumbnail,
image encoder boundaries, bundled header/viewer/privacy checks and installer/
integrity-verifier/menu/entrypoint tests. Each command has a timeout; a failed or explicitly skipped
test prevents an overall PASS. Run outside a restricted subprocess sandbox if
it prevents the entrypoint tests from executing Bash/Node normally.

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
```

The no-sandbox flag above is explicit for this development fixture, not a
recommendation for production security. Interactive call-window fixtures, actual
two-account voice/video, device reconnect, installed-menu launch, clean-machine
packaging and component licensing remain independent release gates.
