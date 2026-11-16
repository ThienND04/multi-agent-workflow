# Nội bộ: tài liệu để xây công cụ `ag`

Thư mục này dành cho **chủ repo và người đóng góp** xây công cụ `ag`. Người chỉ muốn dùng workflow thì đọc [README.md](../README.md) ở gốc.

**Từ 16/11/2026, [HOW-IT-WORKS.md](../HOW-IT-WORKS.md) là bản thiết kế gọn, viết lại từ 14 yêu cầu gốc của chủ repo.** Khi `DESIGN.md` và các đặc tả trong `specs/` khác với nó, lấy HOW-IT-WORKS làm chuẩn, và Master đề xuất sửa đặc tả cho khớp.

**Bản nhẹ đã chạy được** nằm trong `starter-kit/` (quy tắc `to:`, `watch.sh`, `monitor.js`, `notify.sh`). Các tài liệu trong thư mục này mô tả bộ công cụ `ag` đầy đủ sẽ thay dần cho bản nhẹ đó.

## ⚠ Đóng băng thiết kế (từ 16/11/2026)

- **Không thêm** giai đoạn, đề xuất hay đặc tả mới, cho tới khi bản làm tay (`starter-kit/`) được dùng thật trên ít nhất một dự án (đang thử: TradeStats).
- Chỗ nào vướng khi dùng thật thì ghi vào [FEEDBACK.md](FEEDBACK.md). Đó là dữ liệu để **thu gọn `ag` bản đầu**: chỉ làm những gì gỡ được cái khó gặp thật, và để sau phần tính năng, FE/BE, Telegram, trang web.
- Các đặc tả đã duyệt (Giai đoạn 1, 1b, 2, 3, tổng cộng 45 việc) **được giữ nguyên làm tham khảo**. Khi thu gọn, Master đề xuất lại phạm vi để chủ repo duyệt.

## Có gì ở đây

| File / thư mục | Nội dung |
|---|---|
| [DESIGN.md](DESIGN.md) | Thiết kế đầy đủ và mọi quyết định đã chốt (mục 9) |
| [WORKFLOW-GUIDE.md](WORKFLOW-GUIDE.md) | Workflow khi đã có `ag`: khái niệm, luồng, tuỳ chỉnh |
| [BUILD-GUIDE.md](BUILD-GUIDE.md) | Từng bước xây `ag` theo đợt, lời nhắn dán sẵn |
| [OWNER-GUIDE.md](OWNER-GUIDE.md) | Việc thường ngày của chủ repo khi xây `ag` |
| [EXAMPLE-STOCK-APP.md](EXAMPLE-STOCK-APP.md) | Ví dụ dùng `ag` (bản đầy đủ) để xây một app |
| [FEEDBACK.md](FEEDBACK.md) | Ghi chép từ việc dùng thật bản làm tay |
| `mockups/monitor-pixel-office.html` | Bản phác giao diện văn phòng pixel (dữ liệu giả) |
| `trial-project/` | File thật từ dự án thử nghiệm đầu tiên |
| `../specs/` | Đặc tả, đề xuất đã duyệt, các việc, thứ tự giao |
| `../templates/` | Tài liệu mà `ag init` sẽ chép vào dự án dùng `ag` |
| `../AGENTS.md` | Luật cho AI đang xây repo này (giai đoạn làm tay) |
