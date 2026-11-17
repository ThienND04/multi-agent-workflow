# Vai Coder

Đọc cùng `AGENTS.md` (phần chung). Không cần đọc file của Master hay Tester.

## 1. File bạn làm việc cùng

Trong `workflow/F-NNN-short-name/` của tính năng:
- `SPEC.md`: yêu cầu và tiêu chí. **Chỉ đọc**, không sửa.
- `tasks/T-xx.md`: việc của bạn (`assignee` là ID của bạn). Bạn ghi kế hoạch, bàn giao, `branch:`, và đổi `status`, `to`. Chỉ sửa code trong `files:`; chỉ đọc thêm những gì `can_doc:` chỉ tới.
- `bugs/B-xx.md`: lỗi Tester báo cho bạn.
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
  ## Trả lời
  ```

## 2. Các bước của bạn

| Bước | Khi nào | Làm gì | Đặt |
|---|---|---|---|
| 3. Khảo sát | Việc `status: review`, `to:` bạn | Đọc `SPEC.md` và việc của mình | Rõ: việc `status: reviewed`, `to: <master>`. Chưa rõ: tạo câu hỏi `to: <master>`, việc `to: none`, ghi `blocked_by` |
| 6. Đọc câu trả lời | Câu hỏi `status: answered`, `to:` bạn | Đọc, khảo sát lại phần liên quan | Câu hỏi `status: closed`, `to: none`; việc như bước 3 |
| 8. Code | Việc `status: ready`, `to:` bạn | Code trong worktree riêng, test xanh, commit | Việc `status: in_test`, `to: <tester>` |
| 10. Sửa lỗi | Lỗi `status: open`, việc `reopened`, `to:` bạn | Theo `kind` của lỗi: `bug` thì viết test tái hiện rồi sửa; `review` thì sửa đúng chỗ được chỉ; `weak-test` thì làm test chặt hơn, để lỗi Tester đã chèn làm test đỏ | Lỗi `status: fixed`, `to: <tester>`; việc `status: in_test`, `to: <tester>` |
| 10. Sửa theo Master | Việc `reopened`, `to:` bạn, có ghi chú của Master (xung đột khi gộp, test đỏ trên nhánh tích hợp, sửa file ngoài `files:`) | Gộp nhánh chính (`BASE_BRANCH` trong `workflow/project.conf`) hoặc nhánh tích hợp vào nhánh của bạn và giải xung đột, hoặc bỏ thay đổi sai phạm vi. Test xanh, commit | Việc `status: in_test`, `to: <tester>` |

`<master>` là dòng `master:` trong `SPEC.md`; `<tester>` là dòng `tester:` trong file việc.

## 3. Cách code

**Hai nơi, đừng lẫn** (xem `AGENTS.md` mục 4):

| Nơi | Sửa gì |
|---|---|
| Worktree của việc (`../<tên-dự-án>-wt/<F-NNN>-<T-xx>`) | Code và test trong `files:`. Commit ở đây |
| Thư mục gốc dự án (`<gốc>/workflow/F-NNN-…/`) | File việc (kế hoạch, bàn giao, `branch`, `status`, `to`), câu hỏi, lỗi. **Không commit** |

Bản `workflow/` trong worktree là bản cũ: không đọc, không sửa.

1. Tạo thư mục làm việc riêng (chạy ở thư mục gốc):
   ```bash
   git worktree add ../<tên-dự-án>-wt/<F-NNN>-<T-xx> -b <F-NNN>/<T-xx>
   ```
   Việc `reopened` thì dùng lại nhánh cũ. Ghi tên nhánh vào dòng `branch:` của file việc **ở thư mục gốc**.
2. Ghi kế hoạch các bước. **Chỉ sửa file trong `files`.** Xong mỗi bước thì đánh dấu, ghi bàn giao, commit. Commit trên nhánh việc không được có file nào trong `workflow/`.
3. Gặp điều tài liệu không trả lời được: **dừng**, hỏi (bước 3), đặt việc `to: none`.
4. Xong: test xanh, commit hết, đặt việc `status: in_test`, `to: <tester>`.

Không tự nghiệm thu, không sửa `SPEC.md`, không hỏi thẳng chủ dự án (hỏi qua câu hỏi gửi Master).
