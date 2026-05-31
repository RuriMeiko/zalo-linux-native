# Zalo Linux Port 2026
⚠️ **Work in Progress** - This project is under active development.
A Linux port of Zalo, bringing the popular Vietnamese messaging application to the Linux platform.

<img width="1280" height="799" alt="image" src="https://github.com/user-attachments/assets/7f3000e2-6d5d-4bc1-a4c1-d334f4d7a3e9" />

## How It Works

This is an unofficial port of the **Zalo macOS desktop client** to Linux — not a web wrapper. Calls are not supported yet.

The port was created by:
1. Extracting the `.dmg` from the macOS version
2. Locating `app.asar` at `/Applications/Zalo.app/Contents/Resources/`
3. Extracting it with `asar extract app.asar app`
4. Running the extracted app with Electron 22.3.27 (`electron .`)

> Note: Newer versions of Electron cause errors — v22.3.27 is required.

## Installation

### Option 1: Install script
1. **Clone the repository**:
   ```bash
   git clone https://github.com/realdtn2/zalo-linux-2026.git
   cd zalo-linux-2026
   ```
2. **Run the install script**:
   ```bash
   ./install.sh
   ```

### Option 2: AppImage
Download the latest AppImage from the [Releases](https://github.com/realdtn2/zalo-linux-2026/releases/latest) page, then:
```bash
chmod +x Zalo-*.AppImage
./Zalo-*.AppImage
```
No installation needed — fully self-contained, just run it.

### Building the AppImage yourself
```bash
git clone https://github.com/realdtn2/zalo-linux-2026.git
cd zalo-linux-2026
./build-appimage.sh
# output: dist/Zalo-<version>-x86_64.AppImage
```
Requires: `wget`, `unzip`

## Usage

**Launch the application**:
- Open Zalo from your application launcher or desktop launcher

**Start manually**:
```bash
./start.sh
```

**Update the application**:
- Update through the desktop launcher or app launcher
- Or manually run:
```bash
./update.sh
```
## Features

### `zcall` (Audio & Video Calling)

**Status:** ❌ Unported (Stubbed)

**Description:**  
A massive proprietary VoIP and WebRTC stack built around custom ZRTP-based encryption. Implemented through `zcall_mac.node` and responsible for all voice and video calling functionality.

**Path Forward:**  
Requires a complete protocol teardown and real-time network reverse-engineering effort. The module is currently bypassed using `binding-stub.js`, which returns no-op implementations to prevent application crashes during initialization.

---

### `db-cross-v4` (Backup Decryption Engine)

**Status:** ✅ Ported

**Description:**  
Replaces the original macOS Mach-O binary. Intercepts backup restoration calls to decompress and decrypt proprietary ZDB4.0 backup containers using AES-256-CBC and LZMA2, enabling full chat history recovery.

**Path Forward:**  
Fully reverse-engineered and reimplemented in C++. The Linux replacement is complete and currently active.

---

### `zjxl` (JPEG-XL Codec Support)

**Status:** ❌ Unported

**Description:**  
Responsible for decoding JPEG-XL image files. Depends on a large bundled ecosystem of macOS-specific dynamic libraries, including OpenCV, `highway`, and `brotli`.

**Path Forward:**  
Requires native Linux builds of the underlying open-source C++ dependencies along with a custom Node-API wrapper capable of processing the application's image buffers.

---

### `zimage` (Advanced Image Processing)

**Status:** ❌ Unported

**Description:**  
Performs computationally intensive image operations such as thumbnail generation, resizing, and image transformations using the bundled `libvips-cpp` library.

**Path Forward:**  
Either:
- Install and interface with native Linux `libvips`, or
- Replace functionality entirely using JavaScript-based solutions such as `sharp`.

---

### `mp4thumb` (Video Thumbnail Generation)

**Status:** ❌ Unported

**Description:**  
Generates image thumbnails from `.mp4` attachments. Functions as a native macOS wrapper around a statically linked FFmpeg component that extracts preview frames.

**Path Forward:**  
Can be replaced with a JavaScript implementation that invokes the host system's `ffmpeg` binary and returns generated thumbnails to the application.

---

### `file-utilities` (Fast Directory Sizing)

**Status:** ❌ Unported (Throws Error)

**Description:**  
A Rust-based NAPI-RS module used for high-performance recursive directory size calculations.

**Path Forward:**  
Can be reimplemented using an asynchronous recursive filesystem scanner built on Node.js `fs.promises`.

---

### `zwalker` (Recursive Directory Scanner)

**Status:** ❌ Unported (Stubbed)

**Description:**  
Traverses the filesystem to locate files, index content, and discover backups.

**Path Forward:**  
Currently returns empty arrays through a stub implementation. Can be fully rewritten using standard Node.js filesystem APIs.

---

### `file-utils` (Low-Level File System Utilities)

**Status:** ❌ Unported (Returns "not support")

**Description:**  
Provides native wrappers around common filesystem operations such as moving, copying, and manipulating files.

**Path Forward:**  
A pure Node.js implementation using built-in filesystem APIs can provide complete feature parity.

---

### `v8-profiles` (CPU Profiling)

**Status:** ❌ Unported

**Description:**  
A macOS-specific profiling module used to analyze V8 JavaScript engine performance.

**Path Forward:**  
Can be mapped directly to Node.js V8 profiling APIs and existing profiling tooling available on Linux.

---

### `zfile` (Disk Information)

**Status:** ❌ Unported (Stubbed)

**Description:**  
Retrieves disk usage statistics, storage capacity information, and available free space.

**Path Forward:**  
Can be implemented on Linux through a lightweight Node.js wrapper around standard system utilities such as `df`.

---

### `sqlite3` (Local Database Engine)

**Status:** ✅ Supported

**Description:**  
The native database engine used to access local message shard databases (`.db` files).

**Path Forward:**  
The original macOS binary has been replaced with a Linux ELF build (`node_sqlite3.node`) bundled within the application. Functionality is fully operational.

---

### `zaloLogger` (IPC Logging)

**Status:** ✅ Supported

**Description:**  
Custom logging infrastructure utilizing an IPC transport layer.

**Path Forward:**  
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

For issues, questions, or suggestions, please open an issue on the [GitHub Issues](https://github.com/realdtn2/zalo-linux-2026/issues) page.
