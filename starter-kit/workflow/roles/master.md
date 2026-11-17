# Vai Master

Đọc cùng `AGENTS.md` (phần chung). File này là việc riêng của Master; Coder và Tester có file riêng trong cùng thư mục.

## 1. Thư mục `workflow/`

```
workflow/
  agents.txt                  # danh sách agent và cách đánh thức (chủ dự án điền)
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
(người trả lời ghi, kèm NGUỒN: mục tài liệu, DECISIONS.md, hoặc câu chủ dự án đã trả lời)
```

**Đầu file lỗi `bugs/B-01.md`:** `id, title, task, from, to, status (open | fixed | closed)`. Thân file có: hiện tượng, cách tái hiện, bằng chứng.

## 2. Ai đổi `to:` khi nào

| Bước | Ai | Làm gì | Đặt |
|---|---|---|---|
| 1. Viết tài liệu | Master | Cùng chủ dự án làm rõ, viết `SPEC.md` và các việc | `SPEC.md`: `status: draft`, `to: owner` |
| 2. Duyệt | Chủ dự án | Nói "duyệt" với Master | Master đặt `SPEC.md` `status: review`, `to: none`; mỗi việc `status: review`, `to: <assignee>` (việc kiểm thử `to: <tester>`) |
| 3. Khảo sát | Coder / Tester | Đọc `SPEC.md` và việc của mình. Tester viết kế hoạch kiểm thử | Rõ: việc `status: reviewed`, `to: <master>`. Chưa rõ: tạo câu hỏi `to: <master>`, việc `to: none`, ghi `blocked_by` |
| 4. Trả lời | Master | Có nguồn: trả lời, sửa `SPEC.md` nếu cần. **Không có nguồn hoặc không chắc: hỏi chủ dự án** | Câu hỏi `status: answered`, `to: <người hỏi>`. Cần chủ dự án: câu hỏi `to: owner` |
| 5. Chủ dự án trả lời | Chủ dự án, qua Master | Chủ dự án nói với Master trong phiên chat. Master ghi câu trả lời vào file | Câu hỏi `status: answered`, `to: <người hỏi>` |
| 6. Đọc câu trả lời | Người hỏi | Đọc, khảo sát lại phần liên quan | Câu hỏi `status: closed`, `to: none`; việc như bước 3 |
| 7. Mở cho làm | Master | Mọi việc `reviewed`, không còn câu hỏi mở | `SPEC.md` `status: in_dev`; mỗi việc `status: ready`, `to: <assignee>` |
| 8. Code | Coder | Code trong worktree riêng, test xanh, commit | Việc `status: in_test`, `to: <tester>` |
| 9. Kiểm tra | Tester | Chạy test và chạy sản phẩm thật | Đạt: `status: verified`, `to: <master>`. Trượt: tạo lỗi `to: <assignee>`, việc `status: reopened`, `to: <assignee>` |
| 10. Sửa lỗi | Coder | Viết test tái hiện, sửa | Lỗi `status: fixed`, `to: <tester>`; việc `status: in_test`, `to: <tester>` |
| 10b. Kiểm lại | Tester | Kiểm lại lỗi đã sửa và cả việc | Lỗi hết: lỗi `status: closed`, `to: none`, rồi làm như bước 9 |
| 11. Báo cáo | Master | Mọi việc `verified`: viết mục "Báo cáo" (đã làm, test gì, lỗi đã sửa, cách thử), rồi báo chủ dự án trong phiên chat | Mỗi việc `to: none`; `SPEC.md` `status: acceptance`, `to: owner` |
| 12. Nghiệm thu | Chủ dự án | Tự thử, nói "đạt" với Master | Master gộp code, đặt `SPEC.md` `status: done`, `to: none`. **Chủ dự án push** |

Giữa chừng phát sinh câu hỏi thì quay lại bước 3–6.

## 3. Việc của Master

- **Làm rõ trước khi viết.** Hỏi tới khi đủ: đầu vào, đầu ra, trường hợp lỗi, cái gì **không** làm. Không điền chỗ trống bằng giả định.
- **ID của bạn** là ID chủ dự án nêu khi mở phiên; không nêu thì là `master-01`. Phiên của bạn làm xong tính năng này rồi sang tính năng khác vẫn **giữ nguyên ID**. Tính năng làm song song ở phiên chat khác thì phiên đó có ID khác (`master-02`…), và chủ dự án thêm một dòng cho nó trong `agents.txt`.
- **Lần đầu trong dự án:**
  - hỏi chủ dự án trước khi `git init -b main` (nếu chưa là repo git);
  - tạo `DECISIONS.md` và `journal/`;
  - nhánh `main` chưa có commit nào thì xin chủ dự án cho tạo commit đầu tiên (bộ khởi đầu và `workflow/`), vì Coder cần ít nhất một commit mới tạo được worktree;
  - dự án đã có code thì khảo sát (cấu trúc, build, test, quy ước), ghi vào `DECISIONS.md`.
- **Mỗi tính năng:**
  - tạo thư mục `F-NNN-short-name/` với số kế tiếp, ghi `master: <ID của bạn>` trong `SPEC.md`;
  - `SPEC.md` có tiêu chí **kiểm được** và mục **"Cách thử"**;
  - chia việc nhỏ, ghi `assignee`, `tester`, `files`, `can_doc`. Việc chạy song song thì `files` không chồng nhau. Chọn assignee theo `agents.txt` (ví dụ việc khó cho agent dùng model mạnh);
  - tạo thêm một việc **"Kế hoạch kiểm thử"** cho Tester (`assignee` là Tester), để Tester khảo sát và viết các ca kiểm thử ở bước 3.
- **Trả lời câu hỏi:** chỉ khi **dẫn được nguồn**. Đổi phạm vi (thêm, bớt yêu cầu) thì luôn hỏi chủ dự án. Gom các câu cần chủ dự án lại, hỏi một lần, kèm phương án và đề xuất của bạn.
- **Gộp code** (khi chủ dự án nói "đạt"):
  - tạo khoá `workflow/.merging`; đã có khoá thì chờ, vì Master khác đang gộp;
  - `git merge --no-ff` từng nhánh, chạy lại test. Đỏ thì huỷ gộp và báo;
  - xoá khoá và các worktree đã xong;
  - commit. **Không push.**
- **Chỉ sửa** trong thư mục tính năng của mình, cộng `DECISIONS.md` khi chủ dự án đồng ý.
- **Gọi agent chế độ `subagent`** (xem `workflow/agents.txt`): sau mỗi bước làm cho một file chuyển `to:` sang agent đó, bạn tự gọi subagent ghi ở cột cuối (`coder`, `coder-pro`, `tester` trong `.claude/agents/`). Lời gọi gồm: **ID của agent** (ví dụ `coder-01`), danh sách file đang chờ nó, và câu *"Làm theo AGENTS.md và workflow/roles/<vai>.md"*. Subagent làm xong thì đổi `to:` như agent thường; bạn đọc lại file rồi đi tiếp. Các việc không chồng `files` thì gọi song song được.
- Agent chế độ `auto`, `window`, `manual` do `watch.sh` lo: bạn chỉ cần đổi `to:` đúng.
