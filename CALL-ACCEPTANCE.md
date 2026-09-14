# Bài test nghiệm thu gọi Zalo Native trên Linux

Tài liệu này dành cho lần kiểm thử có hai tài khoản thật. Các bài test tự động
trong repo không gọi tài khoản, không mở mic/camera thật và không thay thế được
bài nghiệm thu này.

## Chuẩn bị

- Máy Linux chạy bản vừa cài từ checkout hiện tại; thoát hẳn mọi tiến trình Zalo
  cũ trước khi bắt đầu.
- Tài khoản A đăng nhập trên Linux. Tài khoản B ở điện thoại dùng để gọi qua lại.
- Để test đồng bộ nhiều thiết bị, đăng nhập tài khoản A trên thêm một điện thoại
  hoặc máy tính C.
- Kết nối đúng mic, loa và camera đã chọn trong `launch.json`. Chạy
  `bash start.sh --check` và chỉ tiếp tục khi lệnh báo PASS.
- Không gửi nguyên file `~/.config/ZaloData/zcall-agent.log`; log có thể chứa ID
  và dữ liệu phiên. Khi báo lỗi, chỉ ghi thời điểm, bước test và hiện tượng.

Mỗi mục ghi `PASS` hoặc `FAIL`, thời điểm và thiết bị thực hiện. Sau mỗi lỗi,
tiếp tục mục “Khôi phục sau lỗi” để xác nhận lần gọi kế tiếp không bị kẹt.

## 1. Gọi thoại đi

1. Từ A/Linux gọi B và để B đổ chuông 5 giây rồi trả lời.
2. Nói lần lượt A → B và B → A; mỗi chiều phải nghe rõ trong 10 giây.
3. Tắt mic trên Linux: B không còn nghe A; bật lại: âm thanh trở lại.
4. Kết thúc từ Linux. Cửa sổ gọi phải đóng và B phải kết thúc cuộc gọi.
5. Lặp lại, nhưng lần này kết thúc từ B. Cửa sổ Linux phải tự đóng.

Kỳ vọng: chỉ có một cửa sổ gọi, trạng thái không đứng ở “đang kết nối”, nút mic
chỉ đổi trạng thái sau khi native ACK, và có thể gọi lại ngay.

## 2. Gọi thoại đến và bấm trả lời sớm

1. Thoát hẳn Zalo Linux, mở lại rồi để B gọi A ngay khi giao diện vừa sẵn sàng.
2. Khi popup vừa xuất hiện, bấm **Trả lời** ngay, không chờ animation hoàn tất.
3. Xác nhận âm thanh A ↔ B hai chiều và thử tắt/bật mic.
4. Kết thúc một lần từ Linux, gọi lại và kết thúc một lần từ B.

Kỳ vọng: một lần bấm là đủ; nút không bị vô hiệu hóa trong lúc popup chuyển từ
chuẩn bị sang đổ chuông; không có lỗi 407 và popup không treo.

## 3. Từ chối và người gọi hủy sớm

1. B gọi A, trên Linux bấm **Từ chối** ngay khi popup vừa hiện.
2. B gọi lại, lần này B tự hủy khi popup Linux còn đang chuẩn bị.
3. Thực hiện cả cuộc gọi thoại và video.

Kỳ vọng: popup đóng ngay, phía B dừng đổ chuông, không hiện popup lỗi sau khi đã
hủy, không gửi thao tác kết thúc ngược lần thứ hai, và lần gọi sau vẫn hoạt động.

## 4. Trả lời trên thiết bị khác

1. B gọi tài khoản A; giữ popup đang đổ chuông trên Linux.
2. Trả lời cuộc gọi bằng thiết bị C đang đăng nhập cùng tài khoản A.
3. Giữ cuộc gọi B ↔ C trong ít nhất 10 giây và quan sát Linux.
4. Lặp lại một lần khi popup Linux vừa mới xuất hiện và một lần sau khi đã đổ
   chuông 5 giây.

Kỳ vọng: popup Linux tự đóng trong khoảng 2 giây, không hiện lỗi, không gửi lệnh
từ chối/kết thúc làm ngắt cuộc gọi B ↔ C, và Linux sẵn sàng nhận cuộc gọi kế tiếp.

## 5. Video hai chiều

1. A/Linux gọi video B; B trả lời. Xác nhận B thấy camera A và A thấy camera B.
2. Tắt camera Linux: capture cục bộ dừng và phía B chuyển đúng trạng thái; bật lại
   phải có frame mới, không giữ ảnh cũ như thể camera vẫn đang chạy.
3. B tắt/bật camera và kiểm tra hiển thị tương ứng trên Linux.
4. Lặp lại theo chiều B gọi video A, bấm trả lời trên Linux.
5. Kết thúc lần lượt từ mỗi phía và gọi lại ngay bằng thoại.

Kỳ vọng: preview đúng chiều/tỷ lệ, video không thay thế bằng màn đen vô hạn, âm
thanh vẫn hai chiều, và camera không còn bị chiếm sau khi đóng cuộc gọi.

## 6. Thiết bị mất kết nối và khôi phục

1. Trong lúc rảnh, rút/cắm lại mic hoặc tai nghe rồi chạy `bash start.sh --check`.
2. Trong một cuộc gọi thử, ngắt mic/loa; kết thúc cuộc gọi, kết nối lại thiết bị,
   mở lại Zalo và gọi lần nữa.
3. Với video, tắt/bật camera giữa hai cuộc gọi.

Kỳ vọng: không tự chuyển sang monitor/`auto_null`, lỗi không làm kẹt cửa sổ hoặc
worker, và cuộc gọi sau dùng lại đúng thiết bị đã cấu hình.

## 7. Khôi phục sau lỗi và gọi liên tiếp

Thực hiện tối thiểu ba chu kỳ: gọi → hủy lúc đang đổ chuông, gọi → trả lời → kết
thúc từ xa, gọi → trả lời → kết thúc cục bộ. Sau đó nhận thêm một cuộc gọi đến.

Kỳ vọng: không có “Signaling command busy or expired”, không còn popup cũ, mỗi
cuộc gọi chỉ có một owner/worker và thao tác của cuộc gọi trước không ảnh hưởng
cuộc gọi mới.

## 8. Khóa ứng dụng

1. Khóa Zalo bằng mã khóa rồi để B gọi A.
2. Mở khóa sau khi B đã hủy; gọi lại và trả lời bình thường.
3. Khóa ứng dụng trong lúc popup cuộc gọi đang hiện.

Kỳ vọng: khi khóa không rò tên/ảnh người gọi, popup/media đang mở được dọn sạch,
và mở khóa không phục hồi một cuộc gọi đã hết hạn.

## Smoke test ngoài cuộc gọi

- Thu nhỏ hoặc ẩn Zalo xuống tray, bấm icon Zalo trong menu ứng dụng. Cửa sổ phải
  hiện và focus ngay, không cần chuột phải → “Mở Zalo”, không tạo instance thứ hai.
- Mở viewer ảnh. Nút **Vẽ / chú thích** và **In** phải cùng kích thước 32 × 32,
  icon 20 × 20, bo góc/hover giống các nút share/download/rotate/zoom. Thử cả dark
  mode, mở editor, vẽ một khung, undo/redo và đóng.

## Mẫu báo kết quả

```text
Build/commit:
Thiết bị Linux:
1 Gọi thoại đi: PASS/FAIL — thời điểm — ghi chú
2 Gọi đến + trả lời sớm: PASS/FAIL — thời điểm — ghi chú
3 Từ chối/hủy sớm: PASS/FAIL — thời điểm — ghi chú
4 Trả lời thiết bị khác: PASS/FAIL — thời điểm — ghi chú
5 Video hai chiều: PASS/FAIL — thời điểm — ghi chú
6 Mất/kết nối lại thiết bị: PASS/FAIL — thời điểm — ghi chú
7 Gọi liên tiếp: PASS/FAIL — thời điểm — ghi chú
8 Khóa ứng dụng: PASS/FAIL — thời điểm — ghi chú
Menu icon: PASS/FAIL
Viewer ảnh: PASS/FAIL
```
