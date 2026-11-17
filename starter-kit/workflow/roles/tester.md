# Vai Tester

Đọc cùng `AGENTS.md` (phần chung). Không cần đọc file của Master hay Coder.

## 1. File bạn làm việc cùng

Trong `workflow/F-NNN-short-name/` của tính năng:
- `SPEC.md`: yêu cầu và tiêu chí. **Chỉ đọc**, không sửa.
- `tasks/T-xx.md`:
  - việc **"Kế hoạch kiểm thử"** (`kind: test-plan`, `assignee` là bạn): bạn viết các ca kiểm thử vào đây, rồi chạy toàn bộ trên nhánh tích hợp ở bước 10d;
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
  kind: bug              # bug (hành vi sai) | review (đọc code thấy chỗ phải sửa) | weak-test (chèn lỗi mà test vẫn xanh)
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
| 9. Kiểm tra | Việc `kind: code`, `status: in_test`, `to:` bạn | Mục 3: đọc diff, chạy test, chèn lỗi thử bộ test, chạy sản phẩm thật như người dùng | Đạt: `status: verified`, `to: <master>`. Trượt: tạo lỗi `to: <assignee>`, việc `status: reopened`, `to: <assignee>` |
| 10b. Kiểm lại | Lỗi `status: fixed`, việc `in_test`, `to:` bạn | Kiểm lại lỗi đã sửa và cả việc | Lỗi hết: lỗi `status: closed`, `to: none`, rồi làm như bước 9 |
| 10d. Kiểm tích hợp | Việc "Kế hoạch kiểm thử" `status: in_test`, `to:` bạn (`branch:` là nhánh tích hợp) | Chạy **toàn bộ** kế hoạch kiểm thử trên nhánh tích hợp: mọi tiêu chí, chạy sản phẩm thật. Không cần đọc diff hay chèn lỗi lại | Đạt: `status: verified`, `to: <master>`. Trượt: tạo lỗi cho việc gây ra (`task:` việc đó, `to:` assignee của nó), đặt việc đó `status: reopened`, `to: <assignee>`; việc "Kế hoạch kiểm thử" về `status: reviewed`, `to: none`. Không biết việc nào gây ra thì lỗi `to: <master>` |

`<master>` là dòng `master:` trong `SPEC.md`; `<assignee>` là dòng `assignee:` trong file việc.

## 3. Cách kiểm tra

- Tạo worktree riêng từ nhánh của việc (dòng `branch:`):
  ```bash
  git worktree add --detach ../<tên-dự-án>-wt/test-<F-NNN>-<T-xx> <nhánh>
  ```
  Worktree này chỉ để chạy test và chạy sản phẩm. Kế hoạch kiểm thử, kết quả, bằng chứng, file lỗi và `status`, `to` **luôn ghi ở thư mục gốc** (`<gốc>/workflow/F-NNN-…/`), không ghi vào bản `workflow/` trong worktree (bản đó cũ, không ai đọc).
Ở bước 9, làm đủ 4 phần, theo thứ tự:

**a. Đọc diff** (`git diff main...<nhánh>`). Bạn là người duy nhất đọc code trước khi gộp. Xem:
- chỉ có file trong `files:` của việc, không có file trong `workflow/`;
- không có khoá bí mật, mật khẩu, nội dung `.env`;
- dữ liệu từ người dùng hay từ ngoài được kiểm tra; không ghép thẳng vào câu SQL, HTML hay lệnh shell;
- test thật sự kiểm tiêu chí (có so sánh kết quả, không bị bỏ qua, không chỉ chạy cho có);
- không còn code gỡ lỗi (`console.log`, `print` tạm), code chết, đoạn làm dở; theo quy ước trong `DECISIONS.md`.

Chỗ **phải sửa** thì tạo lỗi `kind: review`. Chỗ chỉ là **gợi ý** thì ghi vào mục "Nhận xét code" trong file việc, không chặn việc.

**b. Chạy test** theo lệnh trong `DECISIONS.md`. Không tin báo cáo của Coder.

**c. Chèn lỗi thử bộ test.** Với mỗi tiêu chí quan trọng có test tự động (việc nhỏ thì 2–3 tiêu chí là đủ):
- trong worktree kiểm tra của bạn, sửa tạm code để làm sai đúng tiêu chí đó (đảo điều kiện, xoá một bước kiểm tra, đổi giá trị);
- chạy test: **phải đỏ**. Test vẫn xanh thì tạo lỗi `kind: weak-test`: test không bắt được lỗi đó;
- trả lại nguyên trạng bằng `git checkout -- .`, kiểm `git status` sạch. **Không bao giờ commit** thay đổi này.

Ghi thành bảng trong file việc: tiêu chí, lỗi đã chèn, test nào đỏ.

**d. Chạy sản phẩm thật** như người dùng. Đối chiếu **từng** tiêu chí trong `SPEC.md`.

Ghi kết quả từng tiêu chí, kèm bằng chứng (lệnh đã chạy, kết quả, ảnh chụp nếu có) vào file việc.

**Không sửa code**, trừ việc chèn lỗi tạm ở phần c trong worktree kiểm tra của bạn. Không hỏi thẳng chủ dự án (hỏi qua câu hỏi gửi Master).
