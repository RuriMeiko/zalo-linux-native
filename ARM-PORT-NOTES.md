# Ghi chú: hỗ trợ ARM cho Zalo native (làm sau, x86 vẫn là mục tiêu hiện tại)

Trạng thái 2026-10-15: dự án chỉ chạy x86_64. File này ghi lại những gì đã xác
minh để làm tiếp phần ARM, **chưa có code ARM nào**.

## Phiên bản phải ghim: Zalo 21.12.01

Mã hiện tại ghim theo hash và offset của `libzrtc.so` 21.12.01 (x86_64, SHA-256
`c7e5f005fd5c12dc64d72008a1871638246899a9cf6b034dc13981c014caeefe`, 8617888
byte, xem `HASH` trong `native/android-zrtc/worker-client.mjs`). Bản ARM phải
cùng 21.12.01. Bản mới (26.10.01) khác engine, dùng làm tham khảo thôi.

Từ APKMirror, 48/48 thư viện x86_64 của APK x86 21.12.01 giống hệt
`runtime/apk/lib/x86_64`, nên nguồn gốc bản đang dùng đã được xác nhận.

x86/x86_64 chỉ có đến 21.12.01. Các bản sau (APKPure ghi 24.03.x, Play ghi
26.10.01) chỉ có split arm64, kể cả khi hỏi bằng ABI x86_64.

## File đã tải

APK gốc nằm ngoài repo, ở `~/zalo-native-recovery/zalo-21.12.01-mirror/` (có
`SHA256SUMS`):

| File | SHA-256 |
| --- | --- |
| `zalo-21.12.01-x86.apk` (x86 + x86_64) | `96fadf71b99c1f940f6688cf520d180e286e03ae3f4f2285791fe45dda9729ea` |
| `zalo-21.12.01-arm.apk` (arm64-v8a + armeabi-v7a) | `5578425e54146f80b7b46fb1e8b194bcb3dd59d4a4f7b8f592fc7e4d1fce8131` |

Thư viện ARM đã được chép vào repo, cùng cấu trúc với x86_64:
`runtime/apk/lib/arm64-v8a/` (50 file) và `runtime/apk/lib/armeabi-v7a/` (50
file). `libzrtc.so` arm64: 7576872 byte, SHA-256 bắt đầu `1253417de821154c`;
armv7: 6876564 byte, bắt đầu `c55a6cbbf9f51a09`. Các file này **chưa được dùng
ở đâu** (launcher, trình cài đặt và test vẫn chỉ biết x86_64).

Bản 26.10.01 (chỉ tham khảo) nằm ở
`~/zalo-native-recovery/zalo-play-26.10.01/`, gồm 6 file `classes*.dex` để đọc
logic Java bằng `jadx`. Không nằm trong repo.

Lưu ý phân phối: các `.so` là mã độc quyền của Zalo, và
`NATIVE-PACKAGING.md` (phần "Evidence and remaining limits") nói rõ thư viện
ZRTC chưa có quyền phân phối lại được ghi nhận. Thêm file ARM làm repo nặng
thêm khoảng 82MB và cùng rủi ro đó.

## Việc cần làm cho ARM (chưa làm)

1. **Kiểm offset ghim trên arm64** (làm trước, rẻ nhất): so các chỗ đang cứng
   offset giữa x86_64 và arm64 của 21.12.01. Đã biết trên x86_64:
   `Peer` trạng thái cuộc gọi ở `+0x70`, audio device ở `+0x5e8`,
   `CallController` ở `+0x8e8` (`worker.c`, lệnh mute). Cần xác nhận lại bằng
   disassembly arm64 và kiểm các symbol mangled mà `worker.c` gọi qua `sym()`.
2. **Bionic arm64**: dự án chạy `libzrtc.so` bằng `linker64` của Android
   (`runtime/bionic/`, x86_64). Cần bộ `linker64`, `libc.so`, `libm.so`,
   `libdl.so`, `libstdc++.so`, `libz.so` của Android arm64. NDK không có
   loader, phải lấy từ image Android arm64.
3. **Build worker cho aarch64**: `worker.c`, `pcm-host.c`, các shim
   `runtime/results/platform/*` bằng NDK (`~/Android/Sdk/ndk/27.0.12077973`,
   target `aarch64-linux-android21`). Xem `native/android-zrtc/build-worker.sh`.
4. **Chọn runtime theo kiến trúc** trong `scripts/native-launch.mjs` và trình
   cài đặt, kèm test.
5. **Test**: máy hiện tại là x86 nên chỉ chạy thử bản arm qua `qemu-user` (nếu
   có) hoặc trên máy arm64 thật.

## Chưa xác minh

- Bản arm64 có cùng layout `Peer`/`CallController` với x86_64 hay không.
- Có lấy được bionic arm64 hợp lệ để phân phối không.
