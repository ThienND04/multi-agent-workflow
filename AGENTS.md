# Hướng dẫn cho AI agent (giai đoạn tự khởi động)

> **File này chỉ dành cho AI đang xây công cụ `ag` trong repo này.** Muốn dùng workflow cho dự án khác thì chép `starter-kit/AGENTS.md`, không chép file này.

Repo này xây **lệnh `ag`** cho workflow multi-agent. Lệnh `ag` chưa có, nên tạm thời mọi agent làm theo quy trình bằng tay dưới đây. Khi Đợt 5 xong (T-001 … T-012 đều `done`, xem `specs/task-order.md`), chủ dự án chạy `ag init --existing` trên chính repo này, và file này được thay bằng bản thật (`internal/BUILD-GUIDE.md` mục 4).

File này áp dụng cho **mọi AI** (Claude, Codex, Gemini, Cursor, Copilot…). Điều kiện tham gia: đọc/ghi được file và chạy được `git`, `node` (≥ 20).

## 1. Đọc trước khi làm bất cứ việc gì

1. `internal/DESIGN.md`: thiết kế tổng thể. Mục 3 (nguyên tắc), mục 4 (vai trò và chuỗi hỏi), mục 9 (các quyết định đã chốt).
2. `specs/phase-1.md`: **đặc tả đã duyệt. Luôn là bản đúng nhất.**
3. File việc bạn được giao: `specs/tasks/T-NNN.md`.

## 2. Bạn là ai

Chủ dự án cho bạn **ID, vai và việc** ngay trong lời nhắn mở phiên, ví dụ: *"ID: coder-01, vai Coder, việc T-001"*. Lời nhắn đó chính là sự duyệt của chủ dự án.

- **Không** tự nhận vai khác.
- **Không** tự nhận thêm việc khác ngoài việc được giao.
- Lời nhắn thiếu ID, vai hoặc việc: dừng lại và hỏi.

| Vai | Được sửa | Không được |
|---|---|---|
| Master | `internal/DESIGN.md`, `AGENTS.md`, `specs/**`, `templates/**` (tài liệu) | Sửa code `src/`, `bin/`, `test/`. Tự quyết thay chủ dự án |
| Coder | Đúng các file trong `files:` của việc được giao, **trên nhánh riêng** | Sửa đặc tả, `internal/DESIGN.md`, file việc của người khác. Thêm thư viện ngoài. Tự đánh dấu việc xong |
| Tester | `test/e2e/**` và file trong `files:` của việc loại `test` | Sửa `src/`, đặc tả |

## 3. Quy trình (thay cho lệnh `ag` trong lúc chờ)

Gọi `<repo>` là thư mục chứa file này, nhánh `main`.

**Nhận việc** (Coder):
1. Kiểm tra việc có `status: approved` hoặc `reopened`, và mọi việc trong `depends_on` đều đã `done`. Không đúng thì dừng lại, báo chủ dự án.
2. Tạo worktree riêng:
   ```bash
   git -C <repo> worktree add ../multi-agent-workflow-wt/<ID> -b agent/<ID>/<T-NNN>
   ```
   Nếu nhánh đã có (việc `reopened`, hoặc làm tiếp việc của người khác), bỏ `-b` và dùng tên nhánh cũ.
3. Sửa frontmatter file việc **trong `<repo>`** (không phải trong worktree): `status: in_progress`, `claimed_by: <ID>`, `branch: agent/<ID>/<T-NNN>`.
4. Mọi code viết trong worktree của bạn. Commit trên nhánh của bạn, mỗi thông điệp commit kết thúc bằng 2 dòng:
   ```
   Agent-Id: <ID>
   Task: <T-NNN>
   ```

**Trạng thái** (`specs/**`) chỉ sửa trong `<repo>`, **không commit**. Master gom và commit các thay đổi này lên `main`.

**Ghi nhật ký:** thêm dòng vào `specs/journal/<ngày>-<ID>.md` (dạng `HH:MM nội dung`). Chỉ ghi thêm, không sửa dòng cũ.

**Khi dừng** (xong, hết giờ, hay bị gián đoạn): ghi vào mục "Ghi chú bàn giao" của file việc đủ 3 ý **Đã làm / Còn dở / Bước tiếp theo**, và cập nhật `handoff_at`. Không ghi đè bàn giao cũ, chỉ ghi thêm.

**Giao kiểm tra:** chạy `node --test` trong worktree. Phải xanh hết, không còn thay đổi chưa commit. Sau đó đặt `status: in_test` và ghi bàn giao. **Coder không đặt `verified` hay `done`.**

**Tester:** check out nhánh của việc trong worktree riêng của Tester, chạy lại test và đối chiếu từng tiêu chí `A-…`.
- Đạt: `status: verified`, ghi bằng chứng (lệnh đã chạy và kết quả) vào bàn giao.
- Không đạt: tạo `specs/bugs/B-NNN.md` theo mục 3.4 của đặc tả, rồi đặt `status: reopened`.

**Master:** gộp nhánh vào `main` bằng `git merge --no-ff`, chạy lại `node --test`, rồi đặt `status: done`.

## 4. Không tự quyết: hỏi theo cấp

Ranh giới đã chốt (internal/DESIGN.md mục 9, dòng 6):
- **Không cần hỏi:** chi tiết bên trong việc, không đổi hành vi hay giao diện (tên biến cục bộ, cách tách hàm, thứ tự code), theo đúng quy ước.
- **Bắt buộc hỏi:** hành vi, giao diện, định dạng dữ liệu, API, thêm thư viện, đổi cấu trúc thư mục, và mọi chỗ đặc tả mơ hồ hoặc mâu thuẫn.

Cách hỏi:
1. Tạo `specs/questions/D-NNN.md` (số kế tiếp), frontmatter theo mục 3.4 của đặc tả, `to: master`.
2. Đặt việc `status: blocked`, thêm `D-NNN` vào `blocked_by`, ghi bàn giao rồi dừng việc đó. **Không làm tiếp theo phỏng đoán.**

Master chỉ trả lời khi dẫn được nguồn. Không có nguồn thì Master chuyển câu hỏi cho chủ dự án (`to: owner`).

## 5. Cấm

- `git commit --no-verify`, `git push --force`, viết lại lịch sử nhánh người khác.
- **`git push` (mọi nhánh, mọi remote) khi chưa có chủ dự án xác nhận.** Muốn đẩy code lên remote thì tạo câu hỏi cho Master; chỉ chủ dự án quyết định và tự push.
- Commit lên `main` (trừ Master).
- Sửa file ngoài phạm vi vai và việc.
- Thêm thư viện ngoài vào `package.json`.
- Xoá hoặc sửa bàn giao, nhật ký, câu hỏi đã ghi của người khác.
