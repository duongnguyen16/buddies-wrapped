# Buddies Wrapped

[English](README.md) | **Tiếng Việt**

[![Website](https://img.shields.io/badge/Website-buddieswrapped.duongnx.tech-D97757?style=flat-square)](https://buddieswrapped.duongnx.tech/?lang=vi)
[![npm version](https://img.shields.io/npm/v/buddies-wrapped.svg?style=flat-square&color=D97757)](https://www.npmjs.com/package/buddies-wrapped)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

> [!CAUTION]
> **Toàn bộ dữ liệu được phân tích trực tiếp trên thiết bị của bạn.** Kho lưu trữ tin nhắn chứa thông tin nhạy cảm và kỷ niệm cá nhân của bạn. Hãy cảnh giác với các trang web giả mạo và mã nguồn không rõ nguồn gốc.
>
> - **100% Xử lý Client-Side:** Trong repository chính thức này và trên website [buddieswrapped.duongnx.tech](https://buddieswrapped.duongnx.tech/?lang=vi), toàn bộ tin nhắn được giải nén và xử lý hoàn toàn trong bộ nhớ thiết bị của bạn (thông qua JSZip trên trình duyệt hoặc công cụ Node CLI cục bộ). Không có bất kỳ dữ liệu, tin nhắn hay thông tin liên hệ nào bị gửi lên bất kỳ máy chủ nào. Bạn có thể tự kiểm tra qua tab Network (F12) trên trình duyệt hoặc kiểm tra mã nguồn mở.
> - **Cảnh giác với các bản sao chép không đáng tin cậy:** Tuyệt đối không tải file `messages.zip` lên các website lạ hoặc chạy script từ các bản fork không được xác minh.

---

## Hướng dẫn Xuất Dữ liệu Tin nhắn từ Facebook

1. Mở trang [https://www.facebook.com/secure_storage/dyi](https://www.facebook.com/secure_storage/dyi) (*Tải thông tin của bạn xuống*).
2. Chọn mục **Tin nhắn** (Messages).
3. Đặt Định dạng thành **JSON** (Lưu ý: *Không chọn định dạng HTML*).
4. **Bỏ chọn các file phương tiện (ảnh/video)** (Công cụ chỉ phân tích tin nhắn văn bản, việc bỏ chọn media giúp quá trình tạo và tải file nén diễn ra siêu nhanh và nhẹ).
5. Chọn khoảng thời gian mong muốn (ví dụ: *Toàn bộ thời gian* hoặc khoảng tùy chỉnh).
6. Bấm **Yêu cầu tải xuống**. Khi Facebook gửi thông báo file đã sẵn sàng, hãy tải file `.zip` về máy!

---

## Hướng dẫn Sử dụng

### 1. Sử dụng Trực tiếp trên Website (Không cần cài đặt)

Truy cập: [https://buddieswrapped.duongnx.tech/?lang=vi](https://buddieswrapped.duongnx.tech/?lang=vi) (hoặc link rút gọn: [https://bit.ly/buddies-wrapped](https://bit.ly/buddies-wrapped))

1. Kéo thả file `messages.zip` (hoặc các file JSON) tải từ Facebook vào website.
2. Xác nhận tên danh tính của bạn & chọn ngôn ngữ báo cáo (`VI` / `EN`).
3. Bấm **Tiếp tục** để xem ngay bảng thống kê!

---

### 2. Sử dụng qua Terminal CLI (`npx`)

**Yêu cầu:** Cần cài đặt sẵn [Node.js & npm](https://nodejs.org) trên máy tính.  
*(Để cài đặt Node.js/npm: tải bộ cài LTS từ [nodejs.org](https://nodejs.org), hoặc chạy `brew install node` trên macOS, `winget install OpenJS.NodeJS` trên Windows, hoặc `sudo apt install nodejs npm` trên Ubuntu/Debian).*

1. Tải về và giải nén file `messages.zip` từ Facebook.
2. Mở cửa sổ dòng lệnh (Terminal) tại thư mục chứa các file `message_1.json`.
3. Chạy lệnh:

```bash
npx buddies-wrapped
```

4. Làm theo hướng dẫn trên màn hình để chọn tên và ngôn ngữ.
5. Báo cáo tương tác `CHAT_OVERVIEW.html` sẽ tự động mở trên trình duyệt mặc định của bạn!

---

## Tính năng nổi bật

- **24+ Bảng Xếp hạng Độc đáo & Thú vị**: Chỉ số chất lượng toàn diện, Quán quân cú đêm, Quán quân dậy sớm, Tốc độ trả lời (Họ → Tôi), Bắn tin nhắn liên thanh, Tin nhắn đơn dài nhất, Nhịp điệu cuối tuần,...
- **33+ Thẻ Insight Phong cách Wrapped**: "Đại Thi Hào Bất Đắc Dĩ", "Khung Giờ Ma Thuật (2h – 4h Sáng)", "Cặp Đôi Diễn Hài", "Tâm Hồn Tò Mò", "Nghiện Dấu Ba Chấm", "Cơn Lốc VIẾT HOA", "Marathon Gõ Phím", cùng các quy đổi vui nhộn.
- **Chế độ Spoiler mặc định**: Làm mờ các thống kê bất ngờ kèm nút mở khóa 1 chạm.
- **Lưu Ảnh Thẻ 1 Chạm**: Di chuột vào bất kỳ thẻ insight nào để tải về ảnh đồ họa độ phân giải cao sẵn sàng chia sẻ mạng xã hội.
- **Biểu đồ Dòng Thời Gian Tương tác**: Biểu đồ chuỗi thời gian nhiều chỉ số được cung cấp bởi Chart.js (Gộp theo Tuần, Tháng, Ngày; lọc theo Tổng tin, Tăng trưởng tích lũy, Cú đêm, Chất lượng, Ký tự đã gõ).
- **Phân tích Chuyên sâu Phía Đối Phương**: Thống kê chi tiết những gì bạn bè đã gửi cho bạn so với những gì bạn đã gửi.
- **Hỗ trợ Song ngữ Anh & Việt (EN / VI)**: Bản dịch trọn vẹn và tự nhiên cho mọi chỉ số, tooltip và giao diện.
- **100% Cục bộ & Riêng tư**: Không cần lo lắng về quyền riêng tư.

---

## Quyền Riêng tư & Bảo mật

- **Không tải lên máy chủ**: Website sử dụng [JSZip](https://stuk.github.io/jszip/) và API trình duyệt để giải mã và phân tích dữ liệu trực tiếp trong bộ nhớ thiết bị.
- **Không theo dõi / Telemetry**: Không sử dụng tracker, cookie hay ghi nhật ký từ xa.
- **Mã nguồn mở**: Toàn bộ mã nguồn là công khai và có thể kiểm tra trực tiếp.

---

## Giấy phép

[MIT](LICENSE) © [Duncuti](https://github.com/duongnguyen16/buddies-wrapped)
