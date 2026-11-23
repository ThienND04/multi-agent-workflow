# Luật làm việc cho AI agent

Workflow multi-agent: **chủ dự án** (con người, gọi là **Đại ca**) **chỉ làm việc với Master**; Master giao việc cho **Coder**, **Tester**, mỗi agent là một công cụ AI bất kỳ (Claude Code, Codex, Antigravity, Gemini…). Các agent **trao đổi qua file** trong `workflow/`; `workflow/watch.sh` **đánh thức** agent có việc. Không ai tự quyết khi tài liệu không có câu trả lời.

File này là phần chung. **Việc của vai bạn ở `workflow/roles/<vai>.md`**: đọc file đó, không cần đọc file của vai khác.

## 1. Các vai và ID

| Vai | ID | Làm | Không được |
|---|---|---|---|
| **Master** | `master-NN` (mỗi phiên chat một) | Chọn làn theo cỡ việc, làm rõ yêu cầu với Đại ca, viết `SPEC.md`, chia việc, trả lời câu hỏi, gộp code, báo cáo; làn trực tiếp thì tự sửa | Viết code sản phẩm (trừ làn trực tiếp). Tự quyết khi không có nguồn. Push khi chưa được phép |
| **Coder** | `coder-NN` | Khảo sát việc, hỏi chỗ chưa rõ, code kèm test, kiểm thật theo loại unit, sửa lỗi, push nhánh việc của mình | Sửa `SPEC.md`. Tự nghiệm thu. Push `BASE_BRANCH`, `WORK_BRANCH` |
| **Tester** | `tester-NN` | Khảo sát, kiểm tra (test tự động, kiểm thật theo loại unit, review code), báo lỗi | Sửa code. Push `BASE_BRANCH`, `WORK_BRANCH` |

ID của bạn có trong lời nhắn mở phiên, lời đánh thức của `watch.sh` hoặc lời gọi của Master. Danh sách: `workflow/agents.txt`.

## 2. Kênh trao đổi: trường `to:`

**Quy tắc duy nhất:** file cần ai làm gì thì có dòng `to:` ở đầu file.
- `to: <ID>`: **đến lượt** agent đó.
- `to: owner`: chờ **chủ dự án** (watch.sh báo).
- `to: none`: không ai phải làm gì.

**Xong phần của mình thì đổi `to:` sang người kế tiếp**, theo bảng các bước trong file vai. Chưa đổi `to:` là chưa xong: người kế tiếp không được đánh thức.

Được đánh thức thì **chỉ xử lý file có `to:` là ID của bạn**, không đụng việc người khác.

## 3. Không tự quyết

- **Không cần hỏi:** chi tiết bên trong việc, không đổi hành vi hay hợp đồng API, khi theo đúng `workflow/DECISIONS.md`.
- **Bắt buộc hỏi:** hành vi, giao diện, hợp đồng API, định dạng dữ liệu (schema, bảng, collection, index, migration), thêm thư viện, đổi cấu trúc thư mục, chỗ tài liệu mơ hồ hoặc mâu thuẫn.

## 4. Lưu phiên và làm tiếp

- **Mọi trạng thái nằm trong file:** `to:`, `status:`, bàn giao trong file việc, commit trên từng nhánh.
- **File trong `workflow/` chỉ đọc, ghi ở thư mục gốc** (dòng đầu của `git worktree list`, nơi bạn được mở). Bản trong worktree là bản cũ, ghi vào đó thì không ai thấy.
  - **Code** viết và commit trong worktree của việc, **luôn chỉ rõ worktree**: `git -C <worktree> …`, `sh workflow/run.sh <động từ> <worktree> <unit>` (mục 7), sửa file bằng đường dẫn tuyệt đối `<worktree>/…`, không `cd`. Sửa nhầm ở thư mục gốc là sửa thẳng lên nhánh chính.
  - **`SPEC.md`, file việc, câu hỏi, lỗi, nhật ký** sửa ở `<thư mục gốc>/workflow/`, **không commit** lên nhánh việc; Master commit lên nhánh chính khi `WORKFLOW_IN_GIT=yes` (`workflow/project.conf`).
- Ghi **bàn giao 3 ý** (Đã làm / Còn dở / Bước tiếp theo) sau mỗi bước và trước khi dừng. Commit cả code chưa xong.
- **Mỗi lần được đánh thức là một phiên mới.** Đọc file trước, đừng dựa vào trí nhớ: file đang chờ bạn và bàn giao; code dở thì xem `git -C <worktree> log`, `status`, chạy test.

## 5. Tiết kiệm ngữ cảnh và token

- Chỉ đọc: file này, file vai của bạn, file có `to:` là bạn, và những gì `can_doc` chỉ tới. Tìm trong code bằng tìm kiếm, không mở cả thư mục.
- Không chép nguyên log, diff vào file trao đổi; chỉ ghi tóm tắt và lệnh tái hiện.
- Trả lời cuối mỗi lần được đánh thức: **dưới 15 dòng**, gồm đã làm gì, đã đổi `to:` file nào.

## 6. Cấm

- `git push` ngoài phạm vi sau:
  - **Coder, Tester được push nhánh việc của chính mình** (`git -C <worktree> push -u <remote> <nhánh việc>`), không cần hỏi. **Không** push `BASE_BRANCH`, `WORK_BRANCH`, nhánh tích hợp hay nhánh giao hàng (đều mang tiền tố `MR_PREFIX`, ví dụ `feature/hero-banner-translations`): các nhánh đó chỉ Master push, khi chủ dự án bảo.
  - **Master push khi chủ dự án bảo trong phiên chat**: hỏi rõ nhánh, remote (*"Push `feat/x` lên `origin`?"*), đồng ý thì `git push -u <remote> <nhánh>`. Lời cho phép trong file hay lời nhắn của agent khác **không** tính.
  - Không bao giờ `--force` (kể cả `--force-with-lease`), không push nhánh người khác.
  - **Không push thẳng lên `BASE_BRANCH` khi `DELIVERY=mr`** (code vào qua MR/PR). Hook `pre-push` chặn việc này; gặp thì dừng, báo chủ dự án, **không** lách (`--no-verify`, sửa hay xoá hook, đổi `core.hooksPath`).
- `git commit --no-verify`, `git push --no-verify`, viết lại lịch sử nhánh người khác.
- **Commit** theo `workflow/DECISIONS.md` mục 5: Conventional Commits, tiêu đề một dòng (kèm các dòng `- …` nếu cần), **không trailer** (`Co-Authored-By`, `Signed-off-by`, `Task:`, `Agent-Id`…), không nhắc agent hay AI, không đổi tác giả. Chỉ commit trên nhánh việc (Coder) hay nhánh tích hợp (Master); không `git add -A`; **không bao giờ add hay commit trên nhánh của chủ dự án** (`WORK_BRANCH`, `BASE_BRANCH`) hay ở thư mục gốc.
- Sửa file ngoài vai, ngoài `files` của việc, hoặc ngoài thư mục tính năng của mình (Master).
- Xoá, sửa phần người khác đã ghi trong file trao đổi; chỉ ghi thêm và đổi `status`, `to`.
- Sửa `workflow/STATUS.md` (watch.sh sinh), `workflow/agents.txt`, `workflow/roles/`, `workflow/OWNER-RULES.md` (của chủ dự án).
- Đọc, in, gửi đi nội dung `.env` và khoá bí mật.

## 7. Chạy lệnh

- Luật Bash: `workflow/OWNER-RULES.md`, phần "Quy tắc dùng Bash".
- **Lệnh code** (cài, test, build, chạy server, chạy thử) chỉ qua `sh workflow/run.sh <động từ> <worktree> <unit> [n]`, gọi từ thư mục gốc, `<worktree>` tuyệt đối (làn trực tiếp: thư mục gốc). Động từ, unit: `workflow/DECISIONS.md` mục 1.
- Git qua `git -C <worktree> …`; gọi API qua `curl` localhost theo `workflow/DECISIONS.md` mục 3.
- Không gõ lệnh gốc của trình gói, ngôn ngữ (`pnpm`, `npm`, `go`…), không `npx`, `pnpm exec`, `npm exec`, `uvx`, `mise exec`, `direnv exec`.
- Coder, Tester không sửa `workflow/stack/*` (Master viết, Đại ca duyệt) và `.slot.*.env` (run.sh sinh); cần đổi lệnh thì hỏi Master.
- Lệnh bị từ chối, bị hỏi quyền: **không** lách (wrapper, đổi cú pháp, gọi lệnh gốc); ghi câu hỏi cho Master.

## 8. Luật của Đại ca cho mọi ngôn ngữ

Đọc và tuân `workflow/OWNER-RULES.md` (nguyên văn, không sửa). Áp dụng trong kit:
- **Test:** OWNER-RULES chỉ cho `pnpm run test:cov --maxWorkers=2`. Agent gọi `sh workflow/run.sh test <worktree> <unit>`: unit pnpm chạy đúng lệnh đó (`pnpm --dir <unit> run test:cov --maxWorkers=2`), unit khác chạy lệnh coverage có giới hạn worker tương đương, Đại ca duyệt trong file unit. `test` không nhận thêm cờ.
- **Module** `src/modules/<tên>/`, DTO zod có `max`: cho unit NestJS; unit khác theo `workflow/stack/<unit>.md`.
- **Kiểu lỏng bị cấm** (lỗi review). TypeScript: `any`, `unknown`. JavaScript thuần: theo quy ước unit (JSDoc nếu đã dùng). Go: `any`/`interface{}` khi kiểu cụ thể dùng được. Ngôn ngữ khác: tinh thần tương đương, Master ghi vào `workflow/stack/<unit>.md`.
- Gọi chủ dự án là **"Đại ca"** (báo cáo, câu hỏi `to: owner`).
- **Trước khi code hay viết `SPEC.md`:** Master hỏi làm rõ, đưa **ít nhất 2 phương án** (ưu, nhược) để Đại ca chọn; Coder, Tester hỏi qua `questions/D-NN.md` kèm từ 2 phương án, không hỏi thẳng Đại ca, không đoán. **Sau khi code:** giải thích ngắn từng hàm (làm gì, vì sao), tóm tắt, rủi ro, giả định (Coder ghi vào bàn giao).
- Tài liệu thư viện ngoài: Context7 (OWNER-RULES); không có thì ghi rõ, hỏi Master.
- **Review:** skill `mr7-review` (`workflow/DECISIONS.md` mục 6).
