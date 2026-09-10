# Zalo Linux Native
> **Development checkpoint (2026-09-11):** outgoing/incoming call owners use one
> Electron call window with remote video, local camera preview and acknowledged
> mic/camera controls. Incoming **Từ chối** now sends the authenticated desktop
> cancel request for voice/video before local teardown. Snapshot `8d7a0d0` is
> installed and running from the verified user-local copy; 25 call-control suites
> and all 20 aggregate regression commands pass under Electron 22's embedded
> Node. Real Electron zimage, single-instance, call-control and native H.264
> localhost encode/decode/canvas fixtures also pass. It includes the corrected NV21
> camera path, contact name/avatar presentation, normalized remote decline/end,
> and a cold-start incoming path that no longer creates a competing 401 call.
> Current two-account confirmation remains a release gate.
> This is **not a finished release**. See
> [current evidence and remaining gates](INTEGRATION-STATUS.md).

> **Independent project:** this repository is
> [RuriMeiko/zalo-linux-native](https://github.com/RuriMeiko/zalo-linux-native),
> a public standalone GitHub repository (`fork: false`, default branch `main`).
> Development builds on [realdtn2/zalo-linux-2026](https://github.com/realdtn2/zalo-linux-2026),
> not a from-scratch implementation. See [credits and provenance](CREDITS.md),
> [current status](PORT-CHECKLIST.md) and [publication checklist](RELEASE-CHECKLIST.md).
> Native outgoing **voice was confirmed audible in both directions** in one
> user-assisted test, and the user later reported two-way video on a previous
> trial. Those observations do not validate every control in the current build.
> No binary release is claimed yet.

For native voice/video startup with user-local runtime and device settings, see
[NATIVE-LAUNCH.md](NATIVE-LAUNCH.md). This development launcher does not run the
inherited upstream updater.

⚠️ **Work in Progress** - This project is under active development.
A Linux port of Zalo, bringing the popular Vietnamese messaging application to the Linux platform.

<img width="1280" height="799" alt="image" src="https://github.com/user-attachments/assets/7f3000e2-6d5d-4bc1-a4c1-d334f4d7a3e9" />

## How It Works

This is an unofficial port of the **Zalo macOS desktop client** to Linux — not a
web wrapper. The experimental native call path is documented in
[native/android-zrtc](native/android-zrtc/README.md). It runs the existing ZRTC
engine in a Linux/Bionic worker and connects it to PulseAudio, V4L2 and the
desktop signaling/UI; it does not use Wine or an Android emulator.

The port was created by:
1. Extracting the `.dmg` from the macOS version
2. Locating `app.asar` at `/Applications/Zalo.app/Contents/Resources/`
3. Extracting it with `asar extract app.asar app`
4. Running the extracted app with Electron 22.3.27 (`electron .`)

> Note: Newer versions of Electron cause errors — v22.3.27 is required.

## Installation

Clone the independent repository and prepare the external runtime, Electron 22
and explicit device configuration described in [NATIVE-LAUNCH.md](NATIVE-LAUNCH.md):

```bash
git clone https://github.com/RuriMeiko/zalo-linux-native.git
cd zalo-linux-native
bash start.sh --check
bash start.sh
```

For a manifest-verified copy and optional desktop-menu entry, follow
[NATIVE-INSTALL.md](NATIVE-INSTALL.md). Startup does not download dependencies,
rewrite the checkout or run an updater. This is still a development installation,
not a self-contained package or released AppImage.

## Usage

**Launch the application**:
- Open Zalo from your application launcher or desktop launcher

**Start manually**:
```bash
./start.sh
```

**Check for a newer source revision without modifying files**:
```bash
bash update.sh --check
```
## Features

### `zcall` (Audio & Video Calling)

**Status:** Experimental native voice/video with incoming/outgoing UI is deployed;
voice was confirmed audible both ways and one video trial displayed both peers.
Current-build two-account controls/rejection and packaging remain release gates.

**Description:**  
A massive proprietary VoIP and WebRTC stack built around custom ZRTP-based encryption. Implemented through `zcall_mac.node` and responsible for all voice and video calling functionality.
`zcall_mac.node` is a Mach-O binary and cannot run on Linux. The native path
replaces it with a Linux helper plus a bounded Bionic worker around the pinned
Android x86_64 ZRTC engine. The helper owns authenticated desktop signaling,
PulseAudio PCM, Logitech/V4L2 camera capture, H.264 frame transport and the
dedicated call window. Architecture, evidence and remaining limitations are in
[CALL-LINUX.md](CALL-LINUX.md), [PORT-CHECKLIST.md](PORT-CHECKLIST.md) and
[INTEGRATION-STATUS.md](INTEGRATION-STATUS.md).

---


### `db-cross-v4` (Backup Decryption Engine)

**Status:** ✅ Ported

**Description:**  
Replaces the original macOS Mach-O binary. Intercepts backup restoration calls to decompress and decrypt proprietary ZDB4.0 backup containers using AES-256-CBC and LZMA2, enabling full chat history recovery.

**State:**  
Fully reverse-engineered and reimplemented in C++. The Linux replacement is complete and currently active.

---

### `zjxl` (JPEG-XL Codec Support)

**Status:** ✅ Ported

**Description:**  
Replaces the macOS binary with a Linux x64 NAPI addon (`build/linux_x64/jxl.node`) built against libjxl 0.11. All runtime dependencies (libjxl, brotli, highway, libjpeg, lcms2) are bundled next to the addon with `$ORIGIN` RUNPATH, so no system packages are required. Full API parity: `decodeToJpeg`, `bitmapToJxl`, `getJxlInfo`, `resizeJxl`, `resizeJxlLimit`, `jxlDecompressMulti`, `moduleReady`.

---

### `zimage` (Advanced Image Processing)

**Status:** ✅ Ported

**Description:**  
Pure-JS port of the thumbnail pipeline: prefers Electron `nativeImage` (zero dependencies, always available in the main process), falls back to `sharp` if the app ever bundles it, then to the system `vips thumbnail` CLI. Matches the macOS semantics consumers use (`Image.thumbnail` / `resizeQA`, fit-inside, JPEG quality, alpha flattened onto white).

---

### `mp4thumb` (Video Thumbnail Generation)

**Status:** ✅ Ported

**Description:**  
Spawns ffmpeg (`ZALO_FFMPEG` override → Electron's bundled ffmpeg → `PATH`) to extract one scaled frame, mirroring the static-FFmpeg macOS wrapper. When no ffmpeg binary exists the port rejects with the same `{ error: 'LIB_ERR' }` shape the loader fallback already produced, so callers are unaffected.

---

### `file-utilities` (Fast Directory Sizing)

**Status:** ✅ Ported

**Description:**  
Rust NAPI-RS module rebuilt for Linux x64 (`linux-x64/file-utilities.node`, sources under `native/`). Exposes the full surface: `getDirectorySize(Async|Sync)`, `detectHardlinks(Async|Sync)`, `detectFilesystem(Async|Sync)`, `getDirectorySizeByGlob(Async|Sync)`.

---

### `zwalker` (Recursive Directory Scanner)

**Status:** ✅ Ported

**Description:**  
Pure-JS reimplementation of the napi-rs crawler: `scanDirectory`, `updateReferenceMessageId`, `deleteHomelessFiles` (conservative/aggressive), `statUnmarkedFiles`, `deleteEmptyFolders`. Parity-tested against the macOS binary's observed semantics (`.zwalker.json` marker format, atime buckets, homeless math, error codes 1016/1017).

---

### `file-utils` (Low-Level File System Utilities)

**Status:** ✅ Ported

**Description:**  
Pure-JS port: `moveFileToTrash` (FreeDesktop.org Trash spec — files/info layout, collision renaming, `.trashinfo`), `copyFileSync`, `ensureDirSync`, `isFileExecutable`. No "not support" fallback on Linux anymore.

---

### `v8-profiles` (CPU Profiling)

**Status:** ✅ Ported

**Description:**  
Pure-JS shim over Node's core `inspector` module (V8 `Profiler.start/stop/setSamplingInterval`). Provides the same `profiles` map, `startProfiling`/`stopProfiling`/`setSamplingInterval`/`deleteAllProfiles` surface as the macOS profiler addon.

---

### `zfile` (Disk Information)

**Status:** ✅ Ported

**Description:**  
Pure-JS port: `stat`/`statFolder` (size, fileCount, mtime), `diskInfo()` keyed by mount point (statvfs/df), `copyFolder`/`cancelCopy` (cancellable recursive copy), `canRead`/`canWrite`/`canReadAndWrite`.
---

### `sqlite3` (Local Database Engine)

**Status:** ✅ Supported

**Description:**  
The native database engine used to access local message shard databases (`.db` files).

**State:**  
The original macOS binary has been replaced with a Linux ELF build (`node_sqlite3.node`) bundled within the application. Functionality is fully operational.

---

### `zaloLogger` (IPC Logging)

**Status:** ✅ Supported

**Description:**  
Custom logging infrastructure utilizing an IPC transport layer.

**State:**  
Implemented entirely in cross-platform JavaScript and requires no platform-specific porting work.

## Contributing

This is an active work-in-progress project. Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## Disclaimer

⚠️ This is a community port and is not officially affiliated with Zalo or VNG Corporation.

## Support

For issues, questions, or suggestions, please open an issue on the
[independent project's GitHub Issues](https://github.com/RuriMeiko/zalo-linux-native/issues)
page. The predecessor repository remains credited above and in [CREDITS.md](CREDITS.md).
