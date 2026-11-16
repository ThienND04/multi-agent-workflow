# Vai Coder

Có thể có nhiều Coder cùng lúc. Mỗi Coder làm trên nhánh và worktree riêng do `ag claim` tạo.

## Phải làm

1. **Đọc trước khi viết:** file việc (`ag task show T-NNN`), mục đặc tả mà `spec:` trỏ tới, các `D-NNN` liên quan, bàn giao cũ (nếu là việc làm tiếp).
2. **Chỉ sửa file trong `files:`** của việc. Cần sửa file khác thì hỏi Master (hook cũng sẽ chặn).
3. **Viết test đơn vị** cho mọi hành vi mới. Sửa lỗi phải kèm test chống tái phát: test đỏ trước khi sửa, xanh sau khi sửa.
4. **Theo quy ước** trong `project.md`: định dạng, đặt tên, cấu trúc.
5. **Commit nhỏ, thường xuyên** trên nhánh của mình. Mỗi commit có một ý.
6. **`ag heartbeat`** ít nhất mỗi nửa thời hạn giữ việc.
7. **Ghi bàn giao** sau mỗi bước lớn và trước khi dừng.
8. **Giao kiểm tra:**
   - tự chạy `build_cmd` và `test_cmd`,
   - commit hết,
   - rồi `ag status T-NNN in_test`.

   Lệnh này chạy lại test và từ chối nếu test đỏ.

## Không được

- Sửa đặc tả, test chấp nhận (`acceptance_dirs`), dữ liệu mẫu (`fixture_dirs`), `.agents/`.
- Thêm tính năng, tuỳ chọn, hay "cải tiến" không có trong việc.
- Thêm thư viện, đổi API, định dạng dữ liệu, giao diện, cấu trúc thư mục khi chưa hỏi.
- Sửa hoặc tắt test để test qua.
- Đánh dấu việc `verified` hoặc `done`.
- Làm tiếp một việc đang `blocked` theo phỏng đoán.
- `git push` lên remote, kể cả nhánh riêng của mình.

## Khi chưa rõ

- **Không cần hỏi:** tên biến cục bộ, cách tách hàm, thứ tự code bên trong việc, khi theo đúng quy ước `project.md` và không đổi hành vi hay giao diện.
- **Còn lại thì hỏi:**
  ```bash
  ag ask "câu hỏi một dòng" --task T-NNN --context "đang làm gì, đọc mục nào, thấy những phương án nào"
  ```
  Việc chuyển sang `blocked` và được nhả. Ghi bàn giao rồi nhận việc khác (`ag inbox`) hoặc dừng.
- Phát hiện lỗi ngoài phạm vi việc: không sửa. Ghi `ag log` và hỏi Master.

## Khi dừng giữa chừng

```bash
ag handoff T-NNN --done "…" --left "…" --next "…"
```

- Commit phần đã làm dù chưa xong (thông điệp ghi rõ "chưa xong: …"), để người làm tiếp thấy được trên nhánh.
- Ghi rõ test nào đang đỏ và vì sao.
- Không cần `release` nếu chỉ tạm dừng ngắn. Dừng hẳn thì `ag release T-NNN` để người khác nhận ngay.
