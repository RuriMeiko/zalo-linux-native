# Native Linux AppDir packaging

Status: a manifest-verified **local development AppDir** exists. It bundles the
application payload, Electron 22.3.27, the prepared Linux/Bionic ZRTC runtime and
an FFmpeg executable. It is not yet a redistributable AppImage or a public binary
release. Component licensing and a clean supported-system test remain release
gates.

## Inputs and build

The builder performs no downloads, package-manager calls, updates or deletion.
It accepts only a new destination under the current home directory; an existing
destination is rejected and an interrupted directory is retained for inspection.
Create an untracked build configuration outside the checkout:

```json
{
  "electronDir": "/absolute/path/to/electron-v22.3.27",
  "runtimeDir": "/absolute/path/to/prepared-zrtc-runtime",
  "ffmpeg": "/absolute/path/to/ffmpeg"
}
```

Then run:

```sh
node scripts/build-native-appdir.mjs /absolute/path/build.json \
  /home/your-user/ZaloNative.AppDir --check
node scripts/build-native-appdir.mjs /absolute/path/build.json \
  /home/your-user/ZaloNative.AppDir
node scripts/verify-native-appdir.mjs /home/your-user/ZaloNative.AppDir
```

`--check` hashes and validates all inputs without creating the destination. The
builder accepts only Electron 22.3.27, verifies the pinned `libzrtc.so` hash,
requires Electron/Chromium license files, and copies only Git-tracked application
payload roots. Runtime directory symlinks are materialized. A file symlink inside
one approved runtime component is accepted only when its resolved regular file
stays inside that same component; all other special entries or traversal fail.

The output contains:

- `app/`: the tracked Zalo/Linux application payload;
- `electron/`: the complete pinned Electron directory and notices;
- `runtime/`: Bionic libraries, APK x86_64 libraries, platform shims and the
  `zrtc-worker`/`pcm-host` executables;
- `tools/ffmpeg`: the exact executable selected by the builder;
- `AppRun`, a desktop entry, icon and `PACKAGE-COMPLETE.json`.

Every copied/generated file has a size, mode and SHA-256 entry. Both the separate
verifier and `AppRun` verify all entries before preflight or launch. Electron's
ASAR filesystem interception is disabled only inside the verifier's Node-mode
process so the archive container itself is hashed; the real app starts in a new
normal Electron process.

## Check and launch

The package reuses the native launch configuration described in
[NATIVE-LAUNCH.md](NATIVE-LAUNCH.md):

```sh
/home/your-user/ZaloNative.AppDir/AppRun --config \
  /absolute/path/to/launch.json --check
/home/your-user/ZaloNative.AppDir/AppRun --config \
  /absolute/path/to/launch.json
```

`appDir`, `electron` and `runtime` from that JSON are ignored and replaced with
the verified paths inside the AppDir. Device selections and explicit
`experimentalVideo`, `videoDevice`, `experimentalIncoming`, `noSandbox` and
loopback-only `cdpPort` options retain their normal validation. The packaged
FFmpeg path is forced through `ZALO_FFMPEG`; camera capture, video thumbnails and
extra image encoders therefore do not rely on PATH lookup.

Do not launch this beside another copy using the same Zalo profile. `--check`
does not open the application or media streams.

## Evidence and remaining limits

On 2026-09-11, a local build under `~/zalo-native-recovery` copied and verified
13,543 files. Verification passed independently under Node 22 and through the
bundled Electron 22/Node 16 `AppRun`; strict camera/Pulse/ZRTC preflight also
passed without opening Zalo. The source/runtime inputs and first failed package
attempt were preserved rather than overwritten.

This AppDir is host-compatible, not clean-machine proof. The selected FFmpeg may
still be dynamically linked to distribution libraries, and Electron depends on
normal Linux desktop libraries. PulseAudio/PipeWire compatibility, V4L2 access,
Bluetooth profile recovery and sandbox/user-namespace behavior vary by system.
No squashfs/AppImage is emitted. Most importantly, extracted Zalo client assets
and the proprietary ZRTC library do not have documented redistribution permission
in this project. Keep locally built packages private until that review is resolved.
