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
| Thiết kế tổng thể. Đặc tả Giai đoạn 1 và 1b (đã duyệt). 28 việc T-001…T-028. Tài liệu cho agent. Bản phác giao diện văn phòng pixel. Repo trên GitHub: [pnhit/multi-agent-workflow](https://github.com/pnhit/multi-agent-workflow) | Code của lệnh `ag`, Monitor, Telegram, trang web |

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

### Bước 1. Có repo trên máy

**Đã xong** trên máy hiện tại: repo đã có commit và đã nằm trên GitHub. Sang máy khác thì lấy về:

```bash
git clone https://github.com/pnhit/multi-agent-workflow.git
```

Coder cần nhánh `main` có commit mới tạo được nhánh riêng, và điều kiện này đã có sẵn.

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

Sau đó lặp lại bước 3 đến bước 5 cho các việc tiếp theo, theo bảng **"Thứ tự giao"** trong `dac-ta/giao-viec.md`. Hướng dẫn chi tiết từng đợt nằm ở [HUONG-DAN-THUC-HIEN.md](HUONG-DAN-THUC-HIEN.md). Từ đợt 3 trở đi, bạn mở nhiều Coder cùng lúc được.

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

**Push code lên remote (GitHub…):** AI không bao giờ tự push. Khi cần đẩy code, AI sẽ hỏi. Bạn tự quyết và tự push:
```bash
git push origin main
```
Sau này dùng lệnh `ag push`, hoặc chọn "Đạt + push" khi nghiệm thu một tính năng. Cả hai đều phải gõ xác nhận.

## Khi đã có Giai đoạn 1b: làm việc theo tính năng

Đây là cách bạn sẽ làm việc hằng ngày, khi `ag` đã xây xong:

1. **Bạn trình bày yêu cầu, cùng Master phân tích.**
2. **Master viết đặc tả** và chia việc theo FE, BE, Tester.
3. **Các agent cấp dưới review đặc tả**, đặt câu hỏi. Câu nào Master không quyết được thì chuyển lên bạn. Tester viết kế hoạch kiểm thử ngay lúc này.
4. **Review xong, hết câu hỏi:** bạn được báo để cho **"bắt đầu làm"**.
5. **Agent code, Tester kiểm tra**, lặp lại nếu có lỗi.
6. **Xong:** Master kiểm tra lại, gửi bạn **báo cáo nghiệm thu**. Bạn chọn: *Đạt + push*, *Đạt, chưa push*, hoặc *Chưa đạt*.

Trong lúc tính năng A đang làm hoặc đang chờ, bạn và Master bàn tiếp tính năng B theo đúng luồng trên. Agent rảnh tự nhận việc của tính năng có độ ưu tiên cao hơn.

**Bạn chỉ cần vào ở 4 thời điểm**, lần nào cũng có thông báo:

| # | Lúc nào | Bạn làm gì |
|---|---|---|
| 1 | Có câu hỏi Master không quyết được | Trả lời |
| 2 | Review xong | Cho "bắt đầu làm" |
| 3 | Đội BE bên ngoài báo đã giao API (nếu có) | Ghi nhận, rồi gửi lại cho họ danh sách vấn đề soạn sẵn nếu API lệch hợp đồng |
| 4 | Tính năng xong | Nghiệm thu và quyết định push |

Chi tiết: [HUONG-DAN-WORKFLOW.md](HUONG-DAN-WORKFLOW.md) mục 5.3 và 11.6–11.9.

## Sau khi có lệnh `ag` (sau Đợt 5)

Khi Đợt 5 xong (T-001 … T-012), bạn chạy `ag init --existing` trên chính repo này và Master chuyển dữ liệu sang (các bước ở [HUONG-DAN-THUC-HIEN.md](HUONG-DAN-THUC-HIEN.md) mục 4). Từ đó:
- AI dùng lệnh `ag` thay cho sửa file bằng tay.
- Bạn trả lời câu hỏi bằng lệnh `ag decide D-NNN "…"` trong terminal của bạn. Lệnh này bắt gõ xác nhận, nên AI không chạy thay bạn được.
- Bạn duyệt AI mới bằng lệnh `ag approve-agent <ID> --role <vai>`.

Telegram (chỉ thông báo) có ở Giai đoạn 2. Trang web **văn phòng pixel** có ở Giai đoạn 3, kèm **Phòng họp** để chat trực tiếp với Master chính và Master của từng tính năng, giống mở nhiều phiên chat. Xem trước bản phác: mở `monitor-pixel-office.html` bằng trình duyệt. Trước Giai đoạn 3, bạn theo dõi qua các file `dac-ta/viec-gd1/T-NNN.md` và trao đổi với Master trong phiên chat của công cụ AI.

## Tìm hiểu thêm

| Muốn biết | Đọc |
|---|---|
| **Làm từng bước Giai đoạn 1 và 1b**: mở phiên nào, dán gì, kiểm tra gì, mốc chuyển sang `ag` | [HUONG-DAN-THUC-HIEN.md](HUONG-DAN-THUC-HIEN.md) |
| **Ví dụ đầy đủ: xây app Lịch mua bán** bằng workflow (cần chuẩn bị gì, từng bước) | [VI-DU-LICH-MUA-BAN.md](VI-DU-LICH-MUA-BAN.md) |
| Toàn bộ workflow và cách tuỳ chỉnh cho dự án, cho đội của bạn | [HUONG-DAN-WORKFLOW.md](HUONG-DAN-WORKFLOW.md) |
| Vì sao thiết kế như vậy, các quyết định đã chốt | [README.md](README.md) |
| Áp dụng cho dự án có sẵn, chế độ 1 agent, cổng xác nhận FE/BE hai repo, skill từng vai, làm tiếp khi hết token (đã duyệt) | [dac-ta/de-xuat-bo-sung-01.md](dac-ta/de-xuat-bo-sung-01.md) |
| FE/BE cùng repo, BE đội khác, API có sẵn, nhiều tính năng cùng lúc, luồng có review (đã duyệt) | [dac-ta/de-xuat-bo-sung-02.md](dac-ta/de-xuat-bo-sung-02.md) |
| Chat với Master trên web, Master chính và Master luồng (đã duyệt) | [dac-ta/de-xuat-bo-sung-03.md](dac-ta/de-xuat-bo-sung-03.md) |
| Lệnh `ag` làm gì, tiêu chí đạt của từng lệnh | [dac-ta/giai-doan-1.md](dac-ta/giai-doan-1.md), [dac-ta/giai-doan-1b.md](dac-ta/giai-doan-1b.md) |
| Monitor và thông báo Telegram (Giai đoạn 2, đã duyệt) | [dac-ta/giai-doan-2.md](dac-ta/giai-doan-2.md) |
| Giao việc nào trước, lời nhắn dán sẵn | [dac-ta/giao-viec.md](dac-ta/giao-viec.md) |
| Quy tắc AI phải theo lúc này | [AGENTS.md](AGENTS.md) |
| Giao diện monitor | Mở `monitor-pixel-office.html` bằng trình duyệt (hướng chính). Bản cũ: `monitor-nhieu-luong-mockup.html`, `monitor-2d-mockup.html` |
