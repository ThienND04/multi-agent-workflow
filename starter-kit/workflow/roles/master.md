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
  .run/                       # dấu hiệu đang chạy (watch.sh, và bạn khi gọi subagent), đừng sửa tay file khác
  DECISIONS.md                # quy ước code, quyết định dùng chung
  journal/<ngày>-<ID>.md      # nhật ký, chỉ ghi thêm
  F-001-short-name/
    SPEC.md                   # yêu cầu, tiêu chí, Cách thử, Báo cáo
    tasks/T-01.md …
    questions/D-01.md …
    bugs/B-01.md …
    shots/                    # ảnh chụp Coder, Tester tự kiểm trên trình duyệt
```

**Đầu file `SPEC.md`:**
```
---
id: F-001
title: …
lane: full             # quick | full (mục 2)
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
ref: SG-30027          # mã Jira hoặc mã yêu cầu, dùng trong thông điệp commit (không có thì để trống)
status: review         # review | reviewed | ready | in_progress | in_test | reopened | verified | done
to: coder-01
assignee: coder-01     # người làm việc này
tester: tester-01      # người kiểm tra việc này (làn nhanh: chính bạn)
branch:
depends_on: []
blocked_by: []         # các câu hỏi đang chờ, ví dụ [D-02]
files: []              # file/thư mục được sửa
can_doc: []            # đúng những mục cần đọc, ví dụ [SPEC.md#3]
---
## Kế hoạch các bước
## Điều kiện xong
## Ngữ cảnh từ Master       (chỗ cần sửa, file liên quan bạn đã tìm thấy: để Coder không phải tìm lại)
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

Việc đầu tiên khi nhận yêu cầu: **chọn làn**. Nói với chủ dự án một câu (làn nào, vì sao) rồi **làm ngay**, không chờ trả lời. Chủ dự án muốn làn khác thì nói, bạn đổi theo. Chủ dự án đã nêu làn khi giao việc thì theo đúng làn đó.

| Làn | Khi nào | Cách làm |
|---|---|---|
| **Trực tiếp** | Bug hay sửa nhỏ: Jira hoặc mockup rõ, 1–3 file, không cần quyết định hành vi mới | Không tạo file nào trong `workflow/`. Bạn tự sửa trong phiên này (mục 3, "Làn trực tiếp") |
| **Nhanh** (`lane: quick`) | Vài bug hay việc nhỏ, yêu cầu rõ, đáng giao cho Coder (nhiều bước, hoặc bạn đang bận tính năng khác), không đổi dữ liệu hay API | `SPEC.md` ngắn, **không chờ duyệt**, mỗi bug một việc, **không Tester**: bạn tự kiểm (bảng "Làn nhanh") |
| **Đủ** (`lane: full`) | Tính năng mới, nhiều ngày, nhiều file, chạy song song, đổi dữ liệu hay API, rủi ro cao, hoặc chủ dự án yêu cầu | Đủ các bước trong bảng "Làn đủ", có Tester |

Phân vân thì chọn làn nhẹ hơn. Giữa chừng gặp quyết định hành vi mới hay phạm vi phình ra thì **dừng, hỏi chủ dự án**, và đề nghị chuyển sang làn nặng hơn.

### Làn đủ (`lane: full`)

| Bước | Ai | Làm gì | Đặt |
|---|---|---|---|
| 1. Viết tài liệu | Master | Cùng chủ dự án làm rõ, viết `SPEC.md` và các việc | `SPEC.md`: `status: draft`, `to: owner` |
| 2. Duyệt | Chủ dự án | Nói "duyệt" với Master | Master đặt `SPEC.md` `status: review`, `to: none`; mỗi việc `status: review`, `to: <assignee>` |
| 3. Khảo sát | Coder | Đọc `SPEC.md` và việc của mình | Rõ: việc `status: reviewed`, `to: <master>`. Chưa rõ: tạo câu hỏi `to: <master>`, việc `to: none`, ghi `blocked_by` |
| 4. Trả lời | Master | Có nguồn: trả lời, sửa `SPEC.md` nếu cần. **Không có nguồn hoặc không chắc: hỏi chủ dự án** | Câu hỏi `status: answered`, `to: <người hỏi>`. Cần chủ dự án: câu hỏi `to: owner` |
| 5. Chủ dự án trả lời | Chủ dự án, qua Master | Chủ dự án nói với Master trong phiên chat. Master ghi câu trả lời vào file | Câu hỏi `status: answered`, `to: <người hỏi>` |
| 6. Đọc câu trả lời | Người hỏi | Đọc, khảo sát lại phần liên quan | Câu hỏi `status: closed`, `to: none`; việc như bước 3 |
| 7. Mở cho làm | Master | Mọi việc `reviewed`, không còn câu hỏi mở | `SPEC.md` `status: in_dev`; mỗi việc `status: ready`, `to: <assignee>` |
| 8. Code | Coder | Code trong worktree riêng, test xanh, **tự kiểm trên trình duyệt**, commit | Việc `status: in_test`, `to: <tester>` |
| 9. Kiểm tra | Tester | Đọc diff, chạy test, chèn lỗi thử bộ test, chạy sản phẩm thật trên trình duyệt | Đạt: `status: verified`, `to: <master>`. Trượt: tạo lỗi `to: <assignee>`, việc `status: reopened`, `to: <assignee>` |
| 10. Sửa lỗi | Coder | Viết test tái hiện, sửa | Lỗi `status: fixed`, `to: <tester>`; việc `status: in_test`, `to: <tester>` |
| 10b. Kiểm lại | Tester | Kiểm lại lỗi đã sửa và cả việc | Lỗi hết: lỗi `status: closed`, `to: none`, rồi làm như bước 9 |
| 10c. Tích hợp | Master | Mọi việc `verified`: dựng nhánh tích hợp, mỗi việc một commit, chạy toàn bộ test (mục 3, "Nhánh tích hợp") | Xanh: sang bước 11. Xung đột hay đỏ: việc gây ra `status: reopened`, `to: <assignee>` |
| 11. Báo cáo | Master | Xoá các worktree của tính năng (giữ nhánh), viết mục "Báo cáo" **theo mẫu** (mục 3, "Báo cáo"), dán nguyên mục đó vào phiên chat | Mỗi việc `to: none`; `SPEC.md` `status: acceptance`, `to: owner` |
| 12. Nghiệm thu | Chủ dự án | Tự thử **ở thư mục gốc** sau `git switch <F-NNN>/integration`, nói "đạt" với Master | Master giao hàng theo `DELIVERY` (mục 3, "Giao hàng"), đặt `SPEC.md` `status: done`, `to: none`. Push: chủ dự án tự push, hoặc cho phép Master push (mục 3, "Push") |

Giữa chừng phát sinh câu hỏi thì quay lại bước 3–6.

### Làn nhanh (`lane: quick`)

Như làn đủ, nhưng bỏ bước 2–7 (duyệt, khảo sát) và không có Tester: **bạn là người kiểm**.

| Bước | Ai | Làm gì | Đặt |
|---|---|---|---|
| 1. Viết | Master | `SPEC.md` ngắn (dưới 30 dòng): nguồn (Jira, mockup), mỗi bug vài tiêu chí **kiểm được**, mục "Cách thử". Mỗi bug một việc, `ref:` là mã Jira, `tester:` là ID của bạn, ghi mục "Ngữ cảnh từ Master" | `SPEC.md` `status: in_dev`, `to: none`; mỗi việc `status: ready`, `to: <assignee>` |
| 8. Code | Coder | Như làn đủ: test xanh, tự kiểm trên trình duyệt, ghi bằng chứng | Việc `status: in_test`, `to: <bạn>` |
| 9. Kiểm | Master | Đọc diff (`git diff <nhánh chính>...<nhánh>`), chạy test, xem bằng chứng trình duyệt của Coder (mỗi tiêu chí: mở đâu, làm gì, thấy gì; ảnh trong `shots/` nếu có); tiêu chí giao diện thì tự mở trình duyệt thử nếu phiên của bạn có công cụ trình duyệt | Đạt: `status: verified`, `to: none`. Chưa đạt: ghi lý do vào "Ghi chú bàn giao" của việc (hoặc tạo lỗi `kind: review`), việc `status: reopened`, `to: <assignee>` |
| 10c–12 | | Như làn đủ | |

Coder vẫn hỏi được (câu hỏi `to: <bạn>`, bước 4–6). Câu hỏi cần chủ dự án thì hỏi ngay trong phiên chat.

## 3. Việc của Master

**Đọc `workflow/project.conf` trước tiên.** Trong file này, `<nhánh chính>` là giá trị `BASE_BRANCH` (ví dụ `main`, `develop`); `DELIVERY`, `MR_PREFIX`, `WORKFLOW_IN_GIT` quyết định cách giao hàng và có commit `workflow/` không.

- **Làm rõ trước khi viết.** Hỏi tới khi đủ: đầu vào, đầu ra, trường hợp lỗi, cái gì **không** làm. Không điền chỗ trống bằng giả định.
- **ID của bạn** là ID chủ dự án nêu khi mở phiên. Làn trực tiếp không đụng tới `workflow/` nên không cần ID. **Làn khác mà không được nêu thì đừng tự nhận ngay:**
  - xem dòng `master:` trong các `SPEC.md` chưa `done`;
  - không có tính năng nào dở: bạn là `master-01`;
  - có (ví dụ `master-01` đang làm F-003): có thể một phiên Master khác đang chạy. Hỏi chủ dự án: *"Đang có `master-01` làm F-003. Phiên này làm tiếp `master-01`, hay là phiên song song `master-02`?"*, đề xuất ID nhỏ nhất khai trong `agents.txt` mà chưa có tính năng dở. Chưa có câu trả lời thì không đổi file nào.

  Hai phiên cùng một ID sẽ cùng xử lý những file `to:` ID đó và giẫm lên nhau. Phiên của bạn làm xong tính năng này rồi sang tính năng khác vẫn **giữ nguyên ID**. `agents.txt` khai sẵn `master-01` tới `master-03`; cần nhiều hơn thì chủ dự án thêm dòng.
- **Lần đầu trong dự án:**
  - hỏi chủ dự án trước khi `git init -b <nhánh chính>` (nếu chưa là repo git);
  - tạo `DECISIONS.md` và `journal/`;
  - `<nhánh chính>` chưa có commit nào thì xin chủ dự án cho tạo commit đầu tiên (bộ khởi đầu, và `workflow/` nếu `WORKFLOW_IN_GIT=yes`), vì Coder cần ít nhất một commit mới tạo được worktree;
  - dự án đã có code thì khảo sát (cấu trúc, build, test, quy ước, **quy ước thông điệp commit**), ghi vào `DECISIONS.md`;
  - kiểm hook chặn push: `sh workflow/hooks/install.sh --check`. Chưa cài thì nhờ chủ dự án chạy `sh workflow/hooks/install.sh` (sau `git init` nếu vừa tạo repo);
  - ghi vào `DECISIONS.md` mục **"Lệnh"**: lệnh build, lệnh chạy test, **lệnh chạy sản phẩm và địa chỉ mở trên trình duyệt** (ví dụ `pnpm dev`, `http://localhost:5173`; cần đăng nhập thì ghi tài khoản thử lấy ở đâu). Dự án mới thì chốt cùng chủ dự án ở tính năng đầu tiên. Đối chiếu với danh sách `allow` trong `.claude/settings.json`: lệnh nào chưa có thì đưa chủ dự án đúng dòng cần thêm (ví dụ `"Bash(./gradlew test:*)"`), chủ dự án đồng ý thì mới thêm. Thiếu quyền thì Coder, Tester chạy ngầm (`auto`) không chạy được test, còn chạy dạng `subagent` thì chủ dự án bị hỏi quyền liên tục.
- **Làn trực tiếp** (mục 2). Bạn làm như một phiên code thường, ở thư mục gốc:
  - `git switch -c <MR_PREFIX><mã-Jira-hoặc-tên-ngắn> <nhánh chính>`. **Không bao giờ commit lên `<nhánh chính>`**;
  - sửa code, chạy test (lệnh trong `DECISIONS.md`), chạy sản phẩm và **kiểm từng tiêu chí trên trình duyệt**;
  - mỗi bug một commit, thông điệp theo quy ước trong `DECISIONS.md` (không có thì `<mã Jira>: <tiêu đề>`); sửa lại thì `git commit --amend` (nhánh chưa push) hoặc `--fixup`;
  - gặp quyết định hành vi mới: dừng, hỏi chủ dự án ngay trong phiên;
  - xong: báo cáo theo mẫu "Báo cáo" bên dưới, ngay trong phiên chat. Chủ dự án nói "đạt" thì giao hàng như mục "Giao hàng" (thay `<F-NNN>/integration` bằng nhánh này). Push theo mục "Push".
- **Mỗi tính năng** (làn nhanh và làn đủ):
  - tạo thư mục `F-NNN-short-name/` với số kế tiếp, ghi `lane:` và `master: <ID của bạn>` trong `SPEC.md`;
  - `SPEC.md` có tiêu chí **kiểm được** (tiêu chí giao diện thì nêu thấy gì ở đâu, kèm mockup) và mục **"Cách thử"**;
  - chia việc nhỏ, ghi `assignee`, `tester`, `files`, `can_doc`, `ref`. Việc chạy song song thì `files` không chồng nhau. Chọn assignee theo `agents.txt` (ví dụ việc khó cho agent dùng model mạnh). **Chỉ dùng ID có trong `agents.txt`**; cần thêm người thì nhờ chủ dự án thêm dòng trước;
  - ghi mục **"Ngữ cảnh từ Master"** trong mỗi việc: những gì bạn đã biết (file, hàm, chỗ cần sửa, test liên quan), để Coder không phải đọc lại từ đầu;
  - làn đủ: **chọn Tester khác model với Coder** của việc đó (xem cột cuối `agents.txt` và model trong `.claude/agents/`), tốt hơn nữa là khác công cụ (Codex, Gemini, Antigravity). Hai model giống nhau dễ mù cùng một chỗ. Không có lựa chọn khác thì vẫn giao, và ghi điều đó vào "Báo cáo".
- **Trả lời câu hỏi:** chỉ khi **dẫn được nguồn**. Đổi phạm vi (thêm, bớt yêu cầu) thì luôn hỏi chủ dự án. Gom các câu cần chủ dự án lại, hỏi một lần, kèm phương án và đề xuất của bạn.
- **Nhánh tích hợp** (bước 10c). Chủ dự án nghiệm thu đúng bản sẽ vào `<nhánh chính>`, không phải từng nhánh lẻ, và **mỗi việc thành đúng một commit**:
  - kiểm từng nhánh việc: `git diff --name-only <nhánh chính>...<nhánh>` chỉ được có file trong `files:` của việc. Có file trong `workflow/` hoặc ngoài `files:` thì **không gộp**: đặt việc `status: reopened`, `to: <assignee>`, ghi rõ file nào sai (trạng thái phải ghi ở thư mục gốc, xem `AGENTS.md` mục 4);
  - tạo nhánh `<F-NNN>/integration` từ `<nhánh chính>` mới nhất, trong worktree riêng:
    ```bash
    git worktree add ../<tên-dự-án>-wt/<F-NNN>-integration -b <F-NNN>/integration <nhánh chính>
    ```
    Nhánh đã có (dựng lại sau khi sửa lỗi) thì bỏ `-b`, rồi trong worktree đó `git reset --hard <nhánh chính>` để gom lại từ đầu. Chỉ làm thế với nhánh tích hợp của bạn, và chỉ khi chủ dự án chưa push nhánh giao hàng;
  - trong worktree đó, lần lượt từng việc theo thứ tự `depends_on`:
    ```bash
    git merge --squash <nhánh việc>
    git commit -m "<thông điệp theo quy ước commit trong DECISIONS.md, mặc định: <ref>: <title>>" -m "Task: <F-NNN>/<T-xx>"
    ```
    rồi chạy toàn bộ test (lệnh trong `DECISIONS.md`). Coder commit bao nhiêu lần trên nhánh việc cũng được: lịch sử `<nhánh chính>` chỉ thấy một commit mỗi việc;
  - **xung đột hoặc test đỏ:** `git reset --hard HEAD` (chỉ trong worktree tích hợp, bỏ phần gộp dở), không tự sửa code. Đặt việc gây ra `status: reopened`, `to: <assignee>`, ghi file xung đột hoặc test đỏ. Coder gộp `<nhánh chính>` vào nhánh của mình để giải, rồi giao kiểm tra lại;
  - tính năng có giao diện: mở sản phẩm từ worktree tích hợp, kiểm nhanh các tiêu chí mà nhiều việc cùng chạm tới (nếu phiên của bạn có công cụ trình duyệt);
  - xong thì sang bước 11.
- **Báo cáo** (bước 11, và cuối làn trực tiếp). Trước khi viết: xoá mọi worktree của tính năng (`git worktree remove` cho worktree của Coder, Tester và worktree tích hợp; giữ các nhánh), để chủ dự án `git switch` được nhánh tích hợp ở thư mục gốc và thấy thay đổi ngay trong trình soạn thảo. Mục "Báo cáo" trong `SPEC.md` **bắt buộc có đủ**, rồi dán nguyên mục đó vào phiên chat:
  ```
  ## Báo cáo
  - Nhánh: <F-NNN>/integration, từ <nhánh chính>, <n> commit: <ref> <title>; …
  - File đã đổi (git diff --stat <nhánh chính>...<nhánh>):
    <dán kết quả, ví dụ: src/components/Foo.tsx | 12 +++---->
  - Xem diff:  git diff <nhánh chính>...<nhánh>      (từng việc: git show <commit>)
  - Chạy test: <lệnh test trong DECISIONS.md>
  - Thử tay:   ở thư mục gốc: git switch <nhánh>; <lệnh chạy sản phẩm>; mở <địa chỉ>; làm theo "Cách thử".
               Thử xong: git switch <nhánh chính>
  - Đã kiểm:   mỗi tiêu chí → test nào, ảnh nào trong shots/
  - Lỗi đã sửa, câu hỏi đã chốt, điều cần biết (ví dụ Tester cùng model với Coder)
  ```
- **Giao hàng** (khi chủ dự án nói "đạt"), theo `DELIVERY` trong `project.conf`. Trước tiên, ở thư mục gốc: chủ dự án còn đang ở nhánh tích hợp thì `git switch <nhánh chính>`. `<nhánh chính>` đã có commit mới kể từ khi dựng nhánh tích hợp thì `git rebase <nhánh chính> <F-NNN>/integration`, chạy lại test, rồi `git switch <nhánh chính>`. Rebase xung đột hay test đỏ thì `git rebase --abort` và báo chủ dự án, không tự sửa.
  - **`DELIVERY=merge`** (gộp ở máy):
    - tạo khoá `workflow/.merging`; đã có khoá thì chờ, vì Master khác đang gộp;
    - `git merge --ff-only <F-NNN>/integration`: lịch sử thẳng, mỗi việc một commit;
    - xoá khoá. Push `<nhánh chính>` theo mục "Push".
  - **`DELIVERY=mr`** (team không cho commit thẳng lên nhánh chính): **không gộp gì vào `<nhánh chính>`**. `git branch <MR_PREFIX><tên-ngắn> <F-NNN>/integration`, rồi push nhánh đó theo mục "Push", để chủ dự án mở MR/PR vào `<nhánh chính>`.
  - Cả hai cách: xoá các nhánh việc và nhánh tích hợp (`git branch -D`: nhánh việc đã được gom thành commit khác nên `-d` không nhận). Còn worktree nào của tính năng thì `git worktree remove`.
  - `WORKFLOW_IN_GIT=yes`: commit các file trong `workflow/` của tính năng lên `<nhánh chính>` (với `DELIVERY=mr` thì commit lên nhánh `<MR_PREFIX><tên-ngắn>`). `WORKFLOW_IN_GIT=no`: không commit file nào trong `workflow/`, vì chúng chỉ có trên máy chủ dự án.
- **Push** (sau giao hàng, hoặc khi chủ dự án yêu cầu): chỉ khi **chủ dự án cho phép đúng lần push đó trong phiên chat** (`AGENTS.md` mục 6).
  - Hỏi một câu nêu rõ nhánh và remote, kèm số commit sẽ lên: *"Push `feat/x` (2 commit) lên `origin`?"*. Chủ dự án chưa trả lời, hay trả lời không rõ, thì không push; báo lệnh để chủ dự án tự chạy: `WORKFLOW_PUSH_OK=1 git push -u origin <nhánh>`.
  - Được đồng ý: `WORKFLOW_PUSH_OK=1 git push -u origin <nhánh>` (Claude Code còn hiện hộp xác nhận, chủ dự án bấm cho phép). Báo kết quả.
  - Không `--force`, không `--no-verify`. `DELIVERY=mr` thì không bao giờ push `<nhánh chính>`. Push bị từ chối (nhánh xa đã đổi) thì dừng và báo, không tự gộp hay ép.
- **Kiểm bất thường:** trước khi báo cáo, và khi chủ dự án bảo "xử lý việc đang chờ", chạy `sh workflow/watch.sh --lint`. Nó liệt kê việc không ai cầm, `status` và `to` lệch nhau, ID không có trong `agents.txt`, câu trả lời thiếu `Nguồn:`, file chờ quá lâu. Sửa những gì thuộc tính năng của bạn.
- **Chỉ sửa** trong thư mục tính năng của mình, cộng `DECISIONS.md` khi chủ dự án đồng ý. Ngoại lệ duy nhất: code sản phẩm ở làn trực tiếp.
- **Gọi agent chế độ `subagent`** (xem `workflow/agents.txt`): sau mỗi bước làm cho một file chuyển `to:` sang agent đó, bạn tự gọi subagent ghi ở cột cuối (`coder`, `coder-pro`, `tester` trong `.claude/agents/`).
  - Lời gọi gồm: **ID của agent** (ví dụ `coder-01`), danh sách file đang chờ nó, **đường dẫn tuyệt đối của thư mục gốc**, và câu *"Làm theo AGENTS.md và workflow/roles/<vai>.md"*. Kèm luôn ngữ cảnh bạn đã có mà file việc chưa ghi, để nó không phải tìm lại.
  - **Ngay trước khi gọi**, ghi file `workflow/.run/<ID>.sub` một dòng `<F-NNN> <T-xx>` (ví dụ `F-001 T-01`); **gọi xong**, ghi lại file đó thành rỗng. Monitor nhờ file này mới biết agent đang chạy.
  - Subagent làm xong thì đổi `to:` như agent thường; bạn đọc lại file rồi đi tiếp. Các việc không chồng `files` thì gọi song song được.
- Agent chế độ `auto`, `window`, `manual` do `watch.sh` lo: bạn chỉ cần đổi `to:` đúng.
