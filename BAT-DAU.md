# Bắt đầu từ đây

Hướng dẫn cho **chủ dự án** (con người). Đọc trong khoảng 5 phút.

## Đây là gì

Repo này xây một **quy trình để nhiều AI cùng làm phần mềm**, còn bạn là người quyết định. Có ba vai AI:
- **Master** viết đặc tả và chia việc.
- **Coder** viết code.
- **Tester** kiểm tra độc lập.

Các AI không trao đổi trực tiếp với nhau. Chúng nói chuyện qua file trong repo, nên AI nào dừng giữa chừng thì AI khác đọc file là làm tiếp được.

Bản thân công cụ `ag` (lệnh quản lý quy trình) **chưa có**. Ta đang dùng chính quy trình này, làm bằng tay, để xây ra nó.

| Đã xong | Chưa có |
|---|---|
| Thiết kế tổng thể, đặc tả Giai đoạn 1 (đã duyệt), 19 việc T-001…T-019, tài liệu cho agent | Code của lệnh `ag`, Monitor, Telegram, trang web 2D |

## Cần chuẩn bị

- **Git** ≥ 2.38 và **Node.js** ≥ 20. Kiểm tra:
  ```bash
  git --version
  ```
  ```bash
  node --version
  ```
- **Ít nhất 2 công cụ AI chạy được lệnh trong terminal**, ví dụ Claude Code, Codex CLI, Gemini CLI, Cursor. AI chỉ có khung chat trên web (không chạy được lệnh) thì không tham gia được.

## 5 bước đầu tiên

### Bước 1. Tạo commit đầu tiên

Coder cần có ít nhất một commit trên `main` mới tạo được nhánh riêng.

```bash
git add -A
```
```bash
git commit -m "Thiết kế, đặc tả Giai đoạn 1 và tài liệu cho agent"
```

### Bước 2. Duyệt tài liệu cho agent (việc T-004)

Đọc 6 file trong `templates/`. Đây là "luật" mà mọi AI sẽ theo ở các dự án sau này:

| File | Nội dung |
|---|---|
| `templates/AGENTS.md` | File đầu tiên mọi AI đọc: khởi động, lệnh, điều cấm |
| `templates/WORKFLOW.md` | Quy trình chung: vòng đời việc, hỏi đáp, bàn giao, git |
| `templates/roles/master.md`, `coder.md`, `tester.md` | Việc phải làm và điều cấm của từng vai |
| `templates/project.md` | Mẫu cấu hình riêng cho mỗi dự án |

Cần sửa chỗ nào thì nói với Master. Duyệt xong thì nói *"duyệt T-004"*.

### Bước 3. Giao việc T-001 cho một Coder

1. Mở một công cụ AI tại thư mục repo này.
2. Dán lời nhắn **"Đợt 1: Coder làm T-001"** trong [dac-ta/giao-viec.md](dac-ta/giao-viec.md).
3. Sửa `<tên công cụ>` thành tên công cụ bạn dùng.

Lời nhắn đã có sẵn **ID, vai và việc**. Khi bạn dán lời nhắn, cũng là bạn duyệt AI đó tham gia.

### Bước 4. Giao Tester kiểm tra

Khi `dac-ta/viec-gd1/T-001.md` có `status: in_test`:
1. Mở một phiên AI **khác**, tốt nhất là một công cụ khác với Coder.
2. Dán lời nhắn **"Kiểm tra T-001: Tester"** trong `dac-ta/giao-viec.md`.

### Bước 5. Cho Master gộp

Khi T-001 có `status: verified`, mở phiên Master và nói *"T-001 đã verified, gộp đi"*.

Sau đó lặp lại bước 3 đến bước 5 cho các việc tiếp theo, theo bảng **"Thứ tự giao"** trong `dac-ta/giao-viec.md`. Từ đợt 3 trở đi, bạn mở nhiều Coder cùng lúc được.

## Việc thường ngày của bạn

**Trả lời câu hỏi.** AI không tự quyết, nên sẽ có câu hỏi gửi lên bạn:
- Câu hỏi nằm ở `dac-ta/hoi-dap/D-NNN.md`. Câu nào có `to: owner` và `status: escalated` là đang chờ bạn.
- Master đã ghi sẵn các phương án, ảnh hưởng của từng phương án, và đề xuất của Master.
- Bạn trả lời với Master trong phiên chat, Master ghi lại vào file.
- Mỗi câu bạn trả lời thành tiền lệ, nên về sau số câu hỏi giảm dần.

**Xem tiến độ.** Mỗi file `dac-ta/viec-gd1/T-NNN.md` có dòng `status:` và mục "Ghi chú bàn giao" (đã làm, còn dở, bước tiếp theo).

| Trạng thái | Nghĩa |
|---|---|
| `approved` | Sẵn sàng giao |
| `in_progress` | Coder đang làm |
| `blocked` | Đang chờ câu trả lời |
| `in_test` | Chờ Tester kiểm tra |
| `verified` | Tester đã đạt, chờ Master gộp |
| `done` | Đã gộp vào `main` |
| `reopened` | Có lỗi, trả về cho Coder (chi tiết lỗi ở `dac-ta/loi/B-NNN.md`) |

**Khi một AI bị treo, tắt, hoặc hết token:**
1. Mở phiên AI mới (cùng công cụ hay công cụ khác đều được) **trong đúng thư mục worktree của AI cũ**, ví dụ `../multi-agent-workflow-wt/coder-01/`.
2. Dán lời nhắn sau:
   ```text
   Đọc AGENTS.md và làm theo. ID của bạn: coder-01 (làm tiếp phiên trước bị dừng). Việc: T-NNN.
   Đọc ghi chú bàn giao trong file việc, xem git log của nhánh, chạy node --test để thấy hiện trạng, rồi làm tiếp từ chỗ còn dở.
   ```
3. Code đã commit nằm trên nhánh. Code chưa commit vẫn nằm trên ổ đĩa trong worktree đó, nên không bị mất.

**Push code lên remote (GitHub…):** AI không bao giờ tự push. Khi cần đẩy code, AI sẽ hỏi. Bạn tự quyết và tự push (sau này qua lệnh `ag push`, có gõ xác nhận).

## Sau khi có lệnh `ag` (từ đợt 4)

Khi T-003 và T-006 xong, Master chạy `ag init` trên chính repo này. Từ đó:
- AI dùng lệnh `ag` thay cho sửa file bằng tay.
- Bạn trả lời câu hỏi bằng lệnh `ag decide D-NNN "…"` trong terminal của bạn. Lệnh này bắt gõ xác nhận, nên AI không chạy thay bạn được.
- Bạn duyệt AI mới bằng lệnh `ag approve-agent <ID> --role <vai>`.

Telegram (chỉ thông báo) có ở Giai đoạn 2. Trang web 2D có ở Giai đoạn 3, kèm hộp thư để nhắn Master ngay trên web. Trước Giai đoạn 3, bạn theo dõi qua các file `dac-ta/viec-gd1/T-NNN.md` và trao đổi với Master trong phiên chat của công cụ AI.

## Tìm hiểu thêm

| Muốn biết | Đọc |
|---|---|
| Toàn bộ workflow và cách tuỳ chỉnh cho dự án, cho đội của bạn | [HUONG-DAN-WORKFLOW.md](HUONG-DAN-WORKFLOW.md) |
| Vì sao thiết kế như vậy, các quyết định đã chốt | [README.md](README.md) |
| Áp dụng cho dự án có sẵn, chế độ 1 agent, cổng xác nhận FE/BE, skill từng vai, làm tiếp khi hết token (đã duyệt) | [dac-ta/de-xuat-bo-sung-01.md](dac-ta/de-xuat-bo-sung-01.md) |
| Lệnh `ag` làm gì, tiêu chí đạt của từng lệnh | [dac-ta/giai-doan-1.md](dac-ta/giai-doan-1.md) |
| Quy tắc AI phải theo lúc này | [AGENTS.md](AGENTS.md) |
| Mẫu trang monitor 2D | Mở `monitor-2d-mockup.html` bằng trình duyệt |
