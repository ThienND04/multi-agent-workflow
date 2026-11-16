# Đặc tả Giai đoạn 1: khung `.agents/` và lệnh `ag`

**Trạng thái:** **Đã duyệt** ngày 16/11/2026 (chủ dự án duyệt toàn bộ 8 điểm ở mục 9). Viết bởi vai Master.
**Nguồn:** `noi-bo/THIET-KE.md` (thiết kế tổng thể, các quyết định ở mục 9).
**Các việc:** `dac-ta/viec-gd1/T-001.md` … `T-013.md`, đã chuyển sang `approved` ngày 16/11/2026 (Master duyệt theo điểm 6, mục 9).

Mọi đề xuất trong bản nháp đã được chủ dự án duyệt (mục 9). Thay đổi về sau phải ghi vào mục 10 "Lịch sử thay đổi" và được chủ dự án duyệt lại.

---

## 1. Phạm vi

**Có trong Giai đoạn 1:**
- Lệnh `ag` với đủ các lệnh ở mục 5.
- `ag init` dựng khung cho một repo bất kỳ.
- Nhánh trạng thái `agents-state`, khoá ghi, sổ sự kiện `events.jsonl`.
- Git hook chặn commit sai vai hoặc ngoài phạm vi.
- Bộ tài liệu cho agent: `AGENTS.md`, `WORKFLOW.md`, `roles/*.md`, `project.md` mẫu.
- Test tự động cho tất cả các phần trên, cộng một kịch bản chấp nhận đầu-cuối chạy bằng 2 công cụ AI khác nhau.

**Không có trong Giai đoạn 1:** liên kết hai repo ở hai máy khác nhau; Monitor, `STATUS.md`, Telegram (Giai đoạn 2); trang web (Giai đoạn 3); đóng gói npm (Giai đoạn 4).

## 2. Môi trường và ràng buộc kỹ thuật

| Mục | Yêu cầu |
|---|---|
| Ngôn ngữ | JavaScript, Node.js ≥ 20 |
| Thư viện ngoài | **Không có**. Chỉ dùng thư viện chuẩn của Node, để AI nào cũng chạy được ngay, không cần `npm install` |
| Test | `node --test` (có sẵn trong Node 20) |
| Git | ≥ 2.38 |
| Hệ điều hành | Windows, macOS, Linux. Đường dẫn xử lý bằng `path`, không ghép chuỗi bằng `/` |
| Mã hoá file | UTF-8, xuống dòng `\n` |
| Giờ | ISO 8601 có múi giờ máy (ví dụ `2026-11-16T10:02:11+07:00`) |

### 2.1 Cấu trúc repo của chính hệ thống này

```
bin/ag.js                 # điểm vào CLI
bin/ag                    # launcher sh:  node "$(dirname "$0")/ag.js" "$@"
bin/ag.cmd                # launcher Windows
src/cli.js                # đọc tham số, tìm lệnh trong src/commands/ (tự động, không có danh sách cứng)
src/commands/<lệnh>.js    # mỗi lệnh một file
src/lib/                  # frontmatter, glob, lock, state, events, git, roles, identity
templates/                # nội dung mà `ag init` chép vào repo đích
  AGENTS.md  WORKFLOW.md  project.md  roles/  hooks/  pointers/
test/                     # *.test.js, mỗi test tự tạo repo git tạm
dac-ta/                   # đặc tả và việc (file này)
```

`src/cli.js` tự tìm lệnh theo tên file trong `src/commands/`. Nhờ vậy nhiều Coder thêm lệnh song song mà không cùng sửa một file.

### 2.2 Quy ước chung của mọi lệnh

- **Mã thoát:**

  | Mã | Nghĩa |
  |---|---|
  | `0` | thành công |
  | `1` | sai cú pháp hoặc thiếu tham số |
  | `2` | không có quyền (sai vai, agent chưa được duyệt) |
  | `3` | trạng thái không cho phép (ví dụ claim việc đang có người giữ) |
  | `4` | lỗi môi trường (không phải repo git, chưa `ag init`, git lỗi) |

- Mọi thông báo lỗi bằng tiếng Việt, nói rõ **vì sao** và **phải làm gì tiếp**.
- `--json`: in kết quả dạng JSON, dành cho máy (Monitor ở Giai đoạn 2).
- Lệnh có ghi trạng thái phải: lấy khoá → đọc → kiểm tra → ghi file → ghi `events.jsonl` → commit vào nhánh `agents-state` → nhả khoá. Lỗi ở bước nào thì không để lại thay đổi dở.

## 3. Dữ liệu

### 3.1 Vị trí

| Thứ | Ở đâu |
|---|---|
| Worktree chính | Worktree đầu tiên trong `git worktree list`, nhánh `main`. Master làm việc ở đây |
| Trạng thái | `<worktree chính>/.agents-state/`, là worktree của nhánh mồ côi `agents-state`. `ag` luôn tìm tới đây, dù được gọi từ worktree nào |
| Danh tính agent | `<worktree>/.agents-local/identity.json`, bị `.gitignore`. Ví dụ `{"id":"coder-03"}` |
| Worktree của Coder/Tester | `<thư mục cha>/<tên repo>-wt/<agent-id>/` |
| Cấu hình dự án | `.agents/project.md` trên `main` |

### 3.2 Định dạng frontmatter

Mọi file `.md` có trạng thái mở đầu bằng frontmatter giữa hai dòng `---`. Chỉ cho phép:
- `khoá: giá trị` (chuỗi, số, `true`/`false`, rỗng),
- `khoá: [a, b, c]` (danh sách một dòng).

Không lồng nhau, không viết nhiều dòng. Đọc rồi ghi lại phải ra đúng file cũ (giữ nguyên thứ tự khoá và phần thân).

### 3.3 Số hiệu

`T-NNN`, `D-NNN`, `B-NNN`: tăng dần từ `001`, cấp khi đang giữ khoá, không dùng lại số đã cấp.

### 3.4 Các loại file

**`assignments.md`**: frontmatter rỗng, phần thân là bảng `| id | role | approved_at |`. Chỉ `ag init` và `ag approve-agent` được ghi.

**`registry/<id>.md`**:
```
id, role, tool, status (pending | active | offline), worktree, checked_in_at, last_seen
```
Phần thân là danh sách quyền: được ghi đường dẫn nào, bị cấm đường dẫn nào. Lấy từ file vai trò và `project.md`.

**`board/T-NNN.md`**: theo mẫu ở mục 5.2 của noi-bo/THIET-KE.md, thêm khoá `handoff_at`.

**`decisions/D-NNN.md`**:
```
id, task, from, to (master | owner), status (open | answered | escalated | decided),
options, source, answered_by, answered_at
```
Phần thân có các mục: `## Câu hỏi`, `## Ngữ cảnh`, `## Master đề xuất` (nếu có), `## Trả lời`.

**`bugs/B-NNN.md`**:
```
id, task, severity (nghiem-trong | vua | nho), status (open | fixed | verified), reporter
```
Phần thân có các mục: `## Hiện tượng`, `## Cách tái hiện`, `## Bằng chứng`.

**`events.jsonl`**: mỗi dòng một JSON:
```
ts, agent, type, ref, msg   (bắt buộc)
options, urgent             (tuỳ chọn)
```

### 3.5 Khoá ghi

- File khoá: `.agents-state/.lock`, tạo bằng chế độ "chỉ tạo nếu chưa có". Nội dung: pid, agent, giờ tạo.
- Chờ tối đa 10 giây, sau đó báo lỗi mã 4.
- Khoá quá 60 giây được coi là bỏ quên và bị xoá, có ghi sự kiện `lock_stale`.

## 4. Vai trò, danh tính, quyền

### 4.1 Danh tính

- `ag checkin` ghi `identity.json` vào worktree hiện tại.
- Worktree chính luôn mang danh tính Master.
- Worktree của Coder/Tester do `ag claim` tạo, danh tính chép từ người claim.

### 4.2 Lệnh của chủ dự án

`ag decide`, `ag approve-agent`, `ag status … approved` cho việc ngoài đặc tả. Các lệnh này yêu cầu **xác nhận tương tác**: terminal phải là TTY, người dùng gõ lại số hiệu (ví dụ gõ `D-007`). Gọi từ shell không tương tác thì báo lỗi mã 2.

Lý do: công cụ AI chạy lệnh qua shell không tương tác, nên cách này chặn được việc AI vô tình chạy lệnh của chủ dự án. Không chặn được AI cố tình giả mạo (giới hạn đã nêu ở noi-bo/THIET-KE.md mục 5.5).

### 4.3 Ma trận đổi trạng thái việc

Thêm trạng thái mới **`verified`**: Tester đã kiểm tra đạt, chờ Master gộp nhánh. Bản thiết kế (noi-bo/THIET-KE.md) chỉ có `in_test → done`, nên không phân biệt được "Tester đạt" với "đã gộp".

| Từ → Đến | Ai | Điều kiện |
|---|---|---|
| (mới) → `draft` | Master | `ag task new` |
| `draft` → `approved` | Master, chủ dự án | Master: bắt buộc có `spec:` trỏ tới mục đặc tả **đã duyệt**. Việc không có nguồn thì chỉ chủ dự án duyệt |
| `approved` / `reopened` → `in_progress` | Coder | `ag claim`. Các việc trong `depends_on` phải `done`. Phạm vi `files` không trùng với việc khác đang `in_progress` |
| `in_progress` → `blocked` | Coder, Tester | `ag ask`. Phải có bàn giao mới hơn lúc claim |
| `blocked` → `approved` | tự động | Khi mọi `D-NNN` trong `blocked_by` đã `answered` hoặc `decided` |
| `in_progress` → `in_test` | Coder | `ag status T in_test`. `ag` tự chạy `test_cmd` (khai trong `project.md`) trong worktree. Test đỏ thì từ chối. Nhánh phải có ít nhất 1 commit, và worktree không còn thay đổi chưa commit |
| `in_test` → `verified` | Tester | `ag verify T`. Tester không phải người code việc này |
| `in_test` / `verified` → `reopened` | Tester, Master | Bắt buộc có `--bug B-NNN` |
| `verified` → `done` | Master | `ag merge T` |

Đổi trạng thái không có trong bảng thì báo lỗi mã 3. Đúng chuyển trạng thái nhưng sai vai thì báo lỗi mã 2.

**Hỏi xong có giữ việc không.** Khi `ag ask`, việc được nhả: xoá `claimed_by`, giữ nguyên nhánh và bàn giao. Có câu trả lời rồi thì Coder nào cũng nhận tiếp được, trên đúng nhánh cũ. Lý do: không để việc treo theo một agent có thể đã tắt.

### 4.4 Phạm vi ghi theo vai (hook kiểm tra)

| Vai | Được commit | Cấm |
|---|---|---|
| Master | Mọi file trên `main`, trừ mã nguồn | `source_dirs` trong `project.md` (Master không sửa code) |
| Coder | File khớp `files:` của việc đang giữ | Đặc tả, `acceptance_dirs`, `fixture_dirs`, `.agents/` |
| Tester | `acceptance_dirs` và file khớp `files:` của việc loại `test` | `source_dirs`, đặc tả |

`project.md` khai các khoá: `test_cmd`, `build_cmd`, `source_dirs`, `acceptance_dirs`, `fixture_dirs`, `spec_files`, `lease_minutes` (mặc định 30).

## 5. Các lệnh và tiêu chí chấp nhận

Mỗi tiêu chí (`A-…`) là một test tự động trong `test/`, chạy trên repo git tạm. Riêng `A-E2E` là kịch bản chạy tay.

### 5.1 `ag init [--master-id master]`

Chạy trong một repo git có ít nhất 1 commit. Lệnh làm các việc sau:
1. Chép `templates/` vào `.agents/` (gồm cả `bin/`, `src/`).
2. Tạo nhánh mồ côi `agents-state`, mở worktree `.agents-state/` với các thư mục rỗng.
3. Ghi Master vào `assignments.md`.
4. Thêm `.agents-state/`, `.agents-local/`, `.env` vào `.gitignore`.
5. Đặt `core.hooksPath=.agents/hooks`.
6. Sinh `AGENTS.md` và các file trỏ (`CLAUDE.md`, `GEMINI.md`, `.cursor/rules/agents.mdc`, `.github/copilot-instructions.md`).
7. Commit trên `main`.

- **A-INIT-1** Repo mới: sau `ag init`, đủ các file trên. `git config core.hooksPath` ra `.agents/hooks`. Nhánh `agents-state` tồn tại và có 1 commit.
- **A-INIT-2** Chạy lần hai: báo "đã khởi tạo", mã 3, không thay đổi gì.
- **A-INIT-3** Đã có sẵn `CLAUDE.md`: không ghi đè, in cảnh báo kèm dòng cần tự thêm.
- **A-INIT-4** Không phải repo git, hoặc repo chưa có commit: mã 4.

### 5.2 `ag checkin --id <id> --tool <tên>`, `ag whoami`, `ag heartbeat`

- **A-CHK-1** ID có trong `assignments.md`: tạo `registry/<id>.md` với `status: active`, ghi `identity.json`, in vai và danh sách quyền, sinh sự kiện `checkin`.
- **A-CHK-2** ID chưa được giao vai: `status: pending`, tự tạo `D-NNN` gửi chủ dự án ("Agent X dùng Y xin tham gia"), sinh sự kiện `checkin_pending`, mã 2. Mọi lệnh khác của agent `pending` đều trả mã 2.
- **A-CHK-3** Worktree chính chỉ check-in được với ID của Master. ID khác thì mã 2.
- **A-CHK-4** `ag whoami` in id, vai, tool, việc đang giữ. Chưa check-in thì mã 2.
- **A-CHK-5** `ag heartbeat` cập nhật `last_seen` và gia hạn `lease_until` của mọi việc mình đang giữ thêm `lease_minutes`.
- **A-CHK-6** ID không đúng mẫu `^[a-z]+-?[0-9a-z]*$`: mã 1.

### 5.3 `ag approve-agent <id> --role <vai>` (chủ dự án)

- **A-APR-1** Có TTY và gõ đúng ID: ghi `assignments.md`, chuyển registry từ `pending` sang `active`, đóng `D-NNN` xin tham gia, sinh sự kiện `agent_approved`.
- **A-APR-2** Không có TTY: mã 2, không thay đổi gì.
- **A-APR-3** `--role master` khi đã có Master: mã 3. Chỉ có 1 Master.

### 5.4 `ag task new|list|show`

`ag task new --title --type --files --spec [--depends]` (Master) tạo `T-NNN` ở trạng thái `draft`.

- **A-TSK-1** Coder hoặc Tester gọi `task new`: mã 2.
- **A-TSK-2** Thiếu `--files` với việc loại `feature`/`bug`: mã 1.
- **A-TSK-3** `task list [--status s]` in bảng: id, trạng thái, người giữ, hạn giữ. Việc quá hạn giữ được đánh dấu `QUÁ HẠN`.
- **A-TSK-4** `task show T-NNN` in toàn bộ file việc, kèm các `D-NNN` và `B-NNN` liên quan.
- **A-TSK-5** (chừa chỗ cho Giai đoạn 1b) `task new` nhận `--area`, `--feature` và các loại việc `review`, `integration`; ghi đúng vào frontmatter. Ở Giai đoạn 1 chưa có hành vi nào dựa trên các khoá này.

### 5.5 `ag status <T> <trạng thái>`

- **A-STS-1** Mọi ô trong ma trận mục 4.3: đúng vai thì đổi được, sai vai thì mã 2, chuyển trạng thái không có trong bảng thì mã 3. Test viết dạng bảng, phủ hết các ô.
- **A-STS-2** Chuyển sang `in_test` khi `test_cmd` đỏ: mã 3, in 20 dòng cuối của kết quả test.
- **A-STS-3** Chuyển sang `in_test` khi worktree còn thay đổi chưa commit: mã 3.
- **A-STS-4** Mỗi lần đổi thành công đều sinh sự kiện `task_status` và một commit trên `agents-state`.

### 5.6 `ag claim <T>`, `ag release <T>`

- **A-CLM-1** Việc `approved`: ghi `claimed_by` và `lease_until`, tạo nhánh `agent/<id>/<T>` (nếu chưa có), tạo hoặc cập nhật worktree `<repo>-wt/<id>/`, ghi `identity.json` vào đó, in đường dẫn worktree.
- **A-CLM-2** Việc đang có người giữ và còn hạn: mã 3, báo ai giữ, hạn đến lúc nào.
- **A-CLM-3** Việc có người giữ nhưng đã quá hạn: nhận được, sinh sự kiện `task_reclaimed`, in ghi chú bàn giao gần nhất.
- **A-CLM-4** `files` trùng (theo glob) với một việc khác đang `in_progress`: mã 3, báo trùng với việc nào.
- **A-CLM-5** Có `depends_on` chưa `done`: mã 3.
- **A-CLM-6** Việc `reopened` có sẵn nhánh: dùng lại nhánh cũ, không tạo nhánh mới.
- **A-CLM-7** Tester claim việc `in_test`: worktree của Tester checkout nhánh của Coder.
- **A-CLM-8** `release`: xoá `claimed_by`, giữ nhánh. Phải có bàn giao mới hơn lúc claim, nếu không thì mã 3.
- **A-CLM-9** Hai tiến trình claim cùng một việc cùng lúc: đúng 1 thành công (kiểm tra khoá).

### 5.7 `ag log "<nội dung>"`, `ag handoff <T> --done --left --next`, `ag inbox`

- **A-LOG-1** `log` ghi thêm một dòng có giờ vào `journal/<ngày>-<id>.md`, không sửa dòng cũ.
- **A-HND-1** `handoff` thiếu một trong 3 ý: mã 1. Đủ 3 ý: ghi vào mục "Ghi chú bàn giao" của việc (thêm vào, không ghi đè), cập nhật `handoff_at`, sinh sự kiện `handoff`.
- **A-INB-1** `inbox` in theo thứ tự:
  1. lỗi `open` gắn với việc của mình,
  2. câu hỏi của mình vừa có trả lời,
  3. việc mình đang giữ, kèm bàn giao gần nhất,
  4. việc `approved` hoặc `reopened` hợp vai, chưa ai giữ.

  Đây là lệnh agent chạy đầu tiên sau `checkin` để biết làm gì tiếp.
- **A-INB-2** Master: `inbox` in thêm câu hỏi `open` gửi Master, và việc `verified` chờ gộp.

### 5.8 Chuỗi hỏi: `ask`, `answer`, `escalate`, `decide`

- **A-ASK-1** Coder hoặc Tester: `ag ask "…" --task T --context "…"` tạo `D-NNN` gửi Master (`to: master`), chuyển việc sang `blocked`, thêm vào `blocked_by`, nhả việc (mục 4.3). Sinh sự kiện `question_asked`.
- **A-ASK-2** Master gọi `ask`: mã 2. Master không hỏi chính mình, mà dùng `escalate`.
- **A-ANS-1** Master: `ag answer D "…" --source <nguồn>`. Thiếu `--source`: mã 1. Nguồn phải là `D-NNN` đã `decided`, hoặc đường dẫn tới file/mục có thật. Sai nguồn: mã 3.
- **A-ANS-2** Trả lời xong: nếu mọi `blocked_by` của việc đã xong thì việc chuyển về `approved` (sự kiện `task_unblocked`).
- **A-ESC-1** Master: `ag escalate D --options "A,B" [--recommend A --why "…"]` chuyển `to: owner`, `status: escalated`, sinh sự kiện `decision_needed` với `urgent: true`.
- **A-DEC-1** Chủ dự án: `ag decide D "…"`, cần TTY. Ghi trả lời, `status: decided`, sinh sự kiện `decision_answered`. Mở khoá việc như A-ANS-2.
- **A-DEC-2** `decide` cho câu hỏi chưa được chuyển lên: mã 3.

### 5.9 `ag bug "<tiêu đề>" --task T --severity s --repro "…"`

- **A-BUG-1** Tester hoặc Master tạo `B-NNN` ở trạng thái `open`, sinh sự kiện `bug_opened` (`urgent` nếu `nghiem-trong`). Coder gọi lệnh này: mã 2.
- **A-BUG-2** `ag status T reopened --bug B-NNN` khi `B-NNN` không thuộc việc `T`: mã 3.

### 5.10 `ag verify <T>`, `ag merge <T>`

- **A-VER-1** Tester gọi `verify` cho việc `in_test` mình đang giữ, với `--evidence "<lệnh đã chạy và kết quả>"`: chuyển sang `verified`. Tester cũng là người đã code việc này (theo `git log` của nhánh): mã 2.
- **A-MRG-1** Master gọi `merge` cho việc `verified`:
  1. `git merge --no-ff --no-commit` nhánh việc vào `main`,
  2. chạy `test_cmd`,
  3. đạt thì commit (thông điệp có `Task: T-NNN`), chuyển `done`, sinh sự kiện `task_merged`.
- **A-MRG-2** Xung đột khi gộp, hoặc test đỏ sau khi gộp: `git merge --abort`, `main` giữ nguyên, việc chuyển `reopened`, tự tạo `B-NNN` mô tả lỗi, mã 3.
- **A-MRG-3** Gộp việc chưa `verified`: mã 3.

### 5.11 Git hook (`templates/hooks/`)

- **A-HK-1** `pre-commit` trên `main` từ worktree không phải Master: bị từ chối.
- **A-HK-2** Coder commit file ngoài `files:` của việc đang giữ: bị từ chối, in tên file vi phạm.
- **A-HK-3** Coder commit file trong `acceptance_dirs`, `fixture_dirs` hoặc đặc tả: bị từ chối, kể cả khi file đó khớp `files:`.
- **A-HK-4** Tester commit file trong `source_dirs`: bị từ chối.
- **A-HK-5** `commit-msg` tự thêm 2 dòng `Agent-Id: <id>` và `Task: <T>` nếu chưa có.
- **A-HK-6** Worktree không có `identity.json`: bị từ chối, nhắc chạy `ag checkin`.
- **A-HK-7** Hook chạy được trên Windows (Git Bash) và Linux. Hook là script sh gọi `node .agents/src/hooks/<tên>.js`.

### 5.12 Tài liệu cho agent (`templates/`)

- **A-DOC-1** `AGENTS.md` dưới 150 dòng, gồm:
  - 6 bước khởi động: đọc `WORKFLOW.md` → đọc file vai → `ag checkin` → `ag inbox` → `ag claim` → làm việc;
  - bảng lệnh `ag`;
  - nguyên tắc không tự quyết, kèm ranh giới đã chốt (noi-bo/THIET-KE.md mục 9, dòng 6);
  - điều cấm (`--no-verify`, sửa file trạng thái bằng tay, tự nhận vai).
- **A-DOC-2** `roles/master.md`, `coder.md`, `tester.md`: mỗi file có các mục **Phải làm**, **Không được**, **Khi chưa rõ**, **Khi dừng giữa chừng**.
- **A-DOC-3** Mọi lệnh nhắc trong tài liệu đều có thật. Có test tự quét tài liệu tìm `ag <lệnh>` rồi đối chiếu với `src/commands/`.

### 5.13a `ag push <nhánh> [--remote origin]` và hook `pre-push` (chủ dự án)

Thêm ngày 16/11/2026 theo yêu cầu chủ dự án: **không agent nào được tự push code, phải có chủ dự án xác nhận.**

- `ag push` chỉ chạy được trong terminal tương tác (TTY), người dùng phải gõ lại tên nhánh để xác nhận (như mục 4.2).
- Xác nhận xong, `ag` ghi một mã dùng một lần vào `.agents-local/push-token`, rồi chạy `git push`. Hook `pre-push` chỉ cho qua khi mã khớp, và xoá mã ngay sau khi kiểm.
- Ghi sự kiện `pushed` (nhánh, remote, commit đầu nhánh).

- **A-PUSH-1** Không có TTY: mã 2, không push.
- **A-PUSH-2** Có TTY nhưng gõ sai tên nhánh: mã 2, không push.
- **A-PUSH-3** Xác nhận đúng: push thành công (test dùng một repo bare làm remote), sinh sự kiện `pushed`, mã dùng một lần đã bị xoá.
- **A-HK-8** `git push` trực tiếp (không qua `ag push`): hook `pre-push` từ chối, in hướng dẫn "hỏi Master, chủ dự án chạy ag push".
- **A-HK-9** Dùng lại mã cũ cho lần push thứ hai: bị từ chối.

### 5.14 Áp dụng cho dự án có sẵn (thêm theo đề xuất bổ sung 01, mục A)

Khoá mới trong `project.md`:
- `main_branch`: mặc định `main`. Mọi lệnh và hook đọc khoá này, **không viết cứng `main`**.
- `previous_hooks_path`: thư mục hook cũ của dự án, nếu có.
- `known_failing`: danh sách test đỏ sẵn từ trước, chủ dự án đã duyệt. Chỉ để ghi lại; `test_cmd` phải tự loại các test này ra.

`ag init --existing` chạy được trên repo đã có code, có `AGENTS.md`, `CLAUDE.md` hay hook riêng. Lệnh in danh sách mọi thay đổi sẽ làm, rồi đòi gõ xác nhận (TTY).

- **A-INIT-5** Repo có nhánh chính là `master`: `ag init --existing --main-branch master` ghi `main_branch: master`. Hook chặn commit lên `master` (thay cho `main`) từ worktree không phải Master.
- **A-INIT-6** Đã có `AGENTS.md` hoặc `CLAUDE.md`: không ghi đè. Thêm mục "Workflow multi-agent" vào **cuối** file, có dấu mốc `<!-- ag:start -->` … `<!-- ag:end -->`. Chạy lại không thêm lần hai.
- **A-INIT-7** Đã có `core.hooksPath`: ghi giá trị cũ vào `previous_hooks_path`. Hook của `ag` kiểm tra xong thì gọi tiếp hook cùng tên ở thư mục cũ. Hook cũ thất bại thì commit cũng thất bại.
- **A-INIT-8** `test_cmd` đang đỏ lúc khởi tạo: `ag init` không dừng. Nó ghi kết quả vào mục "Hiện trạng" của `project.md`, ghi sự kiện `baseline_failing`, và in hướng dẫn: chủ dự án điền `known_failing` và sửa `test_cmd` để loại các test đó ra.
- **A-INIT-9** Không có TTY: in danh sách thay đổi, không làm gì, mã 2.

### 5.15 Chế độ gọn (thêm theo mục B)

Khoá mới trong `project.md`: `team_mode: team | solo`, mặc định `team`.

- **A-SOLO-1** `team_mode: solo`: Master được `ag verify` (kiêm Tester). Master vẫn bị chặn nếu Master có commit trên nhánh của việc đó.
- **A-SOLO-2** `team_mode: team`: Master gọi `ag verify` thì mã 2.
- **A-SOLO-3** Chủ dự án kiêm Master: `ag init --master-id owner --master-tool human` hợp lệ.

### 5.16 Cổng xác nhận và người tham gia (thêm theo mục C)

**Loại việc `gate`** có số hiệu `G-NNN`, tạo bằng `ag gate new --title "…" --depends <việc> [--evidence-from <việc>]` (Master).

Vòng đời: `waiting_deps → waiting_owner → passed`, hoặc `→ failed → waiting_deps`.

| Lệnh | Ai | Việc làm |
|---|---|---|
| `ag gate check` | mọi agent | Xem lại các cổng. Cổng có mọi `depends_on` đã `done` thì chuyển `waiting_owner`, sinh `gate_ready` (`urgent`). `ag inbox` tự gọi lệnh này |
| `ag gate pass G --note "…"` | chủ dự án, cần TTY | `passed`, sinh `gate_passed`. Các việc phụ thuộc `G` được mở |
| `ag gate fail G --bug "…"` | chủ dự án, cần TTY | `failed`, tạo `B-NNN`, sinh `gate_failed`. Nếu việc phụ thuộc ở cùng repo thì việc đó chuyển `reopened` |

**Người tham gia:** `ag checkin --tool human`.
- Không có hạn giữ việc: `lease_until` để trống, không cần `heartbeat`, không ai claim lại được việc người đang giữ.
- Vẫn phải ghi bàn giao và chịu hook như mọi agent.
- Danh tính người khai trong `assignments.md` với `tool: human`.

- **A-GATE-1** Cổng chưa đủ phụ thuộc: `gate pass` trả mã 3.
- **A-GATE-2** Việc phụ thuộc cổng: `ag claim` trả mã 3 khi cổng chưa `passed`.
- **A-GATE-3** `gate pass` hay `gate fail` không có TTY: mã 2.
- **A-GATE-4** `gate fail`: cổng quay về `waiting_deps`, có `B-NNN` gắn với cổng, việc phụ thuộc cùng repo chuyển `reopened`.
- **A-GATE-5** Cổng `waiting_owner` hiện trong `ag inbox` của chủ dự án, kèm bằng chứng lấy từ bàn giao cuối của việc trong `--evidence-from`.
- **A-HUM-1** Việc do người giữ không bao giờ bị coi là quá hạn.
- **A-HUM-2** Agent không phải người check-in với `--tool human`: mã 2. Chỉ ID khai `tool: human` trong `assignments.md` mới được dùng.

### 5.17 Liên kết hai repo, chỉ đọc (thêm theo mục C.1)

Khoá mới trong `project.md`: `links: [be=../be-repo]`.
- `depends_on` được phép có tiền tố repo, ví dụ `be:T-020`.
- Việc và cổng có thêm khoá `contract: be:contracts/orders.yaml@<commit>`, trỏ tới bản hợp đồng đã duyệt.

- **A-LNK-1** `ag` đọc `.agents-state/board/` của repo liên kết để biết trạng thái `be:T-020`. Test kiểm rằng `ag` **không ghi bất cứ thứ gì** vào repo liên kết (so sánh `git status` và `git log` của repo đó trước và sau).
- **A-LNK-2** Không tìm thấy repo liên kết, hoặc repo đó chưa `ag init`: `ag gate check` báo rõ tên liên kết và đường dẫn, mã 4. Các việc không dính tới liên kết vẫn chạy bình thường.
- **A-LNK-3** `be:T-020` `done` → cổng phụ thuộc chuyển `waiting_owner` khi chạy `ag gate check`.
- **A-LNK-4** File hợp đồng ở repo liên kết (trên `main_branch` của repo đó) có commit mới hơn bản đã ghi trong `contract:`: sinh `contract_changed` và tạo **một** `D-NNN` gửi chủ dự án (không tạo trùng khi chạy lại).
- **A-LNK-5** Tiền tố không có trong `links`: mã 1.

### 5.18 Kế hoạch các bước, tiếp quản, chuyển việc (thêm theo mục F)

| Lệnh | Ai | Việc làm |
|---|---|---|
| `ag plan T "bước 1" "bước 2" …` | người đang giữ việc | Ghi mục `## Kế hoạch` vào file việc, mỗi bước là một dòng `- [ ]` có số thứ tự |
| `ag step T <số> [--note "…"]` | người đang giữ việc | Đánh dấu `- [x]`, tự ghi một bàn giao ngắn ("Xong bước N: …, bước tiếp theo: N+1 …"), gia hạn việc |
| `ag reassign T --to <ID>` | chủ dự án, cần TTY | Chuyển việc ngay cho agent khác, không chờ quá hạn |

- **A-PLN-1** `plan` khi việc đã có kế hoạch: thêm `--replace` mới cho ghi đè, và kế hoạch cũ được giữ trong bàn giao.
- **A-PLN-2** `step` với số bước không có: mã 1. `step` khi không giữ việc: mã 2.
- **A-PLN-3** `ag inbox` và `ag task show` hiện bước kế tiếp chưa xong.
- **A-CLM-10** Claim lại việc quá hạn, hoặc việc vừa `reassign`, mà worktree của agent cũ còn thay đổi chưa commit: `ag` commit phần đó lên nhánh việc với thông điệp `WIP: tự lưu khi tiếp quản từ <ID cũ>` (có `Agent-Id` của agent cũ), sinh sự kiện `wip_saved`, rồi mới giao. Không mất dòng thay đổi nào.
- **A-RSN-1** `reassign` không có TTY: mã 2.
- **A-RSN-2** `reassign` thành công: `claimed_by` đổi sang ID mới, có hạn giữ mới, sinh sự kiện `task_reassigned`, rồi chạy bước tự lưu như A-CLM-10.

### 5.19 Bộ skill (thêm theo mục E)

`templates/skills/<chung|master|coder|tester>/<tên>.md`, đủ 24 skill theo danh sách ở đề xuất bổ sung 01, mục E.

- **A-SKL-1** Mỗi file skill có đủ 4 mục: **Khi nào dùng**, **Các bước**, **Đầu ra**, **Kiểm tra cuối**.
- **A-SKL-2** Mỗi `roles/<vai>.md` có mục **Skill** liệt kê đường dẫn các skill của vai đó và các skill chung. Mọi đường dẫn đều trỏ tới file có thật (kiểm bằng test).
- **A-SKL-3** A-DOC-3 quét cả `templates/skills/`: mọi lệnh `ag` nhắc tới đều có thật.

### 5.13 Kiểm chứng đầu-cuối (chạy tay, Tester và chủ dự án)

**A-E2E** Trên một repo mẫu nhỏ (ví dụ thư viện cộng trừ có `npm test`):
1. Chủ dự án chạy `ag init`, duyệt `coder-01` (công cụ A) và `coder-02` (công cụ B, khác công cụ A), duyệt `tester-01`.
2. Master tạo 2 việc có phạm vi file khác nhau. Hai Coder làm **song song**.
3. Một Coder phải hỏi ít nhất 1 câu mà Master không có nguồn, nên câu đó lên tới chủ dự án.
4. Tắt một Coder giữa chừng. Coder kia nhận lại việc sau khi quá hạn và làm xong nhờ bàn giao.
5. Tester đánh trượt 1 lần (có `B-NNN`), Coder sửa, Tester đạt, Master gộp.
6. Chủ dự án tắt một Coder giữa chừng, rồi mở phiên mới cùng ID trong đúng worktree cũ: phiên mới làm tiếp từ bước chưa xong của `ag plan`.
7. **Hai repo:** một repo "be" có việc API, một repo "fe" có cổng `G-001` phụ thuộc `be:T-…`. BE xong thì cổng chuyển `waiting_owner`; chủ dự án `gate pass`; việc FE mở ra.
8. **Đạt khi:** cả 2 việc `done`; `main` chạy test xanh; `git log agents-state` kể lại đủ câu chuyện mà không cần hỏi ai; không có commit nào vi phạm hook.

## 6. Thứ tự và song song

```
T-001 ──▶ T-002 ──┬─▶ T-003 (init)
                  ├─▶ T-005 (checkin)  ──▶ T-006 (task/status) ─┬─▶ T-007 (claim)
                  │                                             ├─▶ T-008 (log/handoff/inbox)
                  │                                             ├─▶ T-009 (hỏi đáp)
                  │                                             ├─▶ T-010 (bug)
                  │                                             └─▶ T-011 (verify/merge)
                  └─▶ T-012 (hook, cần T-005 để có danh tính)
T-004 (tài liệu agent) chạy song song từ đầu
T-014 (ag push + pre-push, cần T-005 và T-012)
T-015 (Master: bộ skill) chạy song song từ đầu
T-006 ──▶ T-016 (plan/step)
T-007 ──▶ T-017 (tự lưu khi tiếp quản, reassign)
T-005, T-006 ──▶ T-018 (gate, người tham gia) ──▶ T-019 (liên kết hai repo, cần thêm T-017, T-008)
T-013 (Tester: kiểm chứng đầu-cuối) sau khi mọi việc khác done
```

Sau T-006, các việc T-007…T-011 sửa các file riêng trong `src/commands/`, nên chạy song song được.

## 7. Định nghĩa "xong" chung cho mọi việc

- Có test tự động cho từng tiêu chí `A-…` của việc, và `node --test` xanh.
- Chạy được trên Windows. Nếu có thể, kiểm tra thêm trên Linux, ví dụ WSL hoặc CI.
- Không thêm thư viện ngoài.
- Thông báo lỗi bằng tiếng Việt, có hướng dẫn bước tiếp theo.
- Không viết cứng tên nhánh `main`: đọc `main_branch` từ `project.md` (mục 5.14).

## 8. Cách chạy chính Giai đoạn 1 khi chưa có `ag`

Lệnh `ag` chưa tồn tại, nên các việc tạm đặt ở `dac-ta/viec-gd1/` và đổi trạng thái bằng tay theo đúng mẫu.
- **Mốc chuyển sang `ag` đặt sau Đợt 5**, khi T-001 … T-012 đều `done` (thứ tự đợt: `dac-ta/giao-viec.md`). Lúc đó `ag` đã có đủ lõi: `init`, `checkin`, duyệt agent, `task`, `status`, `claim`, `handoff`, `inbox`, hỏi đáp, `bug`, `verify`, `merge`, hook.
- Chủ dự án chạy `ag init --existing` trên chính repo này. Master **chuyển dữ liệu một lần**: chép việc, câu hỏi, lỗi từ `dac-ta/` vào `.agents-state/` và commit trên nhánh `agents-state`. Đây là **ngoại lệ duy nhất** của luật "chỉ đổi trạng thái qua `ag`".
- Từ đó trở đi, mọi việc chạy bằng `ag`. Hệ thống tự xây phần còn lại bằng chính nó. Các bước chi tiết: `noi-bo/HUONG-DAN-THUC-HIEN.md` mục 4.

## 9. Các điểm đã duyệt (16/11/2026)

| # | Điểm | Đã duyệt |
|---|---|---|
| 1 | Ngôn ngữ và thư viện | Node ≥ 20, **không dùng thư viện ngoài** |
| 2 | Bảo vệ lệnh của chủ dự án (`decide`, `approve-agent`) | Bắt buộc gõ xác nhận trong terminal tương tác (TTY). AI chạy lệnh không tương tác nên bị chặn (mục 4.2) |
| 3 | Thêm trạng thái `verified` | Có (mục 4.3) |
| 4 | Agent hỏi xong có giữ việc không | Nhả việc, giữ nhánh và bàn giao. Ai cũng nhận tiếp được (mục 4.3) |
| 5 | Thời hạn giữ việc mặc định | 30 phút, chỉnh được trong `project.md` |
| 6 | Master duyệt `draft → approved` | Được, nếu việc trỏ tới mục đặc tả đã được chủ dự án duyệt. Việc ngoài đặc tả thì chỉ chủ dự án duyệt |
| 7 | Ai làm Coder/Tester cho Giai đoạn 1 | Chủ dự án chọn công cụ và mở phiên. Kịch bản A-E2E cần ít nhất 2 công cụ AI khác nhau |
| 8 | Toàn bộ đặc tả này | Duyệt |

## 10. Lịch sử thay đổi

| Ngày | Thay đổi | Ai duyệt |
|---|---|---|
| 16/11/2026 | Bản đầu tiên, duyệt toàn bộ | Chủ dự án |
| 16/11/2026 | Mục 8: mốc chuyển sang `ag` dời ra sau Đợt 5 (thay vì sau T-003 và T-006); cho phép chuyển dữ liệu một lần ở mốc chuyển. Thứ tự đợt mới, T-022 sang Đợt 8. T-001 thêm `.gitattributes` | Chủ dự án |
| 16/11/2026 | Thêm A-TSK-5 (chừa chỗ cho Giai đoạn 1b: `area`, `feature`, loại việc `review` và `integration`). Giai đoạn 1b đặc tả riêng ở `dac-ta/giai-doan-1b.md` | Chủ dự án (duyệt đề xuất 02) |
| 16/11/2026 | Thêm mục 5.14–5.19 theo đề xuất bổ sung 01: dự án có sẵn, chế độ gọn, cổng xác nhận và người tham gia, liên kết hai repo (cùng máy), kế hoạch các bước và tiếp quản, bộ skill. Thêm việc T-015…T-019, mở rộng T-003, T-011, T-013 | Chủ dự án |
| 16/11/2026 | Thêm mục 5.13a: cấm agent tự push, chỉ chủ dự án push qua `ag push`. Thêm việc T-014 | Chủ dự án (yêu cầu trực tiếp) |
