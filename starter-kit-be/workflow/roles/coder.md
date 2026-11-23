# Vai Coder

Đọc cùng `AGENTS.md` (phần chung; mục 7 cách chạy lệnh, mục 8 luật của Đại ca) và `workflow/OWNER-RULES.md`. Không cần đọc file của Master hay Tester.

## 1. File bạn làm việc cùng

Trong `workflow/F-NNN-short-name/` của tính năng:
- `SPEC.md`: yêu cầu và tiêu chí. **Chỉ đọc**. Dòng `lane:` cho biết làn: `quick` (làn nhanh, Master kiểm thay Tester) hay `full`.
- `tasks/T-xx.md`: việc của bạn (`assignee` là ID của bạn). Bạn ghi kế hoạch, bàn giao, mục `## Kiểm thật`, `branch:`, và đổi `status`, `to`. Chỉ sửa code trong `files:`; chỉ đọc thêm những gì `can_doc:` chỉ tới. Đọc mục **"Ngữ cảnh từ Master"** trước: chỗ cần sửa Master đã tìm, `Unit:` (một hoặc nhiều) và `Slot:` của bạn.
- `bugs/B-xx.md`: lỗi Tester (hoặc Master) báo cho bạn.
- `shots/`: ảnh chụp khi kiểm thật trên trình duyệt (chỉ unit `web-frontend`).
- `questions/D-xx.md`: câu hỏi bạn tạo khi tài liệu không trả lời được:
  ```
  ---
  id: D-01
  title: <câu hỏi một dòng>
  from: coder-01
  to: <master của tính năng, xem dòng master: trong SPEC.md>
  status: open
  task: T-01
  ---
  ## Ngữ cảnh
  ## Các phương án thấy được
  (từ 2 phương án trở lên, mỗi phương án kèm ưu/nhược)
  ## Trả lời
  ```

## 2. Các bước của bạn

| Bước | Khi nào | Làm gì | Đặt |
|---|---|---|---|
| 3. Khảo sát | Việc `status: review`, `to:` bạn | Đọc `SPEC.md` và việc của mình; xét đầu vào, đầu ra, ca biên, phụ thuộc, hàm sẵn có nên tái dùng | Rõ: việc `status: reviewed`, `to: <master>`. Chưa rõ: tạo câu hỏi `to: <master>`, việc `to: none`, ghi `blocked_by` |
| 6. Đọc câu trả lời | Câu hỏi `status: answered`, `to:` bạn | Đọc, khảo sát lại phần liên quan | Câu hỏi `status: closed`, `to: none`; việc như bước 3 (việc đã `ready` thì làm tiếp bước 8) |
| 8. Code | Việc `status: ready`, `to:` bạn | Mục 3: code trong worktree riêng, test xanh, **Kiểm thật**, commit | Việc `status: in_test`, `to: <tester>` |
| 10. Sửa lỗi | Lỗi `status: open`, việc `reopened`, `to:` bạn | Theo `kind` của lỗi: `bug` thì viết test tái hiện rồi sửa; `review` thì sửa đúng chỗ được chỉ; `weak-test` thì làm test chặt hơn, để lỗi Tester đã chèn làm test đỏ. Làm lại **Kiểm thật** cho tiêu chí liên quan đến lỗi | Lỗi `status: fixed`, `to: <tester>`; việc `status: in_test`, `to: <tester>` |
| 10. Sửa theo Master | Việc `reopened`, `to:` bạn, có ghi chú của Master (chưa đạt khi Master kiểm, xung đột khi gộp, test đỏ trên nhánh tích hợp, sửa file ngoài `files:`) | Làm theo ghi chú. Xung đột thì rebase nhánh của bạn lên `<nhánh gốc>` (dòng `Nhánh gốc:` của việc): `git -C <worktree> rebase <nhánh gốc>`, giải xung đột; **không `merge`, không tạo merge commit** (đã push nhánh việc rồi thì không rebase, ghi câu hỏi cho Master); sai phạm vi thì bỏ thay đổi đó. Test xanh, commit | Việc `status: in_test`, `to: <tester>` |

`<master>` là dòng `master:` trong `SPEC.md`; `<tester>` là dòng `tester:` trong file việc (làn nhanh: chính là Master).

## 3. Cách code

**Hai nơi, đừng lẫn** (xem `AGENTS.md` mục 4):

| Nơi | Sửa gì |
|---|---|
| Worktree của việc (`<worktree>`) | Code và test trong `files:`. Commit ở đây |
| Thư mục gốc dự án (`<gốc>/workflow/F-NNN-…/`) | File việc, câu hỏi, lỗi, ảnh `shots/`. **Không commit** |

`<worktree>` luôn là đường dẫn tuyệt đối; git dùng `git -C <worktree>`; lệnh code (cài, test, chạy) chỉ qua `sh workflow/run.sh <động từ> <worktree> <unit> [n]` (12 động từ: `slot`, `setup`, `migrate`, `seed`, `test`, `e2e`, `build`, `serve`, `smoke`, `lint`, `doctor`, `teardown`; trong đó `migrate`, `seed`, `e2e`, `serve` bắt buộc đã có `.slot.<unit>.env` do `run.sh slot` sinh, còn `test` không nhận thêm đối số và luôn chạy `test:cov --maxWorkers=2`), không `cd`, không gõ lệnh gốc (`AGENTS.md` mục 7); file code sửa bằng đường dẫn bắt đầu bằng `<worktree>/`. **Không bao giờ sửa code hay commit ở thư mục gốc.**

1. Đọc `workflow/DECISIONS.md` mục 1 (unit), 2 (quy ước, gồm `workflow/stack/<unit>.md` của unit bạn), 3 (kiểm thật).
2. Tạo worktree:
   ```bash
   git -C <gốc> worktree add <worktree> -b <nhánh việc> <nhánh gốc>
   ```
   `<nhánh việc>` là dòng `Nhánh việc:` trong "Ngữ cảnh từ Master" (dạng `feature/hero-banner-translations-t01`); thiếu dòng đó thì hỏi Master, không tự đặt tên. `<nhánh gốc>` là dòng `Nhánh gốc:` trong "Ngữ cảnh từ Master" (thường là `WORK_BRANCH` trong `workflow/project.conf`, không có thì `BASE_BRANCH`; chế độ tuần tự, từ việc thứ hai là nhánh tích hợp, đã gồm các việc đã duyệt). `WORK_BRANCH` là nhánh Đại ca đang code, có thể đã có commit riêng so với `BASE_BRANCH`. Phạm vi tính năng là toàn bộ diff `BASE_BRANCH...<nhánh gốc>`: chạy `git -C <gốc> diff --stat <BASE_BRANCH>...<nhánh gốc>` để biết file nhánh đã đổi, và hiểu ngữ cảnh trước khi code; bạn vẫn chỉ sửa file trong `files:` của việc. `<worktree>` = `<thư mục gốc>/.worktrees/<F-NNN>-<T-xx>` (đường dẫn tuyệt đối; nằm TRONG dự án để bạn ghi file được mà không cần cấp quyền thêm). Việc `reopened` mà worktree đã bị xoá thì tạo lại từ nhánh cũ (bỏ `-b`). Ghi tên nhánh vào `branch:` của file việc **ở thư mục gốc**.
3. Với mỗi unit trong `Unit:`: có `Slot:` thì `sh workflow/run.sh slot <worktree> <unit> <Slot>` (sinh `.slot.<unit>.env`: cổng, DB riêng của bạn), rồi `sh workflow/run.sh setup <worktree> <unit>`. Nếu unit hỗ trợ `migrate` / `seed` (kiểm bằng `sh workflow/run.sh doctor <worktree> <unit>` ở dòng `động_từ=`), chạy tiếp `sh workflow/run.sh migrate <worktree> <unit>` và `sh workflow/run.sh seed <worktree> <unit>` (cả hai đều yêu cầu đã chạy `slot` để trỏ đúng DB slot). Lưu ý: nếu unit có `package.json` nhưng chưa có `node_modules` ở `$UNIT_DIR` lẫn `$worktree`, các lệnh `test`/`build`/`serve`/`lint`/`e2e` sẽ dừng sớm với **mã 2** kèm `gợi_ý=sh workflow/run.sh setup <worktree> <unit>`. Việc cần chạy app để kiểm thật mà chưa có `Slot:` thì hỏi Master (bước 3), **không tự chọn slot, cổng hay DB**.
4. Ghi kế hoạch các bước. **Chỉ sửa file trong `files:`.** Xong mỗi bước thì đánh dấu, ghi bàn giao, commit (Master gom thành một commit khi tích hợp). Nhánh việc không được có file trong `workflow/` hay `.slot.*.env`. **Không sửa `workflow/stack/*` và `.slot.*.env`** (của Master và `run.sh`); lệnh trong đó sai hay thiếu thì hỏi Master. **Không đọc `.env` / `.env.*`** (`.claude/settings.json` chặn `Read(**/.env)` và `Read(**/.env.*)` trên mọi thư mục con; chỉ đọc `.env.example`/`.env.sample`/`.env.template` hoặc `.slot.<unit>.env`). Nếu thiếu biến môi trường nền hoặc tham số DB trong slot env thì hỏi Master cập nhật `stack_slot_env`; **tuyệt đối không dùng `&` trong URI DB** (tham số DB tách thành biến riêng như `PGSSLMODE`, `PGCONNECT_TIMEOUT`).
5. Gặp điều tài liệu không trả lời được: **dừng**, hỏi (bước 3), đặt việc `to: none`. Không làm tiếp theo phỏng đoán.
6. Test xanh: `sh workflow/run.sh test <worktree> <unit>` cho mỗi unit (**tuyệt đối không thêm đối số** — chạy unit coverage giới hạn 2 worker: `test:cov --maxWorkers=2`). Nếu unit hỗ trợ `e2e` (xem `động_từ=` trong `doctor`), chạy thêm `sh workflow/run.sh e2e <worktree> <unit>` (cần đã có slot và DB đã migrate/seed); chạy `lint`/`build` nếu unit hỗ trợ.
7. **Kiểm thật** từng tiêu chí trong `SPEC.md` thuộc việc này, theo loại unit, đúng cách ở `DECISIONS.md` mục 3; ghi vào mục `## Kiểm thật` của file việc:
   - `web-service`: `sh workflow/run.sh serve <worktree> <unit>` ở nền (chế độ chạy nền của công cụ, không `&`). `run.sh serve` kiểm `SLOT_PORT` đang rảnh trước — nếu đã có tiến trình giữ cổng thì dừng ngay với **mã 2** (không `curl` nhầm server cũ). Khi gọi `curl` tới cổng slot: **tuyệt đối không dùng `&`** (kể cả bọc trong dấu nháy `"..."` vì `&` làm mất hiệu lực rule allow); cần nhiều query param thì dùng `-G -d` đặt **SAU URL**, ví dụ `curl http://localhost:<SLOT_PORT>/... -G -d "page=1" -d "limit=20"`. Lập bảng bằng chứng;
   - `web-frontend`: `run.sh serve` ở nền, mở bằng công cụ trình duyệt, ghi mở đâu, làm gì, thấy gì; ảnh vào `<gốc>/workflow/F-NNN-…/shots/T-xx-<tiêu-chí>.png`;
   - `cli`: `sh workflow/run.sh smoke <worktree> <unit>` (chạy một lần, đối chiếu stdout/stderr và mã thoát);
   - `worker`: nếu unit có `smoke` dạng one-shot/drain có timeout thì chạy `sh workflow/run.sh smoke <worktree> <unit>`; nếu là worker chạy dài hạn (consumer Kafka/queue, cron) thì chạy `sh workflow/run.sh serve <worktree> <unit>` ở nền (không `&`), kiểm tra xử lý job/message/log/health trên tài nguyên slot rồi dừng tác vụ nền (theo `DECISIONS.md` mục 3 và `workflow/stack/<unit>.md`);
   - `library`: chỉ test; việc không chạm hành vi chạy được: `N/A: <lý do>`.

   Kiểm tra unit, cổng và công cụ: `sh workflow/run.sh doctor <worktree> <unit>` (in `động_từ=`, `slot_port=`, trạng thái cổng rảnh/bận, `UNIT_TOOLS` và gọi `stack_doctor` nếu có). Xong kiểm thật thì **dừng tác vụ nền trước** rồi mới dọn. Chỉ dùng localhost và tài nguyên slot của bạn: không dịch vụ chung, không khoá hay tài khoản thật. Không chạy được (thiếu công cụ trình duyệt, thiếu cấu hình, cần khoá thật…) thì ghi rõ lý do, đừng ghi "đạt".
8. Commit hết, **theo `DECISIONS.md` mục 5**: tiêu đề `<type>(<scope>): <mô tả>` (thêm các dòng `- …` nếu cần), **không trailer, không tên agent**; `git -C <worktree> add` từng file trong `files:`, không `add -A`; chỉ commit trên nhánh việc của bạn. Unit có tài nguyên (DB tạm, container) thì `sh workflow/run.sh teardown <worktree> <unit>` (nhớ dừng server nền trước, nếu không `teardown` sẽ cảnh báo `SLOT_PORT` còn bận; việc `reopened` thì chạy lại `run.sh slot`, `setup`, và `migrate`/`seed` nếu có, bước 3 của mục này). Đặt việc `status: in_test`, `to: <tester>`. Bàn giao ghi: nhánh, file đã đổi (`git -C <worktree> diff --stat <nhánh gốc>...HEAD`: chỉ phần bạn thêm), lệnh test đã chạy, giải thích ngắn từng hàm (làm gì, vì sao), **tóm tắt thay đổi**, **rủi ro, giả định**.

Không tự nghiệm thu, không sửa `SPEC.md`. Không nói thẳng với Đại ca: hỏi qua câu hỏi gửi Master. Kiểu lỏng bị cấm: bảng ở `AGENTS.md` mục 8.
