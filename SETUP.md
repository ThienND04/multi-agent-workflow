# Triển khai

Đưa workflow vào **dự án mới** hoặc **dự án đã có**, từng bước. Muốn hiểu workflow chạy thế nào thì đọc [HOW-IT-WORKS.md](HOW-IT-WORKS.md) trước.

## 0. Cần gì

| Cần | Để làm gì |
|---|---|
| **Git**, kèm **Git Bash** nếu dùng Windows | Chạy `watch.sh` và `notify.sh` |
| **Node.js 18 trở lên** (tuỳ chọn) | Chạy trang monitor `monitor.js` |
| **Claude Code**: ứng dụng desktop (tab Code) hoặc bản dòng lệnh | Phiên chat với Master. Master tự gọi Coder, Tester dưới dạng **subagent**, không cần cài thêm gì |
| Công cụ AI **chạy được bằng lệnh** (tuỳ chọn) | Agent đánh thức tự động, ví dụ Claude Code dòng lệnh (`claude`), Codex CLI (`codex`), Gemini CLI (`gemini`) |
| `curl` (tuỳ chọn) | Gửi Telegram. Có sẵn trên Windows 10 trở lên, macOS, Linux |
| Công cụ AI khác, ví dụ Antigravity (tuỳ chọn) | Agent đánh thức tay, hợp với vai Tester độc lập |

**Đã có:**
- toàn bộ luồng: Master, khảo sát, hỏi đáp, code, test, báo cáo, nhiều tính năng song song;
- đánh thức tự động;
- `STATUS.md`;
- trang monitor văn phòng pixel (chỉ xem);
- Telegram một chiều.

**Chưa có:** chat với Master và bấm duyệt ngay trên trang web.

## 1. Chép bộ khởi đầu vào dự án

Chép **toàn bộ nội dung** thư mục [starter-kit/](starter-kit/) vào **thư mục gốc** dự án:

```
AGENTS.md                  luật chung cho mọi agent, quy tắc to:
CLAUDE.md                  Claude Code tự đọc: phiên chính là Master
.gitattributes             giữ script .sh xuống dòng LF
.claude/
  settings.json            quyền cho Claude Code: chặn git push, chặn đọc .env
  agents/                  subagent Coder, Tester mà Master tự gọi
workflow/
  agents.txt               danh sách agent và cách đánh thức (bạn điền ở bước 4)
  watch.sh                 theo dõi file, đánh thức agent, sinh STATUS.md
  monitor.js               trang theo dõi local
  notify.sh                gửi Telegram
  .gitignore               bỏ qua các file do watch.sh sinh ra
```

**Dự án đã có `AGENTS.md`, `CLAUDE.md`, `.gitattributes` hay `.claude/settings.json` riêng:** đừng ghi đè.
- `AGENTS.md`: đổi tên file của bộ khởi đầu thành `AGENTS-WORKFLOW.md`, rồi thêm vào cuối file cũ dòng `Đọc và làm theo AGENTS-WORKFLOW.md.`
- `CLAUDE.md`, `.gitattributes`: chép nội dung của bộ khởi đầu vào cuối file cũ.
- `.claude/settings.json`: gộp các dòng trong `allow` và `deny` vào file cũ.

## 2. Bật Telegram (tuỳ chọn, khoảng 5 phút)

1. Trong Telegram, nhắn **@BotFather** lệnh `/newbot` và đặt tên cho bot. BotFather trả về một **token**. Giữ bí mật token này, không dán vào chat với AI.
2. Mở chat với bot vừa tạo, bấm **Start**, gửi một tin bất kỳ.
3. Trên trình duyệt, mở `https://api.telegram.org/bot<TOKEN>/getUpdates` và tìm `"chat":{"id":…}`. Con số đó là **chat ID**.
4. Tạo file `.env` ở thư mục gốc dự án, rồi thêm `.env` vào `.gitignore`:
   ```
   TELEGRAM_BOT_TOKEN=<token>
   TELEGRAM_CHAT_ID=<chat id>
   ```
   Thay cả cụm `<token>` và `<chat id>` bằng giá trị thật, **bỏ luôn dấu `< >`**, không để khoảng trắng. Ví dụ dạng đúng: `TELEGRAM_BOT_TOKEN=123456789:AAH...`, `TELEGRAM_CHAT_ID=987654321`.
5. Thử:
   ```bash
   sh workflow/notify.sh "Thử thông báo"
   ```

## 3. Cài công cụ AI chạy bằng lệnh (tuỳ chọn)

**Bỏ qua bước này** nếu bạn để Coder, Tester ở chế độ `subagent` (mặc định trong `agents.txt`).

Chỉ cần bước này khi muốn agent chạy ở chế độ `auto`: `watch.sh` tự đánh thức nó, kể cả khi bạn không chat với Master, và có thể dùng tài khoản riêng. Ứng dụng Claude desktop **không** tạo lệnh này, nên cần cài thêm.

**Claude Code dòng lệnh (lệnh `claude`):**
- Windows, trong PowerShell:
  ```bash
  irm https://claude.ai/install.ps1 | iex
  ```
- macOS, Linux:
  ```bash
  curl -fsSL https://claude.ai/install.sh | bash
  ```
- Kiểm tra bằng `claude --version` và `claude doctor`. Trên Windows, nếu gõ `claude` mà lại mở ứng dụng desktop, xem mục *"Claude Desktop overrides the claude command on Windows"* trong tài liệu khắc phục sự cố cài đặt của Claude Code.

**Dùng tài khoản Claude thứ hai cho agent tự động.** Mỗi thư mục cấu hình (biến `CLAUDE_CONFIG_DIR`) giữ một lần đăng nhập riêng, nên tài khoản thứ hai không đè lên tài khoản bạn đang dùng cho Master. Trong Git Bash:
```bash
CLAUDE_CONFIG_DIR="$HOME/.claude-acc2" claude auth login
```
Đăng nhập tài khoản thứ hai trong trình duyệt, rồi kiểm tra cho chắc đúng tài khoản:
```bash
CLAUDE_CONFIG_DIR="$HOME/.claude-acc2" claude auth status --text
```
Nếu máy có biến môi trường `ANTHROPIC_API_KEY`, Claude Code sẽ dùng khoá đó thay cho tài khoản đã đăng nhập.

**Công cụ khác** (Codex CLI, Gemini CLI…): cài và đăng nhập theo hướng dẫn của công cụ đó.

## 4. Khai báo agent: `workflow/agents.txt`

Mỗi dòng một agent: `<ID> <vai> <chế độ> <lệnh, tên subagent, hoặc ghi chú>`. Có 3 chế độ:

| Chế độ | Ai đánh thức agent | Cần cài thêm | Hợp với |
|---|---|---|---|
| **`subagent`** (mặc định) | **Master tự gọi** ngay trong phiên chat | Không | Bắt đầu nhanh, chỉ có ứng dụng Claude desktop |
| **`auto`** | `watch.sh` tự chạy lệnh | Công cụ AI dòng lệnh (bước 3) | Agent làm cả khi bạn không chat; dùng tài khoản hay công cụ khác |
| **`manual`** | Bạn mở phiên, sau khi `watch.sh` báo | Không | Công cụ không chạy được bằng lệnh, ví dụ Antigravity |

**Mặc định trong bộ khởi đầu** (chỉ cần ứng dụng Claude desktop):
```
master-F-001  master  manual    phiên chat chính
coder-01      coder   subagent  coder
tester-01     tester  subagent  tester
```
Với chế độ `subagent`, cột cuối là tên file trong `.claude/agents/`: `coder` (model nhanh), `coder-pro` (model mạnh, cho việc khó), `tester`.

**Ví dụ có thêm công cụ khác:**
```
coder-02      coder   auto      env CLAUDE_CONFIG_DIR=/c/Users/<tên-bạn>/.claude-acc2 claude -p --permission-mode acceptEdits --model sonnet
tester-02     tester  manual    Antigravity
```
Lệnh mẫu cho chế độ `auto` (kiểm tra lại theo phiên bản bạn cài):
- Claude Code: `claude -p --permission-mode acceptEdits`, thêm `--model sonnet` hoặc `--model opus` tuỳ việc;
- Codex CLI: `codex exec --full-auto`;
- Gemini CLI: `gemini --yolo -p`.

**Master** luôn để `manual`, vì bạn đang chat với nó. Khi có việc chờ Master, `watch.sh` báo bạn và bạn nói với Master một câu *"Xử lý việc đang chờ"*.

**Cấp quyền cho agent** (cả `subagent` lẫn `auto`) để nó chạy được lệnh build và test của dự án: thêm vào danh sách `allow` trong `.claude/settings.json`, ví dụ `"Bash(npm test:*)"` hoặc `"Bash(./gradlew test:*)"`. `git push` đã bị chặn sẵn. Agent `auto` chạy không có người canh, nên chỉ cấp đúng những gì cần.

**Thử một agent `auto` có chạy đúng tài khoản không** (tại thư mục dự án):
```bash
CLAUDE_CONFIG_DIR="$HOME/.claude-acc2" claude -p "Trả lời đúng một chữ: sẵn sàng" --model sonnet
```

## 5. Lần đầu mở Master

Mở Claude Code **tại thư mục dự án** (với ứng dụng desktop: chọn thư mục dự án khi tạo phiên), rồi dán một trong hai lời nhắn sau.

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

Đọc `workflow/DECISIONS.md`, sửa nếu cần, rồi nói **"duyệt"**. File này là "nguồn" để các agent khỏi phải hỏi những việc nhỏ.

## 6. Chạy `watch.sh` và trang monitor

**`watch.sh`:** mở một cửa sổ terminal riêng (Git Bash trên Windows) tại thư mục dự án:
```bash
sh workflow/watch.sh
```
Để cửa sổ đó chạy; bấm `Ctrl+C` khi muốn dừng.
- `--interval 60`: quét mỗi 60 giây (mặc định 30 giây).
- `--once`: quét đúng một lần.
- Mỗi lần đánh thức một agent tự động đều có log trong `workflow/logs/`.

**Trang monitor:** mở thêm một terminal tại thư mục dự án:
```bash
node workflow/monitor.js
```
Rồi mở **http://localhost:4300**. Đổi cổng bằng `--port 5000`.
- Khu **"Cần bạn"** ở trên cùng.
- **Văn phòng pixel:**
  - mỗi tính năng là **một dãy bàn** có thảm màu riêng;
  - Master ngồi bàn lớn đầu dãy, Coder và Tester ở các bàn kế tiếp; dãy dài thì tự xuống hàng;
  - bong bóng trên đầu: `…` đang chạy, số là số việc đang chờ, `z` là rảnh;
  - agent rảnh đứng ở cây nước, cửa mở nghĩa là có việc chờ bạn.
- **Bấm vào một agent** để xem file đang chờ nó và log gần nhất.
- Trang tự làm mới 3 giây một lần, **chỉ đọc**, và chỉ mở trên máy bạn: máy khác trong mạng không vào được.

Không muốn chạy trang web thì mở `workflow/STATUS.md`. Trong VS Code, bản xem trước Markdown (`Ctrl+Shift+V`) tự cập nhật khi file đổi.

## 7. Làm một tính năng

Trong phiên Master, dán:
```text
Tính năng mới: <bạn muốn gì, cho ai, chạy trên đâu, dữ liệu từ đâu>.
Hỏi tôi đến khi đủ để viết tài liệu có tiêu chí kiểm được. Không tự quyết.
Giao việc theo các agent trong workflow/agents.txt.
```

Từ đây:

| Khi | Ai làm gì |
|---|---|
| Master hỏi để làm rõ | Bạn trả lời. Đọc `SPEC.md`, rồi nói **"duyệt"** |
| Coder, Tester khảo sát, hỏi, code, test | **Tự chạy**: chế độ `subagent` thì Master tự gọi; chế độ `auto` thì `watch.sh` đánh thức. Nếu Master dừng giữa chừng, nói *"Tiếp tục"* |
| Có việc chờ Master (`to: master-F-001`) | `watch.sh` báo. Bạn nói với Master: *"Xử lý việc đang chờ."* |
| Có câu Master không chắc (`to: owner`) | `watch.sh` báo, kể cả qua Telegram. Bạn trả lời Master và bàn tới khi chốt |
| Có việc cho agent đánh thức tay | `watch.sh` báo. Bạn mở phiên cho agent đó và dán lời nhắn bên dưới |
| Báo cáo xong (`SPEC.md` có `to: owner`) | Bạn tự thử theo mục "Cách thử", rồi nói **"đạt"** hoặc chỉ ra chỗ chưa đạt |
| Master đã gộp code | **Bạn push:** `git push origin main` |

**Lời nhắn cho agent đánh thức tay** (ví dụ Tester trên Antigravity):
```text
Đọc AGENTS.md và làm theo. ID của bạn: tester-01. Vai: Tester.
Xử lý các file trong workflow/ có dòng "to: tester-01". Xong phần của mình thì đổi to: sang người kế tiếp.
```

## 8. Làm nhiều tính năng cùng lúc

Mở thêm một phiên Master tại cùng thư mục dự án và làm lại bước 7 với tính năng khác. Master đó có ID `master-F-002`; thêm một dòng cho nó trong `agents.txt`. Một `watch.sh` lo đánh thức agent cho mọi tính năng.

## 9. Khi một phiên bị dừng

- **Agent `subagent`:** nói với Master *"Tiếp tục"*; Master gọi lại subagent, subagent đọc bàn giao rồi làm tiếp.
- **Agent `auto`:** không cần làm gì. Lần tới file của nó thay đổi, nó được đánh thức lại. Nếu `STATUS.md` hoặc trang monitor báo *"đã đánh thức nhưng chưa xử lý xong"*, hãy xem log trong `workflow/logs/`.
- **Master:** mở phiên mới tại thư mục dự án, dán:
  ```text
  Đọc AGENTS.md và làm theo. Bạn là master-F-001, làm tiếp.
  Đọc SPEC.md của F-001 và các file có "to: master-F-001".
  ```

## 10. Thử nhanh cơ chế đánh thức (không tốn token)

1. Trong `workflow/agents.txt`, thêm dòng:
   ```
   thu-01  coder  auto  echo
   ```
2. Tạo file `workflow/F-001-thu/tasks/T-01.md` với nội dung:
   ```
   ---
   id: T-01
   title: Việc thử
   status: ready
   to: thu-01
   ---
   ```
3. Chạy:
   ```bash
   sh workflow/watch.sh --once
   ```
4. Trong `workflow/logs/` có một file log chứa lời nhắn đánh thức là cơ chế đã chạy đúng. `STATUS.md` sẽ báo *"đã đánh thức nhưng chưa xử lý xong"*: điều này là bình thường, vì `echo` không đổi `to:` như một agent thật.
5. Xoá thư mục `workflow/F-001-thu/`, thư mục `workflow/logs/` và dòng vừa thêm trong `agents.txt`.
