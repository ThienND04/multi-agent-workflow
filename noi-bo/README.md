# Nội bộ: tài liệu để xây công cụ `ag`

Thư mục này dành cho **chủ repo và người đóng góp** xây công cụ `ag`. Người chỉ muốn dùng workflow thì đọc [README.md](../README.md) ở gốc và dùng `bo-khoi-dau-lam-tay/`.

## ⚠ Đóng băng thiết kế (từ 16/11/2026)

- **Không thêm** giai đoạn, đề xuất hay đặc tả mới, cho tới khi bản làm tay (`bo-khoi-dau-lam-tay/`) được dùng thật trên ít nhất một dự án (đang thử: TradeStats).
- Chỗ nào vướng khi dùng thật thì ghi vào [PHAN-HOI.md](PHAN-HOI.md). Đó là dữ liệu để **thu gọn `ag` bản đầu**: chỉ làm những gì gỡ được cái khó gặp thật, và để sau phần tính năng, FE/BE, Telegram, trang web.
- Các đặc tả đã duyệt (Giai đoạn 1, 1b, 2, 3, tổng cộng 45 việc) **được giữ nguyên làm tham khảo**. Khi thu gọn, Master đề xuất lại phạm vi để chủ repo duyệt.

## Có gì ở đây

| File / thư mục | Nội dung |
|---|---|
| [THIET-KE.md](THIET-KE.md) | Thiết kế đầy đủ và mọi quyết định đã chốt (mục 9) |
| [HUONG-DAN-WORKFLOW.md](HUONG-DAN-WORKFLOW.md) | Workflow khi đã có `ag`: khái niệm, luồng, tuỳ chỉnh |
| [HUONG-DAN-THUC-HIEN.md](HUONG-DAN-THUC-HIEN.md) | Từng bước xây `ag` theo đợt, lời nhắn dán sẵn |
| [BAT-DAU.md](BAT-DAU.md) | Việc thường ngày của chủ repo khi xây `ag` |
| [VI-DU-LICH-MUA-BAN.md](VI-DU-LICH-MUA-BAN.md) | Ví dụ dùng `ag` (bản đầy đủ) để xây một app |
| [PHAN-HOI.md](PHAN-HOI.md) | Ghi chép từ việc dùng thật bản làm tay |
| `ban-phac/monitor-pixel-office.html` | Bản phác giao diện văn phòng pixel (dữ liệu giả) |
| `vi-du-lich-mua-ban/` | File thật từ dự án thử nghiệm đầu tiên |
| `../dac-ta/` | Đặc tả, đề xuất đã duyệt, các việc, thứ tự giao |
| `../templates/` | Tài liệu mà `ag init` sẽ chép vào dự án dùng `ag` |
| `../AGENTS.md` | Luật cho AI đang xây repo này (giai đoạn làm tay) |
