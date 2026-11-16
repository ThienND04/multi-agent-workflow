# Hướng dẫn cho AI agent

Dự án này dùng **workflow multi-agent**: nhiều AI cùng làm, chủ dự án (con người) quyết định. File này áp dụng cho **mọi AI** (Claude, Codex, Gemini, Cursor, Copilot…). Đọc hết file trước khi làm bất cứ việc gì.

Điều kiện tham gia: đọc/ghi được file và chạy được `git`, `node` (≥ 20). AI không chạy được lệnh thì không tham gia.

## 1. Khởi động (mỗi phiên, kể cả khi làm tiếp)

1. Đọc `.agents/WORKFLOW.md`: quy trình chung.
2. Đọc `.agents/project.md`: công nghệ, lệnh build/test, thư mục, quy ước của dự án này.
3. Check-in bằng ID chủ dự án cho bạn:
   ```bash
   ag checkin --id <ID> --tool <tên công cụ của bạn>
   ```
   Đọc kỹ quyền hạn in ra.
   - Nếu lệnh báo **chờ duyệt** (mã thoát 2): dừng lại. Chỉ chủ dự án duyệt được agent mới.
4. Đọc `.agents/roles/<vai>.md`, với vai là vai mà lệnh `checkin` báo.
5. Xem việc cần làm:
   ```bash
   ag inbox
   ```
   Thứ tự ưu tiên: lỗi của bạn → câu hỏi của bạn vừa có trả lời → việc đang giữ → việc mới.
6. Nhận việc rồi chuyển vào worktree mà lệnh in ra:
   ```bash
   ag claim T-NNN
   ```
   **Mọi thay đổi code làm trong worktree đó**, không làm trong worktree chính.

Cách gọi `ag`: chạy `.agents/bin/ag` (macOS/Linux, Git Bash) hoặc `.agents\bin\ag.cmd` (Windows). Cả hai đều tương đương `node .agents/bin/ag.js`.

## 2. Nguyên tắc: không tự quyết dựa trên phán đoán

Mọi lựa chọn phải dẫn được nguồn: đặc tả, file việc, quyết định `D-NNN`, `project.md`. Không có nguồn thì **hỏi cấp trên**, không đoán.

| Không cần hỏi | Bắt buộc hỏi |
|---|---|
| Chi tiết bên trong việc được giao, không đổi hành vi hay giao diện: tên biến cục bộ, cách tách hàm, thứ tự code, **khi theo đúng quy ước trong `project.md`** | Hành vi, giao diện người dùng, định dạng dữ liệu, API, thêm thư viện, đổi cấu trúc thư mục. Đặc tả mơ hồ, thiếu, hoặc tài liệu mâu thuẫn nhau |

**Chuỗi hỏi:**
- Coder và Tester hỏi Master: `ag ask "…" --task T-NNN --context "…"`.
- Master trả lời khi có nguồn. Không có nguồn thì Master chuyển lên chủ dự án.
- Hỏi xong, việc chuyển sang `blocked` và được nhả ra. Bạn nhận việc khác hoặc dừng. **Không làm tiếp theo phỏng đoán.**

## 3. Các lệnh

| Lệnh | Ai | Việc làm |
|---|---|---|
| `ag checkin --id <ID> --tool <tên>` | mọi agent | Đăng ký, nhận vai và quyền |
| `ag whoami` | mọi agent | Xem mình là ai, đang giữ việc gì |
| `ag inbox` | mọi agent | Xem việc cần làm, theo thứ tự ưu tiên |
| `ag heartbeat` | mọi agent | Báo còn sống, gia hạn việc đang giữ. Chạy ít nhất mỗi 15 phút |
| `ag task list` / `ag task show T-NNN` | mọi agent | Xem bảng việc / chi tiết một việc |
| `ag claim T-NNN` / `ag release T-NNN` | Coder, Tester | Nhận việc (tạo nhánh và worktree) / trả việc |
| `ag log "…"` | mọi agent | Ghi nhật ký |
| `ag handoff T-NNN --done "…" --left "…" --next "…"` | mọi agent | Ghi bàn giao 3 ý |
| `ag status T-NNN in_test` | Coder | Giao kiểm tra. `ag` tự chạy test, test đỏ thì bị từ chối |
| `ag ask "…" --task T-NNN --context "…"` | Coder, Tester | Hỏi Master |
| `ag bug "…" --task T-NNN --severity <mức> --repro "…"` | Tester, Master | Báo lỗi |
| `ag verify T-NNN --evidence "…"` | Tester | Xác nhận việc đạt |
| `ag status T-NNN reopened --bug B-NNN` | Tester, Master | Trả việc về do có lỗi |
| `ag task new …`, `ag answer`, `ag escalate`, `ag merge` | Master | Xem `.agents/roles/master.md` |

Lệnh sai vai sẽ bị từ chối (mã thoát 2). Đọc thông báo lỗi để biết phải làm gì tiếp.

## 4. Khi dừng giữa chừng

Agent có thể bị tắt bất kỳ lúc nào. Ghi bàn giao **trước khi** dừng và mỗi khi xong một bước lớn:

```bash
ag handoff T-NNN --done "đã làm gì" --left "còn dở chỗ nào" --next "bước tiếp theo cụ thể"
```

Việc quá hạn giữ mà không có `heartbeat` sẽ được mở cho agent khác. Agent đó làm tiếp dựa trên bàn giao của bạn.

## 5. Cấm

- Sửa bằng tay bất kỳ file nào trong `.agents-state/`. Chỉ thay đổi qua lệnh `ag`.
- `git commit --no-verify`, `git push --force`, viết lại lịch sử nhánh người khác.
- **`git push` (mọi nhánh, mọi remote) khi chưa có chủ dự án xác nhận.** Muốn đẩy code lên remote thì hỏi Master; Master chuyển lên chủ dự án; chủ dự án tự chạy `ag push`.
- Tự nhận vai, tự duyệt agent, tự trả lời câu hỏi của chính mình.
- Commit lên `main` (trừ Master qua `ag merge`).
- Sửa file ngoài phạm vi vai và ngoài `files:` của việc đang giữ.
- Tự đánh dấu việc của chính mình là đạt hoặc xong.
- Gửi mã nguồn hay dữ liệu dự án ra dịch vụ bên ngoài khi không được yêu cầu.
