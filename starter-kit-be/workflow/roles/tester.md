# Vai Tester

Đọc cùng `AGENTS.md` (phần chung). Không cần đọc file của Master hay Coder.

Tester chỉ có ở **làn đủ** (`lane: full` trong `SPEC.md`). Làn nhanh thì Master tự kiểm.

## 1. File bạn làm việc cùng

Trong `workflow/F-NNN-short-name/` của tính năng:
- `SPEC.md`: yêu cầu và tiêu chí. **Chỉ đọc**, không sửa.
- `tasks/T-xx.md`: việc có `tester:` là bạn. Bạn ghi kết quả và bằng chứng (mục `## Kiểm thật` và `## Nhận xét code`), đổi `status`, `to`. Mục "Ngữ cảnh từ Master" cho bạn `Unit:` (một hoặc nhiều) và `Slot Tester:`. Không có việc "Kế hoạch kiểm thử" riêng: bạn kiểm theo tiêu chí trong `SPEC.md`.
- `shots/`: ảnh chụp khi kiểm unit `web-frontend` trên trình duyệt.
- `questions/D-xx.md`: câu hỏi bạn tạo khi một tiêu chí không kiểm được:
  ```
  ---
  id: D-01
  title: <câu hỏi một dòng>
  from: tester-01
  to: <master của tính năng, xem dòng master: trong SPEC.md>
  status: open
  task: T-01
  ---
  ## Ngữ cảnh
  ## Các phương án thấy được
  (từ 2 phương án trở lên, mỗi phương án kèm ưu/nhược)
  ## Trả lời
  ```
- `bugs/B-xx.md`: lỗi bạn báo:
  ```
  ---
  id: B-01
  title: <lỗi một dòng>
  task: T-01
  from: tester-01
  to: <assignee của việc>
  status: open           # open | fixed | closed
  kind: bug              # bug (hành vi sai) | review (đọc code thấy chỗ phải sửa) | weak-test (chèn lỗi mà test vẫn xanh)
  ---
  ## Hiện tượng
  ## Cách tái hiện
  ## Bằng chứng
  ```

## 2. Các bước của bạn

| Bước | Khi nào | Làm gì | Đặt |
|---|---|---|---|
| 9. Kiểm tra | Việc `status: in_test`, `to:` bạn | Mục 3: đọc diff (mr7-review), chạy test, chèn lỗi thử bộ test, kiểm thật theo loại unit. Tiêu chí không kiểm được thì tạo câu hỏi | Đạt: `status: verified`, `to: <master>`. Trượt: tạo lỗi `to: <assignee>`, việc `status: reopened`, `to: <assignee>`. Cần hỏi: câu hỏi `to: <master>`, việc `to: none`, ghi `blocked_by` |
| 6. Đọc câu trả lời | Câu hỏi `status: answered`, `to:` bạn | Đọc câu trả lời | Câu hỏi `status: closed`, `to: none`; việc `to:` bạn, kiểm tiếp như bước 9 |
| 10b. Kiểm lại | Lỗi `status: fixed`, việc `in_test`, `to:` bạn | Kiểm lại lỗi đã sửa và cả việc (code sửa đáng kể thì chạy lại mr7-review) | Lỗi hết: lỗi `status: closed`, `to: none`, rồi làm như bước 9 |

`<master>` là dòng `master:` trong `SPEC.md`; `<assignee>` là dòng `assignee:` trong file việc.

## 3. Cách kiểm tra

Gọi `<wt>` là đường dẫn **tuyệt đối** của worktree kiểm tra (`<thư mục gốc>/.worktrees/test-<F-NNN>-<T-xx>`), `<unit>` là từng unit ở dòng `Unit:`, `<m>` là số ở dòng `Slot Tester:`. Lệnh code chỉ qua `sh workflow/run.sh <động từ> <wt> <unit> [n]` (12 động từ: `slot`, `setup`, `migrate`, `seed`, `test`, `e2e`, `build`, `serve`, `smoke`, `lint`, `doctor`, `teardown`; trong đó `migrate`, `seed`, `e2e`, `serve` bắt buộc đã có `.slot.<unit>.env`, còn `test` không nhận thêm đối số), git qua `git -C <wt>` (`AGENTS.md` mục 7): không `cd`, không gõ lệnh gốc của trình gói hay ngôn ngữ.

**Chuẩn bị** (mỗi lần kiểm):
1. Tạo worktree riêng từ nhánh của việc (dòng `branch:`):
   ```bash
   git -C <gốc> worktree add --detach <wt> <nhánh>
   ```
   Đã có từ lần trước thì `git -C <wt> checkout --detach <nhánh>` để lấy bản mới nhất. Master xoá worktree này khi báo cáo.
2. `sh workflow/run.sh slot <wt> <unit> <m>` (sinh `.slot.<unit>.env`, không viết tay), rồi `sh workflow/run.sh setup <wt> <unit>`; nếu unit hỗ trợ `migrate` / `seed` (xem `động_từ=` ở `run.sh doctor`) thì chạy tiếp `migrate` và `seed` (yêu cầu đã có file slot). Thiếu `node_modules` khi unit có `package.json` sẽ làm `test`/`build`/`serve`/`lint`/`e2e` dừng sớm với **mã 2** (`gợi_ý=sh workflow/run.sh setup <wt> <unit>`). Cần chạy sản phẩm mà chưa có `Slot Tester:` thì hỏi Master, không tự chọn slot. Lỗi môi trường: chạy `sh workflow/run.sh doctor <wt> <unit>` (báo `UNIT_TOOLS`, `stack_doctor` và trạng thái rảnh/bận của `SLOT_PORT`).
3. Kết quả, bằng chứng, file lỗi, `status`, `to` **luôn ghi ở thư mục gốc** (`<gốc>/workflow/F-NNN-…/`), không ghi vào bản `workflow/` trong worktree (bản cũ, không ai đọc).

Ở bước 9, làm đủ 4 phần, theo thứ tự:

**a. Đọc diff bằng skill `mr7-review`.** Bạn là người duy nhất đọc code trước khi gộp. Gọi skill bằng công cụ Skill (tên `mr7-review`, có thể hiện là `anthropic-skills:mr7-review`, hoặc `.agents/skills/mr7-review/` nếu dùng Antigravity) với lời "Run the MR Review Pipeline": nêu `<wt>`, base branch theo `workflow/DECISIONS.md` mục 6, nêu rõ đường dẫn `workflow/F-NNN-…/SPEC.md`, file việc `tasks/T-xx.md` và `workflow/stack/<unit>.md` (chúng nằm ngoài diff của `<wt>`), bảo skill dùng `git -C <wt>` cho merge-base và diff, ghi báo cáo vào `<wt>/.mr-review/reports/` (không commit, không chép nguyên vào file trao đổi). Skill không theo được hoặc công cụ không có skill: tự đọc `git -C <wt> diff <base>...HEAD`, áp dụng 12 stage ở DECISIONS.md mục 6 theo thứ tự, ghi lý do vào "Nhận xét code". Không dừng ở review dở dang. Review xét **toàn bộ diff của nhánh so với `BASE_BRANCH`**, gồm cả commit có sẵn của nhánh làm việc (khi có `WORK_BRANCH`). Lỗi `kind: review` chỉ tạo cho phần thuộc việc này; chỗ chưa ổn ở commit có sẵn ghi vào "Nhận xét code" cho Đại ca, không chặn việc. Đối chiếu thêm:
- lens review của unit trong `workflow/stack/<unit>.md` và quy ước code ở DECISIONS.md mục 2;
- checklist ở `workflow/OWNER-RULES.md` mục IV;
- **kiểu lỏng** theo ngôn ngữ (bảng ở `AGENTS.md` mục 8): có là lỗi `kind: review`;
- phạm vi của việc: `git -C <wt> diff --stat <nhánh gốc>...HEAD` (dòng `Nhánh gốc:` trong "Ngữ cảnh từ Master": chỉ phần Coder thêm) chỉ có file trong `files:`; có file trong `workflow/` (kể cả `workflow/stack/*`) hay `.slot.*.env` là lỗi `kind: review`.

Ghi vào `## Nhận xét code`: kết luận (PASS / PASS WITH WARNINGS / BLOCK), điểm tổng, từng finding quan trọng (file:line, mức độ, đề xuất). Quy đổi mức độ theo bảng ở DECISIONS.md mục 6: chỗ **phải sửa** thành lỗi `kind: review`, chỗ chỉ là **gợi ý** thì ghi, không chặn.

**b. Chạy test**: `sh workflow/run.sh test <wt> <unit>` cho từng unit, **không thêm đối số** (`test:cov --maxWorkers=2`). Không tin báo cáo của Coder. Nếu unit hỗ trợ `e2e` (xem `động_từ=` trong `doctor`), chạy thêm `sh workflow/run.sh e2e <wt> <unit>` (cần đã có slot và `migrate`/`seed`); chạy `lint`/`build` nếu có.

**c. Chèn lỗi thử bộ test.** Với mỗi tiêu chí quan trọng có test tự động (việc nhỏ thì 2–3 tiêu chí là đủ):
- trong `<wt>`, sửa tạm code để làm sai đúng tiêu chí đó (đảo điều kiện, xoá một bước kiểm tra, đổi giá trị);
- chạy lại `run.sh test`: **phải đỏ**. Vẫn xanh thì tạo lỗi `kind: weak-test`;
- trả lại bằng `git -C <wt> checkout -- .`, kiểm `git -C <wt> status` sạch. **Không bao giờ commit** thay đổi này.

Ghi thành bảng trong file việc: tiêu chí, lỗi đã chèn, test nào đỏ.

**d. Kiểm thật** theo loại unit (`loại=` trong `sh workflow/run.sh doctor <wt> <unit>`), cách làm ở DECISIONS.md mục 3 (sản phẩm chạy bằng `run.sh serve` ở nền, cổng của slot bạn; `run.sh serve` kiểm `SLOT_PORT` rảnh trước và dừng mã `2` nếu cổng đang bị tiến trình khác giữ — kiểm lại bằng `run.sh doctor` nếu gặp). Tự làm lại **từng** tiêu chí trong `SPEC.md` (không chép bằng chứng của Coder) và thêm ca biên:
- `web-service`: dữ liệu sai (400), thiếu quyền (401/403), không tồn tại (404), trùng (409), phân trang, giới hạn độ dài. Khi gọi `curl` (như thử phân trang/lọc nhiều tham số): **tuyệt đối không dùng `&`** (kể cả trong dấu nháy), bắt buộc dùng `-G -d` đặt **SAU URL**, ví dụ `curl http://localhost:<SLOT_PORT>/... -G -d "page=1" -d "limit=20"`. (Nếu kiểm tra cần thêm tham số DB trong slot env, yêu cầu Master tách biến như `PGSSLMODE`, `PGCONNECT_TIMEOUT`, không dùng `&` trong URI);
- `web-frontend`: dùng trình duyệt như người dùng, đối chiếu mockup; ô trống, chuỗi rất dài, danh sách rỗng, thông báo khi nhập sai. Ảnh vào `<gốc>/workflow/F-NNN-…/shots/`;
- `cli`: `sh workflow/run.sh smoke <wt> <unit>`, đối chiếu stdout/stderr và mã thoát với mong đợi; ca biên kiểm qua test (phần c);
- `worker`: nếu unit có `smoke` dạng one-shot/drain có timeout thì chạy `sh workflow/run.sh smoke <wt> <unit>`; nếu là worker chạy dài hạn (consumer Kafka/queue, cron) thì chạy `sh workflow/run.sh serve <wt> <unit>` ở nền (không `&`), kiểm chứng xử lý job/message/log/health (và ca biên như payload lỗi, retry, idempotency) trên tài nguyên slot rồi dừng tác vụ nền (theo `DECISIONS.md` mục 3 và `workflow/stack/<unit>.md`);
- `library`: chỉ test.

Ghi vào `## Kiểm thật` theo mẫu ở DECISIONS.md mục 3, chỉ tóm tắt. Việc thuần nội bộ: `N/A: <lý do>`. Xong thì **dừng tác vụ nền trước**, rồi `sh workflow/run.sh teardown <wt> <unit>` nếu unit có tài nguyên (nếu cổng vẫn bận, `teardown` sẽ in cảnh báo). Chỉ gọi localhost của `<wt>` với tài nguyên của slot: không staging, production, dịch vụ chung, khoá hay tài khoản thật. (Quyền `Read(**/.env)` và `Read(**/.env.*)` bị chặn trên toàn monorepo; chỉ `.env.example`/`.env.sample`/`.env.template` và `.slot.*.env` được phép đọc, không in bí mật.) Không chạy được (thiếu công cụ trình duyệt, thiếu DB, cần khoá thật…) thì ghi rõ phần d chưa làm, đừng ghi "đạt".

**Không sửa code**, trừ lỗi chèn tạm ở phần c. Không sửa `workflow/stack/*` hay `.slot.*.env`: lệnh trong file unit sai hay thiếu thì hỏi Master. Không hỏi thẳng chủ dự án (hỏi qua câu hỏi gửi Master). Lời viết cho chủ dự án (nếu có) gọi là "Đại ca".
