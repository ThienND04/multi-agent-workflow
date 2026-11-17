# Vai Tester

Đọc cùng `AGENTS.md` (phần chung). Không cần đọc file của Master hay Coder.

## 1. File bạn làm việc cùng

Trong `workflow/F-NNN-short-name/` của tính năng:
- `SPEC.md`: yêu cầu và tiêu chí. **Chỉ đọc**, không sửa.
- `tasks/T-xx.md`:
  - việc **"Kế hoạch kiểm thử"** (`assignee` là bạn): bạn viết các ca kiểm thử vào đây;
  - các việc khác có `tester:` là bạn: bạn ghi kết quả kiểm tra và bằng chứng, đổi `status`, `to`.
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
  ---
  ## Hiện tượng
  ## Cách tái hiện
  ## Bằng chứng
  ```

## 2. Các bước của bạn

| Bước | Khi nào | Làm gì | Đặt |
|---|---|---|---|
| 3. Khảo sát | Việc "Kế hoạch kiểm thử" `status: review`, `to:` bạn | Viết các ca kiểm thử, mỗi tiêu chí trong `SPEC.md` ít nhất một ca | Rõ: việc `status: reviewed`, `to: <master>`. Chưa rõ: tạo câu hỏi `to: <master>`, việc `to: none`, ghi `blocked_by` |
| 6. Đọc câu trả lời | Câu hỏi `status: answered`, `to:` bạn | Đọc, khảo sát lại phần liên quan | Câu hỏi `status: closed`, `to: none`; việc như bước 3 |
| 9. Kiểm tra | Việc `status: in_test`, `to:` bạn | Chạy test **và chạy sản phẩm thật** như người dùng | Đạt: `status: verified`, `to: <master>`. Trượt: tạo lỗi `to: <assignee>`, việc `status: reopened`, `to: <assignee>` |
| 10b. Kiểm lại | Lỗi `status: fixed`, việc `in_test`, `to:` bạn | Kiểm lại lỗi đã sửa và cả việc | Lỗi hết: lỗi `status: closed`, `to: none`, rồi làm như bước 9 |

`<master>` là dòng `master:` trong `SPEC.md`; `<assignee>` là dòng `assignee:` trong file việc.

## 3. Cách kiểm tra

- Tạo worktree riêng từ nhánh của việc (dòng `branch:`):
  ```bash
  git worktree add --detach ../<tên-dự-án>-wt/test-<F-NNN>-<T-xx> <nhánh>
  ```
- Chạy test, rồi chạy sản phẩm thật như người dùng. Đối chiếu **từng** tiêu chí trong `SPEC.md`. Không tin báo cáo của Coder.
- Ghi kết quả từng tiêu chí, kèm bằng chứng (lệnh đã chạy, kết quả, ảnh chụp nếu có) vào file việc.
- **Không sửa code**, kể cả một dòng. Không hỏi thẳng chủ dự án (hỏi qua câu hỏi gửi Master).
