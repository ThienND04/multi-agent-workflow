# Multi-agent workflow

Cách để một developer dùng **nhiều AI agent** cùng làm phần mềm:
- **bạn chỉ làm việc với Master**;
- Master giao việc cho **Coder** và **Tester**, và họ có thể dùng bất kỳ AI nào;
- **không AI nào tự quyết, và chỉ Master được push khi bạn cho phép**: bạn là người quyết định cuối.

## Đọc 3 file

| File | Nội dung |
|---|---|
| **[HOW-IT-WORKS.md](HOW-IT-WORKS.md)** | Bài toán, các vai, một tính năng đi từ đầu đến cuối, 14 yêu cầu và cách đáp ứng, trang monitor, tối ưu token, chia tài khoản AI |
| **[SETUP.md](SETUP.md)** | Đưa workflow vào dự án mới hoặc dự án đã có, từng bước, có lời nhắn dán sẵn |
| **[EXAMPLE.md](EXAMPLE.md)** | Ví dụ thật từ đầu đến cuối: làm trang giới thiệu công ty qua 2 tính năng, chủ dự án đã nói gì, các agent đã làm gì, lỗi gặp phải |

Thứ để chép vào dự án của bạn: **toàn bộ thư mục [starter-kit/](starter-kit/)**.

## Tình trạng

**Đã có:**
- Master, Coder, Tester trao đổi qua file;
- `watch.sh` tự đánh thức agent có việc;
- trang monitor văn phòng pixel chạy trên máy bạn, mở kèm `sh workflow/watch.sh` (dừng: `--stop`, chạy lại: `--restart`);
- thông báo Telegram một chiều;
- chặn `git push` khi chưa được bạn cho phép bằng hook git (mọi công cụ AI), thêm hộp xác nhận của Claude Code mỗi lần push.

**Đang xây:** chat với Master và bấm duyệt ngay trên trang monitor; bộ công cụ `ag` với hàng rào tự động đầy đủ. Bấm **Watch → Releases** trên GitHub để được báo.

## Repo này có gì

| | Dành cho |
|---|---|
| `README.md`, `HOW-IT-WORKS.md`, `SETUP.md`, `EXAMPLE.md`, `starter-kit/` | **Người dùng** |
| `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `specs/`, `templates/`, `internal/` | Người **xây công cụ**. Người dùng không cần đọc. Xem [internal/README.md](internal/README.md) |

**Lưu ý:** đừng chép `AGENTS.md` ở gốc repo này. Thứ để chép là nội dung thư mục `starter-kit/`.
