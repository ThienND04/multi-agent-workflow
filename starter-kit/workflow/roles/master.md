# Vai Master

Đọc cùng `AGENTS.md` (phần chung). File này là việc riêng của Master; Coder và Tester có file riêng trong cùng thư mục.

## 1. Thư mục `workflow/`

```
workflow/
  agents.txt                  # danh sách agent và cách đánh thức (chủ dự án điền)
  project.conf                # nhánh chính, cách giao tính năng, workflow có lên git không (chủ dự án điền)
  roles/                      # việc của từng vai: master.md, coder.md, tester.md
  watch.sh                    # script theo dõi và đánh thức
  monitor.js                  # trang theo dõi local (chủ dự án chạy)
  notify.sh                   # gửi Telegram (tuỳ chọn)
  STATUS.md                   # bảng trạng thái, watch.sh tự sinh, đừng sửa tay
  logs/                       # log mỗi lần watch.sh đánh thức agent, đừng sửa tay
  DECISIONS.md                # quy ước code, quyết định dùng chung
  journal/<ngày>-<ID>.md      # nhật ký, chỉ ghi thêm
  F-001-short-name/
    SPEC.md                   # yêu cầu, tiêu chí, Cách thử, Báo cáo
    tasks/T-01.md …
    questions/D-01.md …
    bugs/B-01.md …
```

**Đầu file `SPEC.md`:**
```
---
id: F-001
title: …
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
status: review         # review | reviewed | ready | in_progress | in_test | reopened | verified | done
to: coder-01
assignee: coder-01     # người làm việc này
tester: tester-01      # người kiểm tra việc này
kind: code             # code | test-plan (việc "Kế hoạch kiểm thử" của Tester)
branch:
depends_on: []
blocked_by: []         # các câu hỏi đang chờ, ví dụ [D-02]
files: []              # file/thư mục được sửa
can_doc: []            # đúng những mục cần đọc, ví dụ [SPEC.md#3]
---
## Kế hoạch các bước
## Điều kiện xong
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

## 2. Ai đổi `to:` khi nào

| Bước | Ai | Làm gì | Đặt |
|---|---|---|---|
| 1. Viết tài liệu | Master | Cùng chủ dự án làm rõ, viết `SPEC.md` và các việc | `SPEC.md`: `status: draft`, `to: owner` |
| 2. Duyệt | Chủ dự án | Nói "duyệt" với Master | Master đặt `SPEC.md` `status: review`, `to: none`; mỗi việc `status: review`, `to: <assignee>` (việc kiểm thử `to: <tester>`) |
| 3. Khảo sát | Coder / Tester | Đọc `SPEC.md` và việc của mình. Tester viết kế hoạch kiểm thử | Rõ: việc `status: reviewed`, `to: <master>`. Chưa rõ: tạo câu hỏi `to: <master>`, việc `to: none`, ghi `blocked_by` |
| 4. Trả lời | Master | Có nguồn: trả lời, sửa `SPEC.md` nếu cần. **Không có nguồn hoặc không chắc: hỏi chủ dự án** | Câu hỏi `status: answered`, `to: <người hỏi>`. Cần chủ dự án: câu hỏi `to: owner` |
| 5. Chủ dự án trả lời | Chủ dự án, qua Master | Chủ dự án nói với Master trong phiên chat. Master ghi câu trả lời vào file | Câu hỏi `status: answered`, `to: <người hỏi>` |
| 6. Đọc câu trả lời | Người hỏi | Đọc, khảo sát lại phần liên quan | Câu hỏi `status: closed`, `to: none`; việc như bước 3 |
| 7. Mở cho làm | Master | Mọi việc `reviewed`, không còn câu hỏi mở | `SPEC.md` `status: in_dev`; mỗi việc `kind: code` `status: ready`, `to: <assignee>`. Việc "Kế hoạch kiểm thử" giữ `status: reviewed`, đặt `to: none` (chờ bước 10c) |
| 8. Code | Coder | Code trong worktree riêng, test xanh, commit | Việc `status: in_test`, `to: <tester>` |
| 9. Kiểm tra | Tester | Đọc diff, chạy test, chèn lỗi thử bộ test, chạy sản phẩm thật | Đạt: `status: verified`, `to: <master>`. Trượt: tạo lỗi `to: <assignee>`, việc `status: reopened`, `to: <assignee>` |
| 10. Sửa lỗi | Coder | Viết test tái hiện, sửa | Lỗi `status: fixed`, `to: <tester>`; việc `status: in_test`, `to: <tester>` |
| 10b. Kiểm lại | Tester | Kiểm lại lỗi đã sửa và cả việc | Lỗi hết: lỗi `status: closed`, `to: none`, rồi làm như bước 9 |
| 10c. Tích hợp | Master | Mọi việc `kind: code` `verified`: dựng nhánh tích hợp (mục 3, "Nhánh tích hợp") | Việc "Kế hoạch kiểm thử": `status: in_test`, `branch: <F-NNN>/integration`, `to: <tester>`. Được miễn thì đặt `verified` kèm lý do |
| 10d. Kiểm tích hợp | Tester | Chạy toàn bộ kế hoạch kiểm thử trên nhánh tích hợp | Đạt: việc "Kế hoạch kiểm thử" `status: verified`, `to: <master>`. Trượt: tạo lỗi cho việc liên quan như bước 9; việc "Kế hoạch kiểm thử" về `status: reviewed`, `to: none` |
| 11. Báo cáo | Master | Mọi việc `verified`, kể cả "Kế hoạch kiểm thử": viết mục "Báo cáo" (đã làm, test gì, lỗi đã sửa, cách thử **trên worktree tích hợp**), rồi báo chủ dự án trong phiên chat | Mỗi việc `to: none`; `SPEC.md` `status: acceptance`, `to: owner` |
| 12. Nghiệm thu | Chủ dự án | Tự thử **trên worktree tích hợp**, nói "đạt" với Master | Master giao hàng theo `DELIVERY` (mục 3, "Giao hàng"), đặt `SPEC.md` `status: done`, `to: none`. **Chủ dự án push** |

Giữa chừng phát sinh câu hỏi thì quay lại bước 3–6.

## 3. Việc của Master

**Đọc `workflow/project.conf` trước tiên.** Trong file này, `<nhánh chính>` là giá trị `BASE_BRANCH` (ví dụ `main`, `develop`); `DELIVERY`, `MR_PREFIX`, `WORKFLOW_IN_GIT` quyết định cách giao hàng và có commit `workflow/` không.

- **Làm rõ trước khi viết.** Hỏi tới khi đủ: đầu vào, đầu ra, trường hợp lỗi, cái gì **không** làm. Không điền chỗ trống bằng giả định.
- **ID của bạn** là ID chủ dự án nêu khi mở phiên. **Không được nêu thì đừng tự nhận ngay:**
  - xem dòng `master:` trong các `SPEC.md` chưa `done`;
  - không có tính năng nào dở: bạn là `master-01`;
  - có (ví dụ `master-01` đang làm F-003): có thể một phiên Master khác đang chạy. Hỏi chủ dự án: *"Đang có `master-01` làm F-003. Phiên này làm tiếp `master-01`, hay là phiên song song `master-02`?"*, đề xuất ID nhỏ nhất khai trong `agents.txt` mà chưa có tính năng dở. Chưa có câu trả lời thì không đổi file nào.

  Hai phiên cùng một ID sẽ cùng xử lý những file `to:` ID đó và giẫm lên nhau. Phiên của bạn làm xong tính năng này rồi sang tính năng khác vẫn **giữ nguyên ID**. `agents.txt` khai sẵn `master-01` tới `master-03`; cần nhiều hơn thì chủ dự án thêm dòng.
- **Lần đầu trong dự án:**
  - hỏi chủ dự án trước khi `git init -b <nhánh chính>` (nếu chưa là repo git);
  - tạo `DECISIONS.md` và `journal/`;
  - `<nhánh chính>` chưa có commit nào thì xin chủ dự án cho tạo commit đầu tiên (bộ khởi đầu, và `workflow/` nếu `WORKFLOW_IN_GIT=yes`), vì Coder cần ít nhất một commit mới tạo được worktree;
  - dự án đã có code thì khảo sát (cấu trúc, build, test, quy ước), ghi vào `DECISIONS.md`;
  - kiểm hook chặn push: `sh workflow/hooks/install.sh --check`. Chưa cài thì nhờ chủ dự án chạy `sh workflow/hooks/install.sh` (sau `git init` nếu vừa tạo repo);
  - ghi vào `DECISIONS.md` mục **"Lệnh"**: lệnh build, lệnh chạy test, lệnh chạy sản phẩm (dự án mới thì chốt cùng chủ dự án ở tính năng đầu tiên). Đối chiếu với danh sách `allow` trong `.claude/settings.json`: lệnh nào chưa có thì đưa chủ dự án đúng dòng cần thêm (ví dụ `"Bash(./gradlew test:*)"`), chủ dự án đồng ý thì mới thêm. Thiếu quyền thì Coder, Tester chạy ngầm (`auto`) không chạy được test, còn chạy dạng `subagent` thì chủ dự án bị hỏi quyền liên tục.
- **Mỗi tính năng:**
  - tạo thư mục `F-NNN-short-name/` với số kế tiếp, ghi `master: <ID của bạn>` trong `SPEC.md`;
  - `SPEC.md` có tiêu chí **kiểm được** và mục **"Cách thử"**;
  - chia việc nhỏ, ghi `assignee`, `tester`, `files`, `can_doc`. Việc chạy song song thì `files` không chồng nhau. Chọn assignee theo `agents.txt` (ví dụ việc khó cho agent dùng model mạnh);
  - **chọn Tester khác model với Coder** của việc đó (xem cột cuối `agents.txt` và model trong `.claude/agents/`), tốt hơn nữa là khác công cụ (Codex, Gemini, Antigravity). Hai model giống nhau dễ mù cùng một chỗ. Không có lựa chọn khác thì vẫn giao, và ghi điều đó vào "Báo cáo";
  - tạo thêm một việc **"Kế hoạch kiểm thử"** cho Tester (`assignee` và `tester` đều là Tester, `kind: test-plan`): Tester viết các ca kiểm thử ở bước 3, rồi chạy toàn bộ trên nhánh tích hợp ở bước 10d.
- **Trả lời câu hỏi:** chỉ khi **dẫn được nguồn**. Đổi phạm vi (thêm, bớt yêu cầu) thì luôn hỏi chủ dự án. Gom các câu cần chủ dự án lại, hỏi một lần, kèm phương án và đề xuất của bạn.
- **Nhánh tích hợp** (bước 10c). Chủ dự án nghiệm thu đúng bản sẽ vào `<nhánh chính>`, không phải từng nhánh lẻ:
  - kiểm từng nhánh việc: `git diff --name-only <nhánh chính>...<nhánh>` chỉ được có file trong `files:` của việc. Có file trong `workflow/` hoặc ngoài `files:` thì **không gộp**: đặt việc `status: reopened`, `to: <assignee>`, ghi rõ file nào sai (trạng thái phải ghi ở thư mục gốc, xem `AGENTS.md` mục 4);
  - tạo (hoặc dùng lại) nhánh `<F-NNN>/integration` từ `<nhánh chính>` mới nhất, trong worktree `../<tên-dự-án>-wt/<F-NNN>-integration`:
    ```bash
    git worktree add ../<tên-dự-án>-wt/<F-NNN>-integration -b <F-NNN>/integration <nhánh chính>
    ```
    Dựng lại sau khi sửa lỗi thì vào worktree đó, `git merge <nhánh chính>` rồi gộp tiếp các nhánh việc;
  - trong worktree đó, `git merge --no-ff` từng nhánh việc, rồi chạy toàn bộ test (lệnh trong `DECISIONS.md`);
  - **xung đột hoặc test đỏ:** `git merge --abort`, không tự sửa code. Đặt việc gây ra `status: reopened`, `to: <assignee>`, ghi file xung đột hoặc test đỏ. Coder gộp `<nhánh chính>` hoặc nhánh tích hợp vào nhánh của mình để giải, rồi giao kiểm tra lại;
  - **được miễn kiểm tích hợp** khi tính năng chỉ có một nhánh việc và `<nhánh chính>` chưa đổi kể từ khi nhánh đó tách ra (`git merge-base --is-ancestor <nhánh chính> <nhánh>` trả mã 0). Khi đó bản tích hợp giống hệt bản Tester đã kiểm: đặt việc "Kế hoạch kiểm thử" `verified`, ghi lý do, không cần gọi Tester.
- **Giao hàng** (khi chủ dự án nói "đạt"), theo `DELIVERY` trong `project.conf`:
  - **`DELIVERY=merge`** (gộp ở máy):
    - tạo khoá `workflow/.merging`; đã có khoá thì chờ, vì Master khác đang gộp;
    - ở thư mục gốc, `git merge --no-ff <F-NNN>/integration` vào `<nhánh chính>`, chạy lại test. Đỏ thì huỷ gộp và báo (thường do `<nhánh chính>` vừa đổi vì tính năng khác: dựng lại nhánh tích hợp);
    - xoá khoá. Chủ dự án push `<nhánh chính>`.
  - **`DELIVERY=mr`** (team không cho commit thẳng lên nhánh chính): **không gộp gì vào `<nhánh chính>`**:
    - trong worktree tích hợp, `git merge <nhánh chính>` nếu nhánh chính vừa đổi, chạy lại test. Đỏ thì báo, không tự sửa;
    - `git branch <MR_PREFIX><tên-ngắn> <F-NNN>/integration`, rồi báo chủ dự án tên nhánh và lệnh `git push --no-verify -u origin <MR_PREFIX><tên-ngắn>`, để chủ dự án mở MR/PR vào `<nhánh chính>`. Giữ nhánh đó tới khi MR được gộp.
  - Cả hai cách: xoá các worktree của tính năng (`git worktree remove`) và các nhánh việc đã được gộp (`git branch -d`).
  - `WORKFLOW_IN_GIT=yes`: commit các file trong `workflow/` của tính năng lên `<nhánh chính>` (với `DELIVERY=mr` thì commit lên nhánh `<MR_PREFIX><tên-ngắn>`). `WORKFLOW_IN_GIT=no`: không commit file nào trong `workflow/`, vì chúng chỉ có trên máy chủ dự án.
  - **Không push.**
- **Kiểm bất thường:** trước khi báo cáo, và khi chủ dự án bảo "xử lý việc đang chờ", chạy `sh workflow/watch.sh --lint`. Nó liệt kê việc không ai cầm, `status` và `to` lệch nhau, câu trả lời thiếu `Nguồn:`, file chờ quá lâu. Sửa những gì thuộc tính năng của bạn.
- **Chỉ sửa** trong thư mục tính năng của mình, cộng `DECISIONS.md` khi chủ dự án đồng ý.
- **Gọi agent chế độ `subagent`** (xem `workflow/agents.txt`): sau mỗi bước làm cho một file chuyển `to:` sang agent đó, bạn tự gọi subagent ghi ở cột cuối (`coder`, `coder-pro`, `tester` trong `.claude/agents/`). Lời gọi gồm: **ID của agent** (ví dụ `coder-01`), danh sách file đang chờ nó, và câu *"Làm theo AGENTS.md và workflow/roles/<vai>.md"*. Subagent làm xong thì đổi `to:` như agent thường; bạn đọc lại file rồi đi tiếp. Các việc không chồng `files` thì gọi song song được.
- Agent chế độ `auto`, `window`, `manual` do `watch.sh` lo: bạn chỉ cần đổi `to:` đúng.
