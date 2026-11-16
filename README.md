# Multi-agent workflow

Cách để một developer dùng **nhiều AI agent** cùng làm phần mềm:
- **bạn chỉ làm việc với Master**;
- Master giao việc cho **Coder** và **Tester**, và họ có thể dùng bất kỳ AI nào;
- **không AI nào tự quyết hay tự push**: bạn là người quyết định cuối.

## Đọc 2 file

| File | Nội dung |
|---|---|
| **[HOW-IT-WORKS.md](HOW-IT-WORKS.md)** | Bài toán, các vai, một tính năng đi từ đầu đến cuối, 14 yêu cầu và cách đáp ứng, trang monitor, tối ưu token, chia tài khoản AI |
| **[SETUP.md](SETUP.md)** | Đưa workflow vào dự án mới hoặc dự án đã có, từng bước, có lời nhắn dán sẵn |

Thứ để chép vào dự án của bạn: **toàn bộ thư mục [starter-kit/](starter-kit/)**.

## Tình trạng

**Đã có:**
- Master, Coder, Tester trao đổi qua file;
- `watch.sh` tự đánh thức agent có việc;
- trang monitor văn phòng pixel chạy trên máy bạn (`node workflow/monitor.js`);
- thông báo Telegram một chiều;
- chặn `git push` cho Claude Code.

**Đang xây:** chat với Master và bấm duyệt ngay trên trang monitor; bộ công cụ `ag` với hàng rào tự động đầy đủ. Bấm **Watch → Releases** trên GitHub để được báo.

## Repo này có gì

| | Dành cho |
|---|---|
| `README.md`, `HOW-IT-WORKS.md`, `SETUP.md`, `starter-kit/` | **Người dùng** |
| `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `specs/`, `templates/`, `internal/` | Người **xây công cụ**. Người dùng không cần đọc. Xem [internal/README.md](internal/README.md) |

**Lưu ý:** đừng chép `AGENTS.md` ở gốc repo này. Thứ để chép là nội dung thư mục `starter-kit/`.
