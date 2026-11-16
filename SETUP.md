# Triển khai

Đưa workflow vào **dự án mới** hoặc **dự án đã có**, từng bước. Muốn hiểu workflow chạy thế nào thì đọc [HOW-IT-WORKS.md](HOW-IT-WORKS.md) trước.

## 0. Cần gì

| Cần | Để làm gì |
|---|---|
| **Git** và một shell `sh` | Chạy `watch.sh`. Trên Windows dùng **Git Bash** (cài cùng Git) |
| **Claude Code** | Master (phiên chat chính) |
| Ít nhất một công cụ AI **chạy được bằng lệnh** | Agent tự động, ví dụ Claude Code CLI (`claude`), Codex CLI (`codex`), Gemini CLI (`gemini`) |
| `curl` (tuỳ chọn) | Gửi Telegram. Có sẵn trên Windows 10 trở lên, macOS, Linux |
| Công cụ AI khác, ví dụ Antigravity (tuỳ chọn) | Agent đánh thức tay, hợp với vai Tester độc lập |

**Hôm nay dùng được:**
- toàn bộ luồng: Master, khảo sát, hỏi đáp, code, test, báo cáo, nhiều tính năng song song;
- đánh thức tự động;
- `STATUS.md`;
- Telegram một chiều.

**Chưa có:** trang web monitor.

## 1. Chép bộ khởi đầu vào dự án

Chép **toàn bộ nội dung** thư mục [starter-kit/](starter-kit/) vào **gốc** dự án:

```
AGENTS.md                  luật chung, quy tắc to:
CLAUDE.md                  Claude Code tự đọc
.claude/settings.json      quyền cho Claude Code: CHẶN git push, chặn đọc .env
.claude/agents/            (tuỳ chọn) subagent cho Master dùng Claude Code
workflow/
  agents.txt               danh sách agent, bạn điền ở bước 3
  watch.sh                 script theo dõi và đánh thức
  notify.sh                gửi Telegram
  .gitignore               bỏ qua các file watch.sh sinh ra
```

**Dự án đã có `CLAUDE.md`, `AGENTS.md` hay `.claude/settings.json` riêng:** đừng ghi đè.
- Gộp phần trong bộ khởi đầu vào file cũ, hoặc đổi tên `AGENTS.md` mới thành `AGENTS-WORKFLOW.md` và thêm vào file cũ dòng `Đọc và làm theo AGENTS-WORKFLOW.md.`
- Với `settings.json`, chép phần `permissions` sang file cũ.

## 2. Bật Telegram (tuỳ chọn, 5 phút)

1. Trong Telegram, nhắn **@BotFather** lệnh `/newbot`, đặt tên. BotFather trả về **token**. Giữ bí mật.
2. Mở chat với bot, bấm **Start**, gửi một tin bất kỳ.
3. Trên trình duyệt, mở `https://api.telegram.org/bot<TOKEN>/getUpdates`, tìm `"chat":{"id":…}`. Số đó là **chat ID**.
4. Tạo `.env` ở gốc dự án, rồi thêm `.env` vào `.gitignore`:
   ```
   TELEGRAM_BOT_TOKEN=<token>
   TELEGRAM_CHAT_ID=<chat id>
   ```
5. Thử:
   ```bash
   sh workflow/notify.sh "Thử thông báo"
   ```

## 3. Khai báo agent: `workflow/agents.txt`

Mỗi dòng một agent:
```
<ID>          <vai>    <auto|manual>  <lệnh đánh thức, hoặc ghi chú>
master-F-001  master   manual         phiên chat chính
coder-01      coder    auto           claude -p --permission-mode acceptEdits
tester-01     tester   manual         Antigravity
```

- **`auto`:** `watch.sh` tự chạy lệnh, thêm lời nhắn đánh thức vào cuối lệnh. Lệnh ví dụ (kiểm tra lại theo phiên bản bạn cài):
  - Claude Code: `claude -p --permission-mode acceptEdits`, thêm `--model <tên model>` nếu muốn;
  - Codex CLI: `codex exec --full-auto`;
  - Gemini CLI: `gemini --yolo -p`.
- **`manual`:** `watch.sh` chỉ báo bạn. Bạn mở phiên cho agent đó và dán lời nhắn ở mục 6.
- **Master** nên để `manual`, vì bạn đang chat với nó. `watch.sh` sẽ nhắc bạn bảo Master xử lý việc đang chờ.

**Agent tự động chạy không có người canh.** Hãy cấp đủ quyền để nó làm việc, và không hơn:
- **Claude Code:** thêm lệnh build và test của dự án vào danh sách `allow` trong `.claude/settings.json`, ví dụ `"Bash(npm test:*)"` hay `"Bash(./gradlew test:*)"`. `git push` đã bị chặn sẵn.
- **Công cụ khác:** dùng cơ chế sandbox hay phê duyệt của công cụ đó.

**Coder chạy bằng tài khoản Claude thứ hai:** lệnh `claude` dùng tài khoản đang đăng nhập trong thư mục cấu hình của nó. Muốn tách tài khoản, chạy CLI với một thư mục cấu hình riêng (biến môi trường `CLAUDE_CONFIG_DIR`), đăng nhập tài khoản #2 một lần trong thư mục đó, rồi viết lệnh đánh thức là:
```
coder-01  coder  auto  env CLAUDE_CONFIG_DIR=<đường-dẫn> claude -p --permission-mode acceptEdits
```
Kiểm tra lại tên biến này với phiên bản Claude Code bạn đang dùng.

## 4. Lần đầu mở Master

Mở Claude Code **tại thư mục dự án**, dán một trong hai lời nhắn sau.

**Dự án mới:**
```text
Đọc AGENTS.md và làm theo. Bạn là Master. Đây là dự án mới.
Dựng thư mục workflow/ theo mục 3 của AGENTS.md (hỏi tôi trước khi git init).
```

**Dự án đã có code:**
```text
Đọc AGENTS.md và làm theo. Bạn là Master. Đây là dự án đã có code.
Khảo sát dự án (cấu trúc, cách build, cách chạy test, quy ước đang dùng), chạy test để biết hiện trạng,
ghi những gì tìm được vào workflow/DECISIONS.md. Cho tôi xem trước khi commit.
```

Đọc `workflow/DECISIONS.md`, sửa nếu cần, nói **"duyệt"**.

## 5. Chạy `watch.sh`

Mở một cửa sổ terminal riêng (Git Bash trên Windows) tại thư mục dự án:
```bash
sh workflow/watch.sh
```
Để cửa sổ đó chạy. Muốn dừng thì bấm `Ctrl+C`.

- `--interval 60`: quét mỗi 60 giây (mặc định 30).
- `--once`: quét đúng một lần.
- **Theo dõi:** mở `workflow/STATUS.md`.
- **Xem agent tự động đã làm gì:** đọc log trong `workflow/logs/`.

## 6. Làm một tính năng

Trong phiên Master, dán:
```text
Tính năng mới: <bạn muốn gì, cho ai, chạy trên đâu, dữ liệu từ đâu>.
Hỏi tôi đến khi đủ để viết tài liệu có tiêu chí kiểm được. Không tự quyết.
Giao việc theo các agent trong workflow/agents.txt.
```

Từ đây:

| Khi | Ai làm |
|---|---|
| Master hỏi để làm rõ | Bạn trả lời. Đọc `SPEC.md`, nói **"duyệt"** |
| Coder, Tester khảo sát, hỏi, code, test | **Tự chạy:** `watch.sh` đánh thức họ qua `to:` |
| Có câu hỏi chờ Master (`to: master-F-001`) | `watch.sh` báo. Bạn nói với Master: *"Xử lý việc đang chờ."* |
| Có câu Master không chắc (`to: owner`) | `watch.sh` báo (Telegram). Bạn trả lời Master, bàn tới khi chốt |
| Có việc cho agent đánh thức tay | `watch.sh` báo. Bạn mở phiên cho agent đó, dán lời nhắn dưới đây |
| Báo cáo xong (`SPEC.md` `to: owner`) | Bạn tự thử theo "Cách thử", nói **"đạt"** hoặc chỉ ra chỗ chưa đạt |
| Master đã gộp code | **Bạn push:** `git push origin main` |

**Lời nhắn cho agent đánh thức tay** (ví dụ Tester trên Antigravity):
```text
Đọc AGENTS.md và làm theo. ID của bạn: tester-01. Vai: Tester.
Xử lý các file trong workflow/ có dòng "to: tester-01". Xong phần của mình thì đổi to: sang người kế tiếp.
```

## 7. Làm nhiều tính năng cùng lúc

Mở thêm một phiên Master mới tại cùng thư mục và làm lại mục 6 với tính năng khác. Master đó dùng ID `master-F-002`; thêm một dòng cho nó trong `agents.txt`. `watch.sh` lo đánh thức agent cho cả hai tính năng.

## 8. Khi một phiên bị dừng

- **Agent tự động:** không cần làm gì. Lần tới file của nó thay đổi, nó được đánh thức lại. Nếu `STATUS.md` báo *"đã đánh thức nhưng chưa xử lý xong"*, hãy xem log trong `workflow/logs/`.
- **Master:** mở phiên mới, dán:
  ```text
  Đọc AGENTS.md và làm theo. Bạn là master-F-001, làm tiếp. Đọc SPEC.md và các file có "to: master-F-001".
  ```

## 9. Thử nhanh cơ chế đánh thức

Chưa muốn để AI thật chạy? Thử bằng một "agent giả":
1. Trong `agents.txt`, viết `coder-01 coder auto echo`.
2. Tạo một file việc có dòng `to: coder-01`.
3. Chạy:
   ```bash
   sh workflow/watch.sh --once
   ```
4. Xem `workflow/logs/`: có một log ghi lại lời nhắn đánh thức là đúng.
