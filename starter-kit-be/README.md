# Starter kit chung (FE + BE, mọi ngôn ngữ)

Bộ workflow multi-agent cho mọi dự án: frontend, backend, CLI, thư viện, viết bằng bất kỳ ngôn ngữ nào. Cơ chế giữ nguyên: Master, Coder, Tester trao đổi qua file trong `workflow/`, `watch.sh` đánh thức, `monitor.js` hiển thị. Phần riêng của từng stack nằm gọn trong `workflow/stack/`.

## run.sh và file stack
- Agent chạy MỌI lệnh code (cài, test, build, chạy server, chạy thử) qua một lệnh: `sh workflow/run.sh <động từ> <worktree> <unit> [n]`. 12 động từ: `slot`, `setup`, `migrate`, `seed`, `test` (0 đối số, luôn chạy `test:cov --maxWorkers=2`), `e2e`, `build`, `serve`, `smoke`, `lint`, `doctor`, `teardown`. Trong đó `migrate`, `seed`, `e2e`, `serve` bắt buộc đã có `.slot.<unit>.env` (`run.sh slot` trước); `serve` kiểm `SLOT_PORT` rảnh trước và dừng mã `2` nếu cổng đang bận; `test`, `build`, `serve`, `lint`, `e2e` dừng sớm mã `2` kèm `gợi_ý=sh workflow/run.sh setup ...` nếu unit có `package.json` nhưng thiếu `node_modules`; `doctor` in `UNIT_TOOLS`, gọi `stack_doctor` (nếu có) và báo trạng thái `SLOT_PORT`; `teardown` cảnh báo nếu `SLOT_PORT` còn bận. Giá trị trong `.slot.<unit>.env` (`stack_slot_env`) tuyệt đối không chứa `&` hay ký tự điều khiển/shell; tham số DB nhiều tuỳ chọn phải tách biến riêng (`PGSSLMODE`, `PGCONNECT_TIMEOUT`, v.v.), không dùng `&` trong URI.
- Lệnh thật của mỗi unit nằm trong `workflow/stack/<unit>.sh`, kèm `<unit>.md` (quy ước riêng, lens review, cách kiểm thật, bảng kiểu lỏng). Master viết sau khi khảo sát dự án, Đại ca duyệt. Định dạng và bảng nhận diện stack: `workflow/stack/README.md`.
- Mẫu có sẵn trong `workflow/stack/examples/` (hiện chỉ backend): `nestjs-pnpm` (NestJS + MongoDB + Redis), `nestjs-postgres-prisma` (NestJS + PostgreSQL + Prisma + Redis), `express-npm` (Express + npm/pnpm), `go` (Go + PostgreSQL). Stack khác: Master tự khảo sát, viết file unit theo cùng định dạng; kit chưa có mẫu.
- Slot: mỗi worktree có cổng và tài nguyên (DB…) riêng, `run.sh slot` sinh `.slot.<unit>.env`, nên nhiều agent chạy song song an toàn (`workflow/DECISIONS.md` mục 4).
- Kiểm thật theo loại unit (`web-service`: gọi API bằng `curl`; `web-frontend`: mở trình duyệt, ảnh vào `shots/`; `cli`: `smoke`; `worker`: `smoke` dạng one-shot/drain có timeout hoặc `serve` ở nền kiểm xử lý job/log cho worker dài hạn; `library`: test): `workflow/DECISIONS.md` mục 3.

## Luật của chủ dự án: `workflow/OWNER-RULES.md`
- Bản chép nguyên văn luật riêng của chủ dự án (ở đây là `~/.claude/CLAUDE.md` của Đại ca). Mọi agent đọc và tuân; `AGENTS.md` mục 8 nói cách áp dụng cho dự án nhiều ngôn ngữ.
- Người khác dùng kit: **thay nội dung bằng luật của mình**, giữ khối chú thích đầu file, rồi xem lại `AGENTS.md` mục 8 cho khớp.

## Chép vào dự án
1. Từ thư mục kit chạy `sh install-kit.sh <thư mục gốc dự án>` (thêm `--local` cho dự án của team: kit ẩn khỏi git, chỉ có trên máy này). Script chép `.claude/`, `.agents/skills/mr7-review/`, `workflow/`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.gitattributes` (không chép README này), không ghi đè file dự án đã có: `AGENTS.md` có sẵn thì kit vào `AGENTS-WORKFLOW.md`; `settings.json` có sẵn thì gộp tay; `workflow/` đã có thì dừng. Đặt `BASE_BRANCH` theo nhánh hiện tại; `--local` tự thêm `.agents/` (hoặc `/.agents/skills/mr7-review/` nếu dự án đã có `.agents/`) cùng `.claude/`, `workflow/`, `.worktrees/`, `.mr-review/`, `.slot.*.env` vào `.git/info/exclude`.
2. Sửa `workflow/project.conf` (`BASE_BRANCH`: đích của MR và thước đo review, ví dụ `develop`; `WORK_BRANCH`: nhánh bạn đang code nếu nó đã đi trước `BASE_BRANCH`; `DELIVERY`). `install-kit.sh` đặt `BASE_BRANCH` theo nhánh hiện tại, **sai nếu đó là nhánh tính năng**, `workflow/agents.txt`, thay `workflow/OWNER-RULES.md` nếu cần.
3. Chạy `sh workflow/watch.sh --lint`.
4. Mở phiên chat Master và dán: "Bạn là master-01. Làm phần lần đầu trong dự án theo workflow/roles/master.md: khảo sát, điền workflow/DECISIONS.md, viết workflow/stack/<unit>.sh và .md, chạy thử, rồi đưa tôi duyệt."

## Lần đầu trong dự án (Master làm, chi tiết ở `workflow/roles/master.md`)
1. Chưa có git thì hỏi Đại ca trước khi `git init`.
2. Khảo sát theo thứ tự nguồn sự thật: tài liệu dự án (AGENTS.md, CLAUDE.md, CONTRIBUTING, README) → CI → runner sẵn có (Makefile, justfile, scripts trong manifest) → manifest và lockfile → file phiên bản → devcontainer, compose. Ghi bảng unit vào `DECISIONS.md` mục 1.
3. Viết `workflow/stack/<unit>.sh` và `.md` từ mẫu gần nhất, ghi nguồn lệnh; đọc danh sách biến nền từ `.env.example`/`.env.sample`/`.env.template` (**tuyệt đối không đọc `.env` thật**) để điền giá trị thử trong `stack_slot_env`, tách tham số DB thành biến riêng (không dùng `&`). Chỗ mơ hồ đưa Đại ca từ 2 phương án; thiếu script hay thư viện coverage thì hỏi Đại ca.
4. Chạy thử ở slot 0, mỗi động từ một lệnh: `sh workflow/run.sh slot <thư mục gốc> <unit> 0`, rồi `setup`, `migrate` và `seed` (nếu có), `test`, `e2e` (nếu có), `doctor` (cùng `<thư mục gốc> <unit>`), và `serve` ở nền một lúc rồi dừng nền và `teardown`.
5. Đại ca duyệt file unit, Master ghi "Đại ca duyệt: <ngày>".
6. Cài thư viện xong mới cài hook: `sh workflow/hooks/install.sh`, rồi `--check` (husky và công cụ tương tự có thể đặt `core.hooksPath` khi cài).
7. Thêm `.worktrees/` (worktree nằm trong dự án, nên agent ghi file được mà không cần cấp quyền thêm) và `.mr-review/` vào `.git/info/exclude` (`.slot.*.env` do run.sh tự thêm).
8. `DECISIONS.md` còn `TODO(` hay `[NEEDS CLARIFICATION]` thì chưa giao việc code.

## Chế độ agent (`workflow/agents.txt`)
- **subagent** (mặc định): Master tự gọi `coder`, `coder-pro`, `tester` trong `.claude/agents/` ngay trong phiên chat. Không cần cài thêm, không cần `watch.sh`.
- **auto**: `watch.sh` chạy ngầm, ví dụ `claude -p --permission-mode acceptEdits --model sonnet`. Không người canh: quyền lấy từ `.claude/settings.json`, mà file này cho phép `git push` (để Master push khi Đại ca bảo), nên agent `auto` cũng push được; chỉ luật vai cấm. Muốn chặn hẳn thì thêm cờ `--disallowedTools` cho `Bash(git push:*)` và `Bash(git -C * push:*)` vào lệnh trong `agents.txt` (cần kiểm cú pháp theo phiên bản Claude Code).
- **window**, **manual**: mở cửa sổ terminal, hoặc báo và chép lời nhắn để bạn dán (xem chú thích trong `agents.txt`). Có agent ở ba chế độ này thì chạy `sh workflow/watch.sh`.

## Lưu ý đã gặp khi thử trên dự án thật (Express + Mongo, npm workspaces)
- Mở `claude` **trong thư mục dự án** và bấm tin cậy một lần. Phiên `claude -p` (agent `auto`) của workspace chưa tin cậy bỏ qua `permissions.allow` của dự án (cảnh báo "Ignoring … permissions.allow").
- `watch.sh`, `install.sh` tìm gốc dự án theo thư mục hiện tại: chạy chúng từ trong dự án.
- npm đời mới chặn script cài đặt của vài gói (ví dụ `bcrypt`). Module native thường vẫn nạp nhờ bản dựng sẵn; không thì xem `npm install-scripts ls` và quyết duyệt từng gói.
- Hook pre-commit của dự án (lint-staged, prettier) có thể định dạng lại file Coder commit, làm diff có dòng đổi cách viết ngoài phạm vi. Bình thường; review ghi INFO.
- Script chạy server của dự án mở cổng cố định khác (ví dụ `nodemon --inspect` 9229) thì không dùng cho `stack_serve`: hai slot sẽ đụng nhau. Gọi thẳng lệnh chạy app.
- Gọi `mr7-review` phải nêu đường dẫn `SPEC.md`, file việc và `workflow/stack/<unit>.md` (nằm ngoài diff), nếu không Stage 1 chỉ báo "không có spec". Skill kèm sẵn trong `.claude/skills/mr7-review/` (Claude Code) và `.agents/skills/mr7-review/` (Antigravity), có checklist cho Node, NestJS, Go do kit viết.
- Công cụ Workflow của Claude Code cần người duyệt, nên không chạy được trong phiên không giao diện.
- Hồ sơ một vòng thử thật (F-001, file unit `server`, báo cáo review): `internal/trial-onetimesecret/` của repo công cụ.

## Giới hạn đã biết
- Windows: cần Git Bash (`run.sh`, `watch.sh`, hook là POSIX sh).
- Quyền chỉ cấu hình sẵn cho Claude Code (`.claude/settings.json`). Codex, Gemini, Antigravity cấu hình quyền riêng theo công cụ: cho phép `sh workflow/run.sh …`, `git`, `curl` localhost; chặn push, `--no-verify`, `npx` và tương tự. `GEMINI.md` hỗ trợ cả phiên Master chính lẫn phiên Worker có ID (tương đương `CLAUDE.md`), còn `.agents/skills/mr7-review/` cung cấp sẵn skill review cho Antigravity.
- Ở chế độ `subagent`, `.claude/agents/{coder,coder-pro,tester}.md` đã khoá qua `disallowedTools` các quyền `Edit`/`Write` trên `workflow/stack/**`, `Edit`/`Write` trên `workflow/DECISIONS.md` và `workflow/OWNER-RULES.md`, (riêng `tester` khoá thêm `git commit`). Push không bị khoá ở công cụ: Coder, Tester được push nhánh việc của mình, còn `BASE_BRANCH`, `WORK_BRANCH` và force push chỉ chặn bằng luật vai (`AGENTS.md` mục 6), `settings.json` (deny force) và hook `pre-push`. Với agent chạy độc lập ngoài `subagent` (`auto`, `window`, `manual`), `settings.json` chung không chặn Edit/Write để Master còn dùng: khi đó dựa vào luật vai và Tester kiểm diff (file stack không được nằm trong diff của nhánh việc).
- Dạng quyền có `*` ở giữa lệnh (`curl -X * http://localhost:*`, `git -C * push …`) phụ thuộc phiên bản Claude Code. Bị hỏi quyền dù đã khai thì đối chiếu cú pháp theo phiên bản đang dùng, đừng đổi lệnh để lách.
- Quy tắc `curl` và dấu `&`: rule allow dùng `http://localhost:*` và `http://127.0.0.1:*` (có dấu `:`), khi URL đứng ngay sau `curl`, sau `-s`/`-sS`/`-i`, hoặc sau `-X <method>`; cờ `-H`, `-G`, `-d` đặt SAU URL. **Tuyệt đối không dùng ký tự `&` trong lệnh `curl`** (kể cả bọc trong dấu nháy) vì bất kỳ ký tự `&` nào cũng làm mất hiệu lực rule allow của Claude Code và bật hỏi quyền; khi cần nhiều query params, bắt buộc viết `curl http://localhost:<SLOT_PORT>/... -G -d "page=1" -d "limit=20"`. Quy tắc khớp theo chuỗi, người duyệt vẫn cần đọc URL.
- `settings.json` chặn `Read(**/.env)` và `Read(**/.env.*)` trên mọi thư mục con monorepo, đồng thời khai allow cho `.claude/skills/**`, `.agents/skills/**`, `.env.example`, `.env.sample`, `.env.template` và `.slot.*.env`. Lưu ý cơ chế ưu tiên của Claude Code: `deny` luôn thắng `allow`, nên quy tắc `Read(**/.env.*)` cũng sẽ chặn công cụ `Read` đọc `.env.example`, `.env.sample`, `.env.template` (trong khi `.slot.*.env` và các skill vẫn đọc được bằng `Read`). Khi `Read` bị chặn ở các file mẫu env này, Master lấy danh sách tên biến qua shell (hoặc `stack_setup` sao chép từ `.env.example`), tuyệt đối không đọc `.env` thật.
- Deny `pnpm test`, `npm test` (cả dạng `run test`, `--dir`, `--prefix`) khớp theo từ nên không chặn nhầm `test:cov`; chúng chỉ áp cho lệnh agent gõ, lệnh bên trong `run.sh` không đi qua quyền. Thử lại sau khi cài kit.
