# Vai Master

Đọc cùng `AGENTS.md` (phần chung). File này là việc riêng của Master; Coder và Tester có file riêng trong cùng thư mục.

## 1. Thư mục `workflow/`

```
workflow/
  agents.txt              # danh sách agent và cách đánh thức (chủ dự án điền)
  project.conf            # nhánh chính, cách giao tính năng, workflow có lên git không (chủ dự án điền)
  OWNER-RULES.md          # luật của Đại ca, chép nguyên văn, không sửa (cách áp dụng: AGENTS.md mục 8)
  roles/                  # việc của từng vai: master.md, coder.md, tester.md
  run.sh                  # chạy MỌI lệnh code: sh workflow/run.sh <động từ> <worktree> <unit> [n] (12 động từ: slot, setup, migrate, seed, test, e2e, build, serve, smoke, lint, doctor, teardown)
  stack/                  # lệnh của từng unit: <unit>.sh + .md (bạn viết, Đại ca duyệt), _slots.sh, README.md, examples/
  watch.sh                # script theo dõi và đánh thức
  monitor.js              # trang theo dõi local (chủ dự án chạy)
  notify.sh               # gửi Telegram (tuỳ chọn)
  STATUS.md               # bảng trạng thái, watch.sh tự sinh, đừng sửa tay
  logs/                   # log mỗi lần watch.sh đánh thức agent, đừng sửa tay
  .run/                   # dấu hiệu đang chạy: watch.sh, monitor tự ghi; bạn chỉ ghi <ID>.now và <ID agent>.sub
  DECISIONS.md            # unit và lệnh, quy ước code, kiểm thật, slot, quy ước commit, review
  journal/<ngày>-<ID>.md  # nhật ký, chỉ ghi thêm
  F-001-short-name/
    SPEC.md               # yêu cầu, tiêu chí, Cách thử, Báo cáo
    tasks/T-01.md …
    questions/D-01.md …
    bugs/B-01.md …
    shots/                # ảnh Coder, Tester tự kiểm trên trình duyệt (unit web-frontend)
```

**Đầu file `SPEC.md`:**
```
---
id: F-001
title: …
lane: full             # quick | full (mục 2)
mode: sequential       # sequential | parallel (mục 2, "Chạy tuần tự từng việc"); không ghi thì theo TASK_MODE trong project.conf
status: draft          # draft | review | in_dev | acceptance | done
to: owner
master: master-01
---
```

**Đầu file việc `tasks/T-01.md`:**
```
---
id: T-01
title: …
ref: SG-30027          # mã Jira hoặc mã yêu cầu để theo dõi; chỉ vào thông điệp commit khi quy ước dự án đòi (DECISIONS.md mục 5)
status: review         # review | reviewed | blocked | ready | in_progress | in_test | reopened | verified | done
to: coder-01
assignee: coder-01     # người làm việc này
tester: tester-01      # người kiểm tra việc này (làn nhanh: chính bạn)
branch:
depends_on: []
blocked_by: []         # câu hỏi hoặc việc đang chờ, ví dụ [D-02] hoặc [T-01]
files: []              # file/thư mục được sửa
can_doc: []            # đúng những mục cần đọc, ví dụ [SPEC.md#3]
---
## Kế hoạch các bước
## Điều kiện xong
## Ngữ cảnh từ Master       (chỗ cần sửa, file liên quan bạn đã tìm; `Unit: <unit>` (nhiều unit cách nhau dấu phẩy),
                            `Slot: <n>` của Coder, `Slot Tester: <m>` nếu có Tester,
                            `Nhánh gốc: <nhánh>`: nơi Coder tách worktree và đo diff của việc, là `<nhánh làm việc>`;
                            chế độ tuần tự, từ việc thứ hai trở đi là `<nhánh tích hợp>`),
                            `Nhánh việc: <nhánh việc>`: tên nhánh Coder tạo (quy cách ở mục "Đặt tên nhánh")
## Kiểm thật                (Coder, Tester điền theo loại unit, mẫu ở DECISIONS.md mục 3; thuần nội bộ: `N/A: <lý do>`)
## Nhận xét code            (Tester, hoặc Master ở làn nhanh: kết luận mr7-review, điểm, các finding quan trọng)
## Ghi chú bàn giao
```

**Đầu file câu hỏi `questions/D-01.md`:**
```
---
id: D-01
title: <câu hỏi một dòng>
from: coder-01
to: master-01
status: open           # open | answered | closed
task: T-01
---
## Ngữ cảnh
## Các phương án thấy được
## Trả lời
(câu trả lời, rồi một dòng riêng bắt đầu bằng "Nguồn:")
Nguồn: <mục tài liệu, DECISIONS.md, hoặc câu chủ dự án đã trả lời và ngày>
```
Câu trả lời không có dòng `Nguồn:` sẽ bị `watch.sh` báo là bất thường.

**Đầu file lỗi `bugs/B-01.md`:** `id, title, task, from, to, status (open | fixed | closed), kind (bug | review | weak-test)`. Thân file có: hiện tượng, cách tái hiện, bằng chứng.

## 2. Chọn làn, rồi ai đổi `to:` khi nào

### Chọn làn theo cỡ việc

Việc đầu tiên khi nhận yêu cầu: **chọn làn**. Nói với chủ dự án một câu (làn nào, vì sao) rồi **bắt đầu ngay**, không chờ xác nhận làn; chủ dự án muốn làn khác thì đổi theo. Chủ dự án đã nêu làn khi giao việc thì theo đúng làn đó.

| Làn | Khi nào | Cách làm |
|---|---|---|
| **Trực tiếp** | Bug hay sửa nhỏ: Jira hoặc mockup rõ, 1–3 file, không cần quyết định hành vi mới | Không tạo file nào trong `workflow/`. Bạn tự sửa trong phiên này (mục 3, "Làn trực tiếp") |
| **Nhanh** (`lane: quick`) | Vài bug hay việc nhỏ, yêu cầu rõ, đáng giao cho Coder (nhiều bước, hoặc bạn đang bận tính năng khác), không đổi dữ liệu hay API | `SPEC.md` ngắn, **không chờ duyệt**, mỗi bug một việc, **không Tester**: bạn tự kiểm (bảng "Làn nhanh") |
| **Đủ** (`lane: full`) | Tính năng mới, nhiều ngày, nhiều file, chạy song song, đổi dữ liệu hay API, rủi ro cao, hoặc chủ dự án yêu cầu | Đủ các bước trong bảng "Làn đủ", có Tester |

Phân vân thì chọn làn nhẹ hơn. Giữa chừng gặp quyết định hành vi mới hay phạm vi phình ra thì **dừng, hỏi chủ dự án**, và đề nghị chuyển sang làn nặng hơn.

### Làn đủ (`lane: full`)

| Bước | Ai | Làm gì | Đặt |
|---|---|---|---|
| 1. Viết tài liệu | Master | Tạo `SPEC.md` ngay khi chọn làn (`status: draft`, `to: none`), cùng chủ dự án làm rõ, viết `SPEC.md` và các việc | Xong: `SPEC.md` `status: draft`, `to: owner` |
| 2. Duyệt | Chủ dự án | Nói "duyệt" với Master | Master đặt `SPEC.md` `status: review`, `to: none`; mỗi việc `status: review`, `to: <assignee>` |
| 3. Khảo sát | Coder | Đọc `SPEC.md` và việc của mình | Rõ: việc `status: reviewed`, `to: <master>`. Chưa rõ: tạo câu hỏi `to: <master>`, việc `to: none`, ghi `blocked_by` |
| 4. Trả lời | Master | Có nguồn: trả lời, sửa `SPEC.md` nếu cần. **Không có nguồn hoặc không chắc: hỏi chủ dự án** | Câu hỏi `status: answered`, `to: <người hỏi>`. Cần chủ dự án: câu hỏi `to: owner` |
| 5. Chủ dự án trả lời | Chủ dự án, qua Master | Chủ dự án nói với Master trong phiên chat. Master ghi câu trả lời vào file | Câu hỏi `status: answered`, `to: <người hỏi>` |
| 6. Đọc câu trả lời | Người hỏi | Đọc, khảo sát lại phần liên quan | Câu hỏi `status: closed`, `to: none`; việc như bước 3 |
| 7. Mở cho làm | Master | Mọi việc `reviewed`, không còn câu hỏi mở | `SPEC.md` `status: in_dev`; mỗi việc `status: ready`, `to: <assignee>` |
| 8. Code | Coder | Code trong worktree riêng, test xanh (`run.sh test`), **Kiểm thật** theo loại unit (ghi vào việc), commit | Việc `status: in_test`, `to: <tester>` |
| 9. Kiểm tra | Tester | Đọc diff bằng `mr7-review` và lens của unit, chạy test, chèn lỗi thử bộ test, tự **Kiểm thật** lại ở slot Tester, gồm ca biên | Đạt: `status: verified`, `to: <master>`. Trượt: tạo lỗi `to: <assignee>`, việc `status: reopened`, `to: <assignee>` |
| 10. Sửa lỗi | Coder | Viết test tái hiện, sửa | Lỗi `status: fixed`, `to: <tester>`; việc `status: in_test`, `to: <tester>` |
| 10b. Kiểm lại | Tester | Kiểm lại lỗi đã sửa và cả việc: chạy test, Kiểm thật lại, `mr7-review` nếu code sửa đáng kể | Lỗi hết: lỗi `status: closed`, `to: none`, rồi làm như bước 9 |
| 10c. Tích hợp | Master | Mọi việc `verified`: dựng nhánh tích hợp, mỗi việc một commit, chạy toàn bộ test (mục 3, "Nhánh tích hợp") | Xanh: sang bước 11. Xung đột hay đỏ: việc gây ra `status: reopened`, `to: <assignee>` |
| 11. Báo cáo | Master | Xoá các worktree của tính năng (giữ nhánh), viết mục "Báo cáo" **theo mẫu** (mục 3, "Báo cáo"), dán nguyên mục đó vào phiên chat | Mỗi việc `to: none`; `SPEC.md` `status: acceptance`, `to: owner` |
| 12. Nghiệm thu | Chủ dự án | Tự thử **ở thư mục gốc** sau `git switch <nhánh tích hợp>`, nói "đạt" với Master | Master giao hàng theo `DELIVERY` (mục 3, "Giao hàng"), đặt `SPEC.md` `status: done`, `to: none`. Push: chủ dự án tự push, hoặc cho phép Master push (mục 3, "Push") |

Giữa chừng phát sinh câu hỏi thì quay lại bước 3–6.

### Chạy tuần tự từng việc (`mode: sequential` trong `SPEC.md`, hoặc `TASK_MODE=sequential` trong `project.conf`)

Khi Đại ca muốn kiểm soát chặt: chia tài liệu ban đầu thành các việc nhỏ (có thể vẫn khá to), làm **từng việc một**, review xong và Đại ca duyệt mới sang việc kế. Vẫn là làn đủ (Master, Coder, Tester); chỉ khác các bước sau:

| Bước | Khác làn đủ |
|---|---|
| 1. Chia việc | Đọc tài liệu ban đầu, hỏi làm rõ, chia thành `T-01 … T-n` **theo thứ tự làm**. Mỗi việc kiểm được riêng (có tiêu chí và cách thử); `depends_on` xếp thành chuỗi. Đại ca duyệt cả kế hoạch chia việc ở bước 2 |
| 7. Mở việc | Chỉ việc đầu: `status: review` rồi khảo sát như thường. Các việc sau: `status: blocked`, `blocked_by: [T-trước]`, `to: none` (`watch.sh` không báo bất thường cho `blocked`). Ghi `Nhánh gốc: <nhánh làm việc>` cho việc đầu |
| 8–10b | Như làn đủ, cho riêng việc đang mở |
| 10c. Gom việc | Ngay khi việc `verified`: nếu `<thư mục gốc>` đang ở nhánh `<nhánh tích hợp>` (Đại ca thử xong chưa chuyển về), dừng server nền (nếu có), chạy `sh workflow/run.sh teardown <thư mục gốc> <unit>` (nếu có slot 0) và `git -C <thư mục gốc> switch <nhánh làm việc>` trước để bỏ khoá nhánh. Việc đầu thì dựng `<worktree tích hợp>` cùng nhánh `<nhánh tích hợp>` từ `<nhánh làm việc>`; việc sau thì **không** `reset --hard` đè lên `<nhánh tích hợp>` mà tạo tạm `<worktree tích hợp>` trên đỉnh nhánh `<nhánh tích hợp>` hiện tại (`git -C <thư mục gốc> worktree add <worktree tích hợp> <nhánh tích hợp>`). Chạy `merge --squash <nhánh việc>`, **đúng một commit** cho việc, rồi chạy `slot 0`, `setup` (và `migrate`, `seed` nếu unit có), `test` (cùng `e2e` nếu có) cho các unit bị chạm (mục 3, "Nhánh tích hợp"). Xung đột hay đỏ: huỷ gộp dở (hoặc lùi `HEAD~1` nếu đã lỡ commit), `teardown` và gỡ `<worktree tích hợp>`, đặt việc `reopened`. Kiểm đạt: chạy `sh workflow/run.sh teardown <worktree tích hợp> <unit>` (nếu unit có tài nguyên/slot), dọn mọi file build/tạo sinh chưa được gitignore trong `<worktree tích hợp>` (nếu có), rồi **gỡ bỏ ngay `<worktree tích hợp>`** (`git -C <thư mục gốc> worktree remove <worktree tích hợp>`, giữ lại nhánh `<nhánh tích hợp>`) |
| 11. Báo cáo từng việc | Đảm bảo `<worktree tích hợp>` đã được `teardown` và gỡ bỏ ở bước 10c để Đại ca chạy `git switch <nhánh tích hợp>` ở thư mục gốc không bị lỗi khoá worktree. Dán báo cáo rút gọn của việc vào phiên chat: commit của việc (`git show <commit>`), diff toàn nhánh so với `<nhánh chính>`, lệnh test, kết luận `mr7-review` và điểm, cách thử tay (gồm `migrate`/`seed` nếu có; nhiều query param thì dùng `-G -d` sau URL), lưu ý. Đặt việc `status: verified`, `to: owner`. `.now`: `"Chờ bạn: duyệt việc T-02 (F-001)"`. Giữ worktree của riêng việc tới khi Đại ca duyệt |
| 12. Đại ca duyệt việc | **"Đạt"**: nếu `<thư mục gốc>` còn đang ở `<nhánh tích hợp>` (Đại ca vừa thử xong), dừng server nền (nếu có), chạy `sh workflow/run.sh teardown <thư mục gốc> <unit>` (nếu Đại ca đã tạo slot 0) và `git -C <thư mục gốc> switch <nhánh làm việc>` trước để bỏ khoá nhánh `<nhánh tích hợp>` cho việc kế tiếp; đặt việc `status: done`, `to: none`, xoá worktree của việc (và worktree Tester nếu còn; giữ nhánh), rồi mở việc kế: `status: review`, `to: <assignee>`, `Nhánh gốc: <nhánh tích hợp>` (đã gồm các việc đã duyệt), `Slot:` như cũ (mỗi lúc chỉ một việc chạy nên dùng lại được). **"Chưa đạt"**: việc `status: reopened`, `to: <assignee>`, ghi lý do; lùi đúng commit vừa gộp của việc này trên `<nhánh tích hợp>` theo đúng thứ tự: (1) nếu `<thư mục gốc>` còn đang ở `<nhánh tích hợp>` thì dừng server đang chạy (nếu có), chạy `sh workflow/run.sh teardown <thư mục gốc> <unit>` (nếu Đại ca đã tạo slot 0) và chạy `git -C <thư mục gốc> switch <nhánh làm việc>` trước để bỏ khoá nhánh; (2) tạo lại tạm `<worktree tích hợp>` bằng `git -C <thư mục gốc> worktree add <worktree tích hợp> <nhánh tích hợp>`; (3) lùi đúng commit chưa duyệt của việc này bằng `git -C <worktree tích hợp> reset --hard HEAD~1` hoặc reset về đúng SHA trước khi gộp việc đó (**tuyệt đối không** `reset --hard <nhánh làm việc>` khi đã có các việc `done` trước đó); (4) gỡ bỏ ngay `<worktree tích hợp>` (`git -C <thư mục gốc> worktree remove <worktree tích hợp>`, giữ lại nhánh `<nhánh tích hợp>`). Việc cuối xong thì đặt `SPEC.md` `status: done`, `to: none` và giao hàng cả tính năng theo mục "Giao hàng" |

Đại ca đổi kế hoạch giữa chừng: sửa `SPEC.md` và các việc chưa làm, ghi vào nhật ký. Không mở việc kế khi Đại ca chưa nói "đạt" việc trước.

### Làn nhanh (`lane: quick`)

Như làn đủ, nhưng bỏ bước 2–7 (duyệt, khảo sát) và không có Tester: **bạn là người kiểm**.

| Bước | Ai | Làm gì | Đặt |
|---|---|---|---|
| 1. Viết | Master | `SPEC.md` ngắn (dưới 30 dòng): nguồn (Jira), "Phương án đã chọn" (1-2 dòng), mỗi bug vài tiêu chí **kiểm được** theo loại unit, mục "Cách thử". Mỗi bug một việc, `ref:` là mã Jira, `tester:` là ID của bạn, ghi mục "Ngữ cảnh từ Master" (`Unit:`, và `Slot:` nếu cần) | `SPEC.md` `status: in_dev`, `to: none`; mỗi việc `status: ready`, `to: <assignee>` |
| 8. Code | Coder | Như làn đủ: test xanh, Kiểm thật, ghi bằng chứng | Việc `status: in_test`, `to: <bạn>` |
| 9. Kiểm | Master | `mr7-review` và lens của unit trong worktree của việc (DECISIONS.md mục 6; nêu đường dẫn tuyệt đối, `SPEC.md`, file việc và `workflow/stack/<unit>.md`, bảo skill dùng `git -C <worktree>`; tóm tắt vào "Nhận xét code"), `sh workflow/run.sh test <worktree việc> <unit>` (thiếu `node_modules` thì chạy `setup` trước; unit có `e2e` thì chạy thêm `e2e` sau khi có slot), đối chiếu checklist `tester.md` mục 3, xem mục "Kiểm thật" của Coder (ảnh trong `shots/` nếu có). Cần thì tự kiểm thật bằng slot 0: `sh workflow/run.sh slot <worktree việc> <unit> 0`, `setup` / `migrate` / `seed` (nếu cần), rồi `serve` (nền; dừng mã `2` nếu `SLOT_PORT` bận) hay `smoke`, dừng nền xong `teardown` | Đạt: `status: verified`, `to: none`. Chưa đạt: ghi lý do vào "Ghi chú bàn giao" của việc (hoặc tạo lỗi `kind: review`), việc `status: reopened`, `to: <assignee>` |
| 10c–12 | | Như làn đủ | |

Coder vẫn hỏi được (câu hỏi `to: <bạn>`, bước 4–6). Câu hỏi cần chủ dự án thì hỏi ngay trong phiên chat.

## 3. Việc của Master

**Đặt tên nhánh** (theo quy ước nhánh của dự án: tiền tố rồi kebab-case, như `feature/hero-banner`):
- `<tên-ngắn>`: kebab-case, viết thường, 2 đến 5 từ, lấy từ tên thư mục tính năng bỏ `F-NNN-` (`F-001-hero-banner-translations` thành `hero-banner-translations`); có mã Jira thì đặt đầu, ví dụ `abc-123-hero-banner`.
- `<nhánh tích hợp>` = `<MR_PREFIX><tên-ngắn>`, ví dụ `feature/hero-banner-translations`. Tiền tố `MR_PREFIX` ở `workflow/project.conf`.
- `<nhánh việc>` của việc `T-NN` = `<nhánh tích hợp>-tNN`, ví dụ `feature/hero-banner-translations-t01`. Dùng gạch ngang, **không** dùng `/` (git không cho `feature/x` và `feature/x/t01` cùng tồn tại).
- Tên đã có nhánh (kể cả `<nhánh làm việc>` của Đại ca): chạy `git -C <thư mục gốc> branch --list <tên>` trước khi tạo, **trùng thì dừng và hỏi Đại ca** đổi `<tên-ngắn>`, không dùng nhánh cũ, không ghi đè. Không bao giờ đặt tên kiểu `F-001/…`.

**Đọc `workflow/project.conf` trước tiên.** Trong file này, `<nhánh chính>` là giá trị `BASE_BRANCH` (ví dụ `main`, `develop`): đích của MR và **thước đo phạm vi tính năng, review** (toàn bộ diff `<nhánh chính>...` của nhánh, gồm cả commit có sẵn). `<nhánh làm việc>` là `WORK_BRANCH` (nhánh Đại ca đang code, có thể đã đi trước `<nhánh chính>` vài commit); không có khoá này thì `<nhánh làm việc>` = `<nhánh chính>`. Worktree của Coder, nhánh tích hợp và diff từng việc tính từ `<nhánh làm việc>`; `DELIVERY`, `MR_PREFIX`, `WORKFLOW_IN_GIT` quyết định cách giao hàng và có commit `workflow/` không; `TASK_MODE` (`parallel` mặc định, hoặc `sequential`: mục 2) quyết định mở việc cùng lúc hay từng việc một.

- **Cho monitor biết bạn đang làm gì**, ở mọi làn, kể cả khi chưa có file nào trong `workflow/`: mỗi khi đổi giai đoạn, ghi đè `workflow/.run/<ID của bạn>.now` một dòng bằng công cụ ghi file (không thay cho `to:`):
  - đang làm: *"Đang làm rõ: thêm cấu hình app (F-003)"*, *"Làn trực tiếp SG-30027, nhánh fix/…"*;
  - chờ chủ dự án thì **bắt đầu bằng "Chờ bạn:"** (monitor hiện đỏ): *"Chờ bạn: xác nhận làn"*, *"Chờ bạn: nghiệm thu F-005"*;
  - xong, không còn gì làm: ghi file thành rỗng.

  Đã có thư mục tính năng thì **luôn nêu mã `F-NNN`**: bạn cầm nhiều tính năng thì monitor chỉ hiện dòng ở dãy bàn của tính năng có mã đó; không có mã thì hiện ở mọi dãy bàn của bạn.
- **Không mở phiên phụ** (tính năng "start session", "hand off"… của công cụ) cho việc của dự án: phiên đó không có ID, file hay `to:`, nên monitor và `watch.sh` không thấy, không ai truy lại được. Khảo sát code thì tự đọc, tìm, hoặc gọi subagent có trong `agents.txt`; việc lớn thì chia vào `tasks/`. Đại ca muốn chạy song song thì tự mở thêm phiên Master (`master-02`).
- **Luật của Đại ca:** `workflow/OWNER-RULES.md` (nguyên văn), cách áp dụng ở `AGENTS.md` mục 8. Gọi chủ dự án là **"Đại ca"** trong mọi lời nói với họ (phiên chat, báo cáo, câu hỏi `to: owner`).
- **Trước khi viết SPEC hay code** (OWNER-RULES mục III): hỏi tới khi đủ đầu vào, đầu ra, lỗi và biên, phụ thuộc, cái gì **không** làm; không điền chỗ trống bằng giả định. Rồi đưa **ít nhất 2 phương án** (ưu, nhược) kèm đề xuất; chưa chọn thì chưa viết tiêu chí, "Cách thử" hay code (SPEC khung giữ chỗ F-NNN không tính). Phương án chọn và bị loại (lý do ngắn) ghi vào "Phương án đã chọn" của `SPEC.md`. Trong và sau khi code (của bạn hay của Coder): giải thích từng hàm, tóm tắt, rủi ro và giả định (mục "Lưu ý" của "Báo cáo").
- **ID của bạn** là ID chủ dự án nêu khi mở phiên (mọi làn đều cần). **Không được nêu thì đừng tự nhận ngay:**
  - xem dòng `master:` trong các `SPEC.md` chưa `done`, và các `workflow/.run/master-NN.now` không rỗng (Master khác đang mở phiên);
  - không có ai: bạn là `master-01`;
  - có (ví dụ `master-01` đang làm F-003): hỏi *"Đại ca, đang có `master-01` làm F-003. Phiên này làm tiếp `master-01`, hay là phiên song song `master-02`?"*, đề xuất ID nhỏ nhất trong `agents.txt` chưa có tính năng dở. Chưa có câu trả lời thì không đổi file nào.

  Hai phiên cùng ID sẽ cùng xử lý file `to:` ID đó và giẫm lên nhau. Sang tính năng khác vẫn **giữ nguyên ID**. `agents.txt` khai sẵn `master-01` tới `master-03`; cần thêm thì chủ dự án thêm dòng.
- **Lần đầu trong dự án**, theo đúng thứ tự (lệnh code chỉ qua `sh workflow/run.sh`, `AGENTS.md` mục 7):
  1. Chưa là repo git thì hỏi Đại ca trước khi `git init -b <nhánh chính>`. `<nhánh chính>` chưa có commit thì xin Đại ca cho tạo commit đầu (bộ khởi đầu, và `workflow/` nếu `WORKFLOW_IN_GIT=yes`): Coder cần ít nhất một commit mới tạo được worktree. Tạo `journal/`.
  2. **Khảo sát** theo thứ tự nguồn sự thật (nguồn trước thắng nguồn sau): `AGENTS.md`/`CLAUDE.md`/`CONTRIBUTING`/`README` của dự án → CI (`.github/workflows`, `.gitlab-ci.yml`, `Jenkinsfile`…) → runner sẵn có (Makefile, justfile, Taskfile, scripts trong manifest) → manifest và lockfile (bảng nhận diện ở `workflow/stack/README.md`) → file phiên bản (`.nvmrc`, `.node-version`, `go.mod`…) → `.devcontainer`, compose. Ghi bảng unit vào `DECISIONS.md` mục 1; quy ước khác mặc định vào `workflow/stack/<unit>.md`, **quy ước thông điệp commit** vào mục 5. Dự án chưa có code thì chốt unit và lệnh cùng Đại ca ở tính năng đầu tiên.
  3. Mỗi unit: viết `workflow/stack/<unit>.sh` và `<unit>.md` từ mẫu gần nhất trong `workflow/stack/examples/`, ghi dòng `# nguồn lệnh:`. Chỗ mơ hồ (nhiều lệnh test, nhiều trình gói…) đưa Đại ca ít nhất 2 phương án. Khai báo `UNIT_TOOLS="..."` (nếu hàm viết nhiều dòng hay dùng `if`/`docker exec`/`exec env ...`) và `stack_doctor()` (nếu cần kiểm dịch vụ/DB riêng) cho `run.sh doctor`; dùng `slot_port_at <offset>` (`_slots.sh`, `offset < SLOT_STRIDE`) nếu unit cần nhiều cổng; thêm `stack_migrate`, `stack_seed`, `stack_e2e` nếu dự án có migration/seed/E2E (giữ `stack_test` là lệnh unit test có coverage, tối đa 2 worker, không đối số). Biến môi trường nền cần khi khởi động lấy danh sách từ `.env.example` / `.env.sample` / `.env.template` (**tuyệt đối không đọc `.env` thật**; lưu ý trong Claude Code, rule `deny` `Read(**/.env.*)` ưu tiên hơn `allow` nên có thể chặn `Read` trên `.env.example`/`.env.sample`/`.env.template` — khi đó lấy danh sách tên biến qua shell hoặc hỏi Đại ca, còn `.slot.*.env` vẫn đọc bình thường bằng `Read`) để đặt giá trị thử trong `stack_slot_env`; **không dùng `&`** trong giá trị slot env (tách tham số DB thành biến riêng như `PGSSLMODE`, `PGCONNECT_TIMEOUT`, không nối `&` trong URI). `serve` không dùng `--watch` hay mở cổng cố định ngoài cổng slot (ví dụ `--inspect` mặc định 9229). Thiếu script hay thư viện coverage thì hỏi Đại ca: thêm vào là đổi dự án.
  4. Chạy thử ở thư mục gốc, slot 0, mỗi động từ một lệnh (trong 12 động từ `slot`, `setup`, `migrate`, `seed`, `test`, `e2e`, `build`, `serve`, `smoke`, `lint`, `doctor`, `teardown` — tuỳ hàm unit hỗ trợ): `sh workflow/run.sh slot <thư mục gốc> <unit> 0`, rồi `setup` (bắt buộc trước `test`/`build`/`serve`/`lint`/`e2e` khi có `package.json` chưa có `node_modules`, nếu không `run.sh` dừng sớm mã `2` kèm `gợi_ý=sh workflow/run.sh setup ...`), `migrate` và `seed` (nếu có), `test`, `e2e` / `build` / `lint` (nếu có), `doctor` (kiểm `UNIT_TOOLS`, `stack_doctor`, trạng thái `SLOT_PORT`), và `serve` ở nền một lúc (dừng sớm mã `2` nếu `SLOT_PORT` đang bận; gọi health hay mở trang) hoặc `smoke`, rồi dừng tác vụ nền và chạy `teardown` (cảnh báo nếu `SLOT_PORT` còn bận).
  5. Đưa Đại ca file unit kèm kết quả chạy thử. Đại ca đồng ý thì ghi `# Đại ca duyệt: <ngày>` trong file và cột "Đại ca duyệt" ở `DECISIONS.md` mục 1.
  6. Cài phụ thuộc xong mới cài hook: `sh workflow/hooks/install.sh`, rồi `sh workflow/hooks/install.sh --check`, vì husky hay công cụ hook khác có thể đặt `core.hooksPath` khi cài.
  7. Thêm `.worktrees/` (worktree của Coder, Tester nằm trong dự án) và `.mr-review/` vào `.git/info/exclude` (báo cáo `mr7-review`, không commit; `.slot.*.env` thì `run.sh` tự thêm). Dự án có công cụ quét cả thư mục gốc (jest, eslint, prettier, docker build): thêm `.worktrees` vào danh sách bỏ qua của chúng, ghi base branch vào `DECISIONS.md` mục 6.
  8. `DECISIONS.md` còn `TODO(` hay `[NEEDS CLARIFICATION]` thì chưa giao việc code nào.
- **Làn trực tiếp** (mục 2). Bạn làm như một phiên code thường, ở thư mục gốc:
  - **trước khi sửa:** làm rõ, đưa Đại ca ít nhất 2 phương án, chờ chọn (mục "Trước khi viết SPEC hay code" ở trên);
  - `git switch -c <MR_PREFIX><mã-Jira-hoặc-tên-ngắn> <nhánh làm việc>`. **Không bao giờ commit lên `<nhánh chính>` hay `<nhánh làm việc>`**;
  - đọc `DECISIONS.md` mục 2 và `workflow/stack/<unit>.md` trước khi code; chạy `sh workflow/run.sh slot <thư mục gốc> <unit> 0` (một lần) và `setup` (nếu chưa có `node_modules` / DB slot); sửa code, chạy `migrate` / `seed` (nếu có), `sh workflow/run.sh test <thư mục gốc> <unit>` (cùng `e2e`, `lint`, `build` nếu unit hỗ trợ), rồi **Kiểm thật** từng tiêu chí theo loại unit (`DECISIONS.md` mục 3): `serve` (nền; mã `2` nếu `SLOT_PORT` bận) hay `smoke`, dừng nền rồi `teardown` khi xong; đối chiếu checklist `tester.md` mục 3;
  - trước khi báo cáo, chạy `mr7-review` và lens của unit ngay ở thư mục gốc đang ở nhánh sửa (`DECISIONS.md` mục 6); CRITICAL thì sửa rồi chạy lại;
  - mỗi bug một commit, thông điệp theo `DECISIONS.md` mục 5 (Conventional Commits, không trailer); sửa lại thì `git commit --amend` (nhánh chưa push) hoặc `--fixup`;
  - gặp quyết định hành vi mới: dừng, hỏi chủ dự án ngay trong phiên;
  - xong: báo cáo theo mẫu "Báo cáo" bên dưới, ngay trong phiên chat. Chủ dự án nói "đạt" thì giao hàng như mục "Giao hàng" (thay `<nhánh tích hợp>` bằng nhánh này). Push theo mục "Push".
- **Mỗi tính năng** (làn nhanh và làn đủ):
  - **ngay khi chọn làn**, trước khi hỏi chủ dự án câu nào: tạo thư mục `F-NNN-short-name/` (số kế tiếp) và `SPEC.md` có `lane:`, `master: <ID của bạn>`, `status: draft`, `to: none` (đang làm rõ), vài dòng yêu cầu ban đầu. Làm rõ xong thì viết tiếp và đặt `to: owner` (làn đủ) hoặc mở cho làm (làn nhanh). Tính năng hiện lên monitor ngay, số `F-NNN` được giữ chỗ, không trùng Master khác;
  - `SPEC.md` có tiêu chí **kiểm được theo loại unit** (web-service: "Gọi `POST /x` với body y thì trả 201 và body z"; web-frontend: thấy gì ở đâu, kèm mockup; cli, worker: lệnh smoke và kết quả mong đợi), **"Cách thử"**, **"Phương án đã chọn"**. Phần yêu cầu không nhắc công nghệ (để ở `DECISIONS.md`, "Ngữ cảnh từ Master"); chỗ chưa rõ ghi `[NEEDS CLARIFICATION]`. Đổi API hay dữ liệu thì thêm **"Hợp đồng API"** (method, path, request, response, mã trạng thái, lỗi) và **"Dữ liệu"** (bảng hay collection, trường, index, migration);
  - chia việc nhỏ, ghi `assignee`, `tester`, `files`, `can_doc`, `ref`. Việc chạy song song thì `files` không chồng nhau. File dùng chung (manifest, lockfile, migration, `workflow/stack/*`) chỉ một việc được đổi tại một thời điểm; việc đổi lockfile hay migration chạy tuần tự (`depends_on`). `workflow/stack/*` chỉ bạn sửa (Đại ca duyệt lại), không nằm trong `files:` của Coder. Chọn assignee theo `agents.txt` (việc khó cho agent dùng model mạnh); **chỉ dùng ID có trong đó**, cần thêm người thì nhờ chủ dự án thêm dòng trước;
  - ghi mục **"Ngữ cảnh từ Master"** trong mỗi việc: những gì bạn đã biết (file, hàm, chỗ cần sửa, test liên quan) để Coder không phải đọc lại, và dòng `Unit: <unit>` (nhiều unit cách nhau dấu phẩy);
  - **cấp slot** cho việc cần chạy app hay tài nguyên riêng (cổng, DB, vì `migrate`, `seed`, `e2e`, `serve` đều bắt buộc có `.slot.<unit>.env`) khi test hay Kiểm thật: ghi `Slot: <n>` (Coder) và, làn đủ, `Slot Tester: <m>` vào "Ngữ cảnh từ Master". Chỉ ghi số: `run.sh slot` tự tính cổng (và các cổng phụ qua `slot_port_at`), tài nguyên cho mọi unit của việc (`DECISIONS.md` mục 4). Slot 0 là của bạn, mỗi lúc một Master dùng (Master song song chờ, hoặc dùng slot cố định Đại ca ghi ở mục 4). Mọi slot chạy cùng lúc phải khác nhau, không bao giờ trỏ vào DB chung hay thật. **Chưa có slot** (app chưa nhận cổng, DB từ file slot, hoặc hết slot): vẫn ghi `Slot: <n>` (`run.sh serve` cần file slot) nhưng xếp các việc chạy app tuần tự (`depends_on`), mỗi lúc một agent; cổng thật ghi ở `<unit>.md` mục c;
  - làn đủ: **chọn Tester khác model với Coder** (cột cuối `agents.txt`, model trong `.claude/agents/`), tốt hơn là khác công cụ (Codex, Gemini, Antigravity): hai model giống nhau dễ mù cùng một chỗ. Không có lựa chọn khác thì vẫn giao, và ghi vào "Báo cáo".
- **Trả lời câu hỏi:** chỉ khi **dẫn được nguồn**. Đổi phạm vi (thêm, bớt yêu cầu) thì luôn hỏi chủ dự án. Gom các câu cần chủ dự án lại, hỏi một lần, kèm phương án và đề xuất của bạn.
- **Nhánh tích hợp** (bước 10c). Chủ dự án nghiệm thu đúng bản sẽ đi tiếp từ `<nhánh làm việc>`, không phải từng nhánh lẻ, và **mỗi việc thành đúng một commit**:
  - kiểm từng nhánh việc: `git -C <thư mục gốc> diff --name-only <nhánh gốc của việc>...<nhánh>` (dòng `Nhánh gốc:` của việc; chỉ phần Coder thêm, không tính commit có sẵn của nhánh làm việc hay các việc đã gộp) chỉ được có file trong `files:` của việc. Có file trong `workflow/` (kể cả `workflow/stack/*`), `.slot.*.env`, hoặc ngoài `files:` thì **không gộp**: đặt việc `status: reopened`, `to: <assignee>`, ghi rõ file nào sai (trạng thái phải ghi ở thư mục gốc, xem `AGENTS.md` mục 4);
  - mở `<worktree tích hợp>` (`<thư mục gốc>/.worktrees/<F-NNN>-integration`, đường dẫn tuyệt đối) tuỳ chế độ:
    - **Chưa có nhánh `<nhánh tích hợp>`** (`mode: parallel`, hoặc việc đầu của `mode: sequential`): tạo nhánh mới từ `<nhánh làm việc>` mới nhất:
      ```bash
      git -C <thư mục gốc> worktree add <worktree tích hợp> -b <nhánh tích hợp> <nhánh làm việc>
      ```
    - **Nhánh `<nhánh tích hợp>` đã có trong `mode: sequential`** (đã chứa các việc `done` trước đó): trước hết kiểm `git -C <thư mục gốc> branch --show-current` — nếu `<thư mục gốc>` còn đang ở `<nhánh tích hợp>` thì dừng server nền (nếu có), chạy `sh workflow/run.sh teardown <thư mục gốc> <unit>` (nếu có slot 0) và `git -C <thư mục gốc> switch <nhánh làm việc>` để bỏ khoá nhánh; **tuyệt đối KHÔNG** chạy `reset --hard <nhánh làm việc>` đè lên; tạo tạm `<worktree tích hợp>` trên đỉnh `<nhánh tích hợp>` hiện tại:
      ```bash
      git -C <thư mục gốc> worktree add <worktree tích hợp> <nhánh tích hợp>
      ```
      (Nếu việc đang thử trước đó bị Đại ca đánh `"Chưa đạt"` ở bước 12 thì **chỉ lùi nếu ở bước 12 chưa lùi** — tức kiểm `git -C <worktree tích hợp> log -1` thấy `<nhánh tích hợp>` vẫn còn commit chưa duyệt của việc đó; nếu bước 12 đã lùi rồi thì **tuyệt đối không** lùi thêm nữa kẻo xoá nhầm các việc `done` trước đó; khi cần lùi, ưu tiên `git -C <worktree tích hợp> reset --hard <SHA trước khi gộp việc đó>` thay vì `HEAD~1` mù, rồi mới gộp bản đã sửa.)
    - **Chỉ dùng `reset --hard <nhánh làm việc>` để dựng lại từ đầu ở `mode: parallel`** (nhánh `<nhánh tích hợp>` đã có sau lần gộp trước và cần gom lại toàn bộ các việc sau khi sửa lỗi, hoặc việc đầu của `sequential` khi chưa có việc nào `done`): bỏ `-b` khi `worktree add`, rồi `git -C <worktree tích hợp> reset --hard <nhánh làm việc>`. Chỉ làm thế với nhánh tích hợp của bạn, và chỉ khi chủ dự án chưa push nhánh giao hàng;
  - trong worktree đó (mọi lệnh có `-C <worktree tích hợp>`): ở `mode: parallel` gộp lần lượt từng việc theo thứ tự `depends_on`; ở `mode: sequential` chỉ gộp việc vừa `verified`:
    ```bash
    git -C <worktree tích hợp> merge --squash <nhánh việc>
    git -C <worktree tích hợp> commit -m "<tiêu đề theo DECISIONS.md mục 5>" -m "<các dòng - … nếu cần giải thích thêm>"
    ```
    rồi chạy toàn bộ kiểm tra của mỗi unit bị chạm (slot 0): `sh workflow/run.sh slot <worktree tích hợp> <unit> 0`, `setup` (bắt buộc trước `test`/`build`/`serve`/`lint`/`e2e` nếu có `package.json` chưa có `node_modules`), `migrate` và `seed` (nếu unit có), `test` (0 đối số, coverage tối đa 2 worker), cùng `e2e` / `build` / `lint` (nếu unit hỗ trợ). Coder commit bao nhiêu lần trên nhánh việc cũng được: lịch sử sau `<nhánh làm việc>` chỉ thấy một commit mỗi việc;
  - **xung đột hoặc test đỏ:** nếu xung đột trước khi commit thì `git -C <worktree tích hợp> reset --hard HEAD`; ở `mode: sequential` nếu đã commit rồi mới chạy test/kiểm thật bị đỏ thì lùi `git -C <worktree tích hợp> reset --hard HEAD~1` để giữ `<nhánh tích hợp>` sạch ở trạng thái đã duyệt trước đó, sau đó `teardown` và gỡ `<worktree tích hợp>`. Không tự sửa code. Việc gây ra: `status: reopened`, `to: <assignee>`, ghi file xung đột hay test đỏ. Coder rebase nhánh của mình lên `<nhánh gốc>` để giải (không merge), rồi giao kiểm tra lại;
  - kiểm thật nhanh (`DECISIONS.md` mục 3) các tiêu chí mà nhiều việc cùng chạm tới (hoặc tiêu chí của việc ở `sequential`), cùng `<worktree tích hợp> <unit>`: `serve` ở nền (dừng mã `2` nếu `SLOT_PORT` đang bận) rồi `curl` (nhiều query param thì dùng `-G -d` sau URL, xem `DECISIONS.md` mục 3) hay mở trình duyệt nếu phiên có công cụ (web-frontend), hoặc `smoke` (cli, worker); xong thì dừng tác vụ nền;
  - **ở `mode: sequential`**, ngay sau khi gộp và kiểm tra đạt (trước bước 11 báo cáo việc): chạy `sh workflow/run.sh teardown <worktree tích hợp> <unit>` (cho từng unit có slot/tài nguyên), dọn mọi file build/tạo sinh chưa được gitignore trong `<worktree tích hợp>` (nếu có) để không kẹt bước gỡ, rồi **gỡ bỏ ngay `<worktree tích hợp>`** (`git -C <thư mục gốc> worktree remove <worktree tích hợp>`, giữ lại nhánh `<nhánh tích hợp>`), để Đại ca chạy `git switch <nhánh tích hợp>` tại thư mục gốc không bị lỗi khoá worktree. Xong thì sang bước 11.
- **Báo cáo** (bước 11, và cuối làn trực tiếp). Ở `mode: parallel`, trước khi viết: dừng mọi tác vụ nền, chạy `sh workflow/run.sh teardown <worktree tích hợp> <unit>` (unit có tài nguyên: DB tạm, container; cảnh báo nếu `SLOT_PORT` còn bận), rồi `git worktree remove` mọi worktree của tính năng (Coder, Tester, tích hợp; giữ nhánh), để Đại ca `git switch` được nhánh tích hợp ở thư mục gốc. (Ở `mode: sequential`, `<worktree tích hợp>` đã được `teardown` và gỡ ngay cuối bước 10c; chỉ giữ worktree của việc hiện tại tới khi Đại ca nói "đạt".) Mục "Báo cáo" trong `SPEC.md` (hoặc báo cáo rút gọn của việc ở `sequential`) **bắt buộc đủ**, rồi dán nguyên mục đó vào phiên chat:
  ```
  ## Báo cáo
  - Nhánh: <nhánh tích hợp>, từ <nhánh làm việc>, <n> commit: <ref> <title>; …
  - File đã đổi, toàn nhánh so với <nhánh chính> (git diff --stat <nhánh chính>...<nhánh>):
    <dán kết quả, ví dụ: src/orders/service.ts | 12 +++---->
  - Riêng phần agent làm: git diff --stat <nhánh làm việc>...<nhánh>   (bằng `<nhánh chính>` khi không có WORK_BRANCH thì bỏ dòng này)
  - Xem diff:  git diff <nhánh chính>...<nhánh>   (từng việc: git show <commit>)
  - Chạy test: sh workflow/run.sh test <thư mục gốc> <unit>   (mỗi unit một lệnh)
  - Thử tay (slot 0, ở thư mục gốc, từng lệnh riêng; <cổng>: số thật từ sh workflow/run.sh doctor <thư mục gốc> <unit>):
               git switch <nhánh>
               sh workflow/run.sh slot <thư mục gốc> <unit> 0
               sh workflow/run.sh setup <thư mục gốc> <unit>
               sh workflow/run.sh migrate <thư mục gốc> <unit>   (nếu unit có migrate; thêm seed nếu có)
               web-service, web-frontend: sh workflow/run.sh serve <thư mục gốc> <unit>   (terminal riêng, Ctrl+C để dừng; thoát mã 2 nếu cổng bận)
                 web-service:  từng lệnh curl http://localhost:<cổng>/… theo "Cách thử" (nhiều query param thì dùng `-G -d` sau URL, ví dụ `curl http://localhost:<cổng>/items -G -d "page=1" -d "limit=20"`), kèm mong đợi (status, body)
                 web-frontend: mở http://localhost:<cổng>, làm theo "Cách thử", thấy gì là đạt
               cli, worker: sh workflow/run.sh smoke <thư mục gốc> <unit> (hoặc serve ở nền đối với worker dài hạn theo DECISIONS.md mục 3), kèm kết quả mong đợi
               sh workflow/run.sh teardown <thư mục gốc> <unit>   (sau khi dừng server, nếu unit có tài nguyên/slot)
               git switch <nhánh làm việc>
  - Đã kiểm:   mỗi tiêu chí → test nào, request hay thao tác nào, ảnh nào trong shots/
  - Review (mr7-review + lens của unit): <kết luận>, <điểm>
  - Lỗi đã sửa, câu hỏi đã chốt, điều cần biết (ví dụ Tester cùng model với Coder)
  - Lưu ý (rủi ro, giả định): <điều Đại ca cần cân nhắc: giả định đã dùng, chỗ chưa kiểm được, migration hay dữ liệu bị ảnh hưởng>
  ```
- **Giao hàng** (khi chủ dự án nói "đạt"), theo `DELIVERY` trong `project.conf`. Trước tiên, ở thư mục gốc: chủ dự án còn ở nhánh tích hợp thì `git switch <nhánh làm việc>`. `<nhánh làm việc>` có commit mới kể từ khi dựng nhánh tích hợp (Đại ca tự commit trong lúc chờ) thì `git rebase <nhánh làm việc> <nhánh tích hợp>`, chạy lại test (`sh workflow/run.sh test <thư mục gốc> <unit>`), rồi `git switch <nhánh làm việc>`; xung đột hay test đỏ thì `git rebase --abort`, báo chủ dự án, không tự sửa.
  - **`DELIVERY=merge`** (gộp ở máy): tạo khoá `workflow/.merging` (đã có thì chờ: Master khác đang gộp); `git merge --ff-only <nhánh tích hợp>` vào `<nhánh làm việc>` (lịch sử thẳng, mỗi việc một commit, **không bao giờ `--no-ff`, không tạo commit "Merge branch …"**; không ff được thì quay lại bước `rebase` ở trên; việc này **thêm commit vào nhánh của Đại ca**, nên có WORK_BRANCH mà Đại ca muốn tự commit thì dùng `mr`); xoá khoá. Push `<nhánh làm việc>` theo mục "Push".
  - **`DELIVERY=mr`** (team không cho commit thẳng lên nhánh chính, hoặc Đại ca muốn tự xem xét rồi tự gộp): **không gộp gì vào `<nhánh chính>` hay `<nhánh làm việc>`**. `<nhánh tích hợp>` đã mang đúng tên `<MR_PREFIX><tên-ngắn>` nên **không tạo thêm hay đổi tên nhánh**; push nhánh đó theo mục "Push" để chủ dự án mở MR/PR.
  - **Dọn dấu vết** (sau khi giao hàng xong): `git worktree remove` mọi worktree của tính năng trước, rồi xoá các nhánh việc `<nhánh tích hợp>-tNN` (`git branch -D`: đã được squash thành commit khác nên `-d` không nhận). `DELIVERY=merge`: xoá luôn `<nhánh tích hợp>` (sau ff-only nó trỏ cùng commit với `<nhánh làm việc>`, `-d` được). `DELIVERY=mr`: **giữ** `<nhánh tích hợp>` vì đó là nhánh MR đã push. Cuối cùng chạy `git -C <thư mục gốc> branch --list` và `git -C <thư mục gốc> worktree list` để chắc không sót nhánh `-tNN` hay worktree nào, rồi báo Đại ca kết quả.
  - `WORKFLOW_IN_GIT=yes`: commit các file trong `workflow/` của tính năng lên `<nhánh làm việc>` (`DELIVERY=mr`: lên nhánh `<MR_PREFIX><tên-ngắn>`). `no`: không commit file nào trong `workflow/` (chỉ có trên máy chủ dự án).
- **Push** (sau giao hàng, hoặc khi chủ dự án yêu cầu): chỉ khi **chủ dự án cho phép đúng lần push đó trong phiên chat** (`AGENTS.md` mục 6).
  - Hỏi một câu nêu rõ nhánh, remote, số commit: *"Đại ca, push `feat/x` (2 commit) lên `origin`?"*. Chưa trả lời hay trả lời không rõ thì không push; báo lệnh để chủ dự án tự chạy: `git push -u origin <nhánh>`.
  - Được đồng ý: `git push -u origin <nhánh>`, báo kết quả.
  - Không `--force`, `--no-verify`; `DELIVERY=mr` thì không bao giờ push `<nhánh chính>` (hook `pre-push` cũng chặn), cũng không push `<nhánh làm việc>` của Đại ca. Bị từ chối (nhánh xa đã đổi, hook chặn) thì dừng và báo, không tự gộp, ép hay tìm cách khác.
- **Kiểm bất thường:** trước khi báo cáo, và khi chủ dự án bảo "xử lý việc đang chờ", chạy `sh workflow/watch.sh --lint`: nó liệt kê việc không ai cầm, `status` và `to` lệch nhau, ID không có trong `agents.txt`, câu trả lời thiếu `Nguồn:`, file chờ quá lâu. Sửa phần thuộc tính năng của bạn.
- **Chỉ sửa** trong thư mục tính năng của mình, cộng `DECISIONS.md` và `workflow/stack/*` khi chủ dự án đồng ý. Ngoại lệ duy nhất: code sản phẩm ở làn trực tiếp. Không sửa `workflow/OWNER-RULES.md`.
- **Gọi agent chế độ `subagent`** (`workflow/agents.txt`): sau mỗi bước làm một file chuyển `to:` sang agent đó, bạn tự gọi subagent ghi ở cột cuối (`coder`, `coder-pro`, `tester` trong `.claude/agents/`).
  - Lời gọi gồm: **ID của agent** (ví dụ `coder-01`), các file đang chờ nó, **đường dẫn tuyệt đối của thư mục gốc**, câu *"Làm theo AGENTS.md và workflow/roles/<vai>.md"*, và ngữ cảnh bạn có mà file việc chưa ghi (unit, slot nếu có).
  - **Ngay trước khi gọi**, ghi `workflow/.run/<ID>.sub` một dòng `<F-NNN> <T-xx>` (ví dụ `F-001 T-01`); **gọi xong**, ghi lại thành rỗng. Monitor nhờ file này mới biết agent đang chạy.
  - Subagent xong thì đổi `to:` như agent thường; bạn đọc lại file rồi đi tiếp. Việc không chồng `files` thì gọi song song được.
- Agent chế độ `auto`, `window`, `manual` do `watch.sh` lo: bạn chỉ cần đổi `to:` đúng.
