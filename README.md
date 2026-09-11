# Zalo Linux Native
> **Development checkpoint (2026-09-11):** outgoing/incoming call owners use one
> Electron call window with remote video, local camera preview and acknowledged
> mic/camera controls. Incoming **Từ chối** now sends the authenticated desktop
> cancel request for voice/video before local teardown. Snapshot `8d7a0d0` is
> installed and running from the verified user-local copy; 25 call-control suites
> and all 21 aggregate regression commands pass under Electron 22's embedded
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
> ### ⚠️ Tình trạng tính năng Gọi thoại & Video (Call Status)
> - **Cuộc gọi đi (Outgoing Call - Phía mình gọi cho người ta)**: ✅ **Hoạt động tốt (Working)** — Phía mình gọi cho người khác nghe nói 2 chiều và camera hoạt động bình thường trên Linux.
> - **Cuộc gọi đến (Incoming Call - Người khác gọi tới mình)**: 🚧 **Đang phát triển, hiện CHƯA nghe / cúp máy được (WIP - Cannot answer/end yet)** — Khi người khác gọi đến máy tính, luồng xử lý tín hiệu và giao diện nghe/cúp máy vẫn đang được khắc phục và hoàn thiện.

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

## 📦 Hướng dẫn cài đặt & Sử dụng (Installation & Usage)
### 🤖 Cài đặt tự động bằng AI Agent (Claude Code, Cursor, Aider, Codex, ChatGPT,...)
Bạn chỉ cần copy link tài liệu chuẩn LLM dưới đây và đưa cho AI Agent của bạn để nó tự động thiết lập từ A đến Z:

> **Link cho AI Agent:**  
> `https://raw.githubusercontent.com/RuriMeiko/zalo-linux-native/main/llms.txt`

**Câu lệnh mẫu (Prompt):**
> *"Hãy đọc hướng dẫn tại https://raw.githubusercontent.com/RuriMeiko/zalo-linux-native/main/llms.txt và tiến hành kiểm tra môi trường, tải Electron 22.3.27, tạo cấu hình và cài đặt Zalo Linux Native trên máy của tôi."*

---


### 1. Yêu cầu hệ thống (Prerequisites)
- **Hệ điều hành**: Linux x86_64 (Ubuntu, Debian, Fedora, Arch Linux,...).
- **Node.js**: Phiên bản 18 đến 22 (khuyến nghị v20 hoặc v22).
- **Electron**: Bắt buộc phiên bản **v22.3.27** (các bản Electron mới hơn sẽ phát sinh lỗi).
  - Tải Electron 22.3.27: [Electron v22.3.27 Release](https://github.com/electron/electron/releases/tag/v22.3.27) (tải file `electron-v22.3.27-linux-x64.zip` và giải nén).
- **Âm thanh**: PulseAudio hoặc PipeWire (với gói `pipewire-pulse`).
- **Camera** *(tùy chọn cho video call)*: Thiết bị V4L2 (mặc định `/dev/video0`).
- **ZRTC Runtime**: Runtime native engine chuẩn bị sẵn (xem hướng dẫn tại [native/android-zrtc/README.md](native/android-zrtc/README.md)).

---

### 2. Thiết lập cấu hình `launch.json`
Zalo Linux Native sử dụng file cấu hình `launch.json` để quản lý đường dẫn và thiết bị phần cứng.

Tạo file `launch.json` (ví dụ đặt tại thư mục dự án hoặc `~/.config/zalo-native-linux/launch.json`):

```json
{
  "appDir": "/đường_dẫn_tuyệt_đối_đến/zalo-linux-native",
  "electron": "/đường_dẫn_tuyệt_đối_đến/electron-v22.3.27/electron",
  "runtime": "/đường_dẫn_tuyệt_đối_đến/runtime",
  "source": "tên_microphone_từ_pactl",
  "sink": "tên_loa_từ_pactl",
  "noSandbox": true,
  "experimentalVideo": true,
  "videoDevice": "/dev/video0",
  "experimentalIncoming": true,
  "log": true
}
```

#### Cách lấy tên Microphone (`source`) và Loa (`sink`):
Mở terminal và chạy lệnh:
```bash
# Lấy danh sách microphone (chọn tên thiết bị, không chọn dòng có đuôi .monitor):
pactl list sources short

# Lấy danh sách loa / tai nghe:
pactl list sinks short
```
*Lưu ý:* Tất cả đường dẫn trong `launch.json` phải là đường dẫn tuyệt đối (bắt đầu bằng `/home/...`), không dùng ký hiệu `~` hoặc biến môi trường `$HOME`.

---

### 3. Khởi chạy ứng dụng

#### Cách 1: Chạy trực tiếp từ thư mục mã nguồn
```bash
# Clone mã nguồn:
git clone https://github.com/RuriMeiko/zalo-linux-native.git
cd zalo-linux-native

# Kiểm tra tính toàn vẹn và thiết bị phần cứng trước khi chạy:
bash start.sh launch.json --check

# Khởi chạy Zalo:
bash start.sh launch.json
```

#### Cách 2: Cài đặt bản riêng biệt vào thư mục người dùng (`~/.local/share/zalo`)
Sử dụng script cài đặt tự động để sao chép payload và tạo launcher độc lập:
```bash
# 1. Kiểm tra preflight:
node scripts/install-native.mjs launch.json ~/.local/share/zalo --check

# 2. Thực hiện cài đặt:
node scripts/install-native.mjs launch.json ~/.local/share/zalo

# 3. Khởi chạy Zalo đã cài đặt:
bash ~/.local/share/zalo/launch-installed.sh
```

---

### 4. Đăng ký Menu ứng dụng trên Desktop (Tùy chọn)
Để hiển thị biểu tượng Zalo trong menu ứng dụng của hệ điều hành (GNOME, KDE, XFCE...):
```bash
node scripts/register-desktop.mjs ~/.local/share/zalo
```

---

### 5. Kiểm tra phiên bản mới từ repo
```bash
bash update.sh --check
```

---

### 6. Xem nhật ký log chẩn đoán cuộc gọi
Khi đặt `"log": true` trong `launch.json`, toàn bộ log kết nối cuộc gọi được lưu tại:
```bash
tail -f ~/.config/ZaloData/zcall-agent.log
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
