# Multi-agent workflow

Quy trình để **nhiều AI** (Claude, Codex, Gemini, Cursor…) **cùng xây một phần mềm**, còn **con người là người quyết định**:
- Mỗi AI có vai rõ ràng: Master, Coder, Tester.
- Mọi thứ được ghi vào file và git, nên AI nào dừng giữa chừng (hết token, bị tắt) thì AI khác đọc file là làm tiếp được.
- AI không tự quyết: chỗ nào chưa rõ thì hỏi lên tới bạn.
- Người làm không tự nghiệm thu, và không AI nào tự push code.

Công cụ dòng lệnh `ag` giữ cho quy trình chạy đúng: nhận vai, nhận việc, hỏi đáp, bàn giao, kiểm tra quyền. Về sau có thêm Monitor (thông báo Telegram) và trang web văn phòng pixel để theo dõi và chat với Master.

---

## ⚠ Tình trạng hiện tại: đọc trước

**Repo này hiện là bản thiết kế và đặc tả. Lệnh `ag` đang được xây và chưa có dòng code nào.** Bạn **chưa thể** cài workflow vào dự án của mình bằng một lệnh.

| Đã có | Chưa có |
|---|---|
| Thiết kế, mọi quyết định đã chốt | Code của lệnh `ag` |
| Đặc tả đã duyệt cho Giai đoạn 1, 1b, 2, 3, kèm tiêu chí chấp nhận | Monitor, Telegram |
| 45 việc đã chia sẵn | Trang web |
| Tài liệu cho agent (`templates/`), hướng dẫn, ví dụ, bản phác giao diện | Bản `v0.1.0` dùng được |

---

## Bạn clone về để làm gì? Chọn một

### A. Chỉ muốn tìm hiểu (khoảng 20 phút)

1. Đọc [HUONG-DAN-WORKFLOW.md](HUONG-DAN-WORKFLOW.md), mục 1 đến 5: vấn đề, nguyên tắc, các vai, một việc và một tính năng đi từ đầu đến cuối.
2. Mở `monitor-pixel-office.html` bằng trình duyệt để xem giao diện sẽ trông thế nào.
3. Đọc [VI-DU-LICH-MUA-BAN.md](VI-DU-LICH-MUA-BAN.md): ví dụ đầy đủ dùng workflow để xây một app.

### B. Tham gia xây lệnh `ag`

Dành cho **chủ repo** và **người được chủ repo mời**. Chủ repo là người duyệt đặc tả và giao việc.

**1. Chuẩn bị:** Git ≥ 2.38, Node.js ≥ 20, và ít nhất 2 công cụ AI chạy được lệnh trong terminal (ví dụ Claude Code và Codex CLI). Không cần `npm install`, vì `ag` không dùng thư viện ngoài.
```bash
git --version
```
```bash
node --version
```

**2. Lấy repo:**
```bash
git clone https://github.com/pnhit/multi-agent-workflow.git
```
```bash
cd multi-agent-workflow
```

**3. Xem đang tới đâu:**
- [dac-ta/giao-viec.md](dac-ta/giao-viec.md): bảng thứ tự giao việc theo đợt.
- `dac-ta/viec-gd1/T-NNN.md`: dòng `status:` của từng việc. `approved` là đang chờ người nhận, `done` là xong.

**4. Bắt đầu theo vai của bạn:**

| Bạn là | Làm gì |
|---|---|
| **Chủ repo** | Làm theo [HUONG-DAN-THUC-HIEN.md](HUONG-DAN-THUC-HIEN.md) từ mục 1: mở phiên Master, duyệt T-004, giao T-001… Đọc thêm [BAT-DAU.md](BAT-DAU.md) để biết việc thường ngày |
| **Người được mời** | Nhận từ chủ repo **ID, vai và mã việc** (ví dụ `coder-02`, Coder, `T-005`). Mở một công cụ AI trong thư mục repo, dán **lời nhắn A** ở mục 2 của [HUONG-DAN-THUC-HIEN.md](HUONG-DAN-THUC-HIEN.md) với ID và việc đó |

Đừng tự nhận việc khi chưa được giao. Lời nhắn có ID và việc do chủ repo đưa **chính là sự duyệt**.

### C. Muốn áp dụng cho dự án của bạn

**Dùng ngay hôm nay: bộ khởi đầu làm tay.** Không cần cài gì:
1. Chép [bo-khoi-dau-lam-tay/AGENTS.md](bo-khoi-dau-lam-tay/AGENTS.md) vào **gốc** dự án của bạn.
2. Làm theo [bo-khoi-dau-lam-tay/HUONG-DAN.md](bo-khoi-dau-lam-tay/HUONG-DAN.md): mở phiên Master, nêu yêu cầu, duyệt đặc tả, giao Coder và Tester.

Bản làm tay có đủ các ý chính (vai, hỏi khi chưa rõ, không tự nghiệm thu, ghi mọi thứ vào file) nhưng **chưa có hàng rào tự động**.

**Đừng chép `AGENTS.md` ở gốc repo này**: file đó viết riêng cho việc xây `ag`.

**Bản đầy đủ** (có hàng rào tự động) cần lệnh `ag`, đang xây. Bấm Watch → Releases trên GitHub để được báo khi có `v0.1.0`.

**Khi có `v0.1.0`**, các bước sẽ là (theo thiết kế đã duyệt):
```bash
git clone https://github.com/pnhit/multi-agent-workflow.git
```
Sau đó vào thư mục dự án của bạn (đã là repo git, có ít nhất 1 commit), rồi chạy:
```bash
node ../multi-agent-workflow/bin/ag.js init
```
Dự án đã có code thì dùng `init --existing`. Tiếp theo:
1. điền `.agents/project.md`;
2. duyệt agent: `ag approve-agent coder-01 --role coder`;
3. mở mỗi phiên AI, dán: *"Đọc AGENTS.md và làm theo. ID của bạn: coder-01. Công cụ: …"*.

Hướng dẫn đầy đủ, từng bước: [VI-DU-LICH-MUA-BAN.md](VI-DU-LICH-MUA-BAN.md).

---

## Bản đồ repo

| File / thư mục | Để làm gì | Ai đọc |
|---|---|---|
| `README.md` | File này: bắt đầu từ đâu | Mọi người |
| [HUONG-DAN-WORKFLOW.md](HUONG-DAN-WORKFLOW.md) | Workflow là gì, chạy thế nào, tuỳ chỉnh ra sao | Người muốn hiểu hoặc áp dụng |
| [VI-DU-LICH-MUA-BAN.md](VI-DU-LICH-MUA-BAN.md) | Ví dụ đầy đủ: xây một app bằng workflow | Người muốn áp dụng |
| [HUONG-DAN-THUC-HIEN.md](HUONG-DAN-THUC-HIEN.md) | Từng bước xây `ag`: 10 đợt, lời nhắn dán sẵn | Chủ repo, người đóng góp |
| [BAT-DAU.md](BAT-DAU.md) | Việc thường ngày của chủ repo | Chủ repo |
| [THIET-KE.md](THIET-KE.md) | Thiết kế đầy đủ và **mọi quyết định đã chốt** (mục 9) | Người cần biết "vì sao" |
| [AGENTS.md](AGENTS.md) | Luật cho AI **đang xây repo này** (giai đoạn làm tay) | AI làm việc trong repo này |
| `dac-ta/` | Đặc tả từng giai đoạn, đề xuất đã duyệt, các việc, thứ tự giao | Master, Coder, Tester |
| `templates/` | Luật mà `ag init` sẽ chép vào **dự án của bạn** (`AGENTS.md`, vai, quy trình) | AI trong dự án dùng workflow |
| `monitor-*.html` | Bản phác giao diện, dữ liệu giả. Hướng chính: `monitor-pixel-office.html` | Mọi người |
| `bo-khoi-dau-lam-tay/` | **Dùng workflow ngay hôm nay, không cần `ag`**: một file `AGENTS.md` chung và một trang hướng dẫn | Người muốn áp dụng ngay |
| `vi-du-lich-mua-ban/` | File thật từ dự án thử nghiệm đầu tiên, chỉ để tham khảo | Người tò mò |

---

## Câu hỏi thường gặp khi mới clone

**Tôi chạy `node bin/ag.js` nhưng báo không có file?**
Đúng vậy. Code chưa được viết. File này xuất hiện khi việc T-001 xong.

**`AGENTS.md` ở thư mục gốc có phải thứ tôi chép sang dự án của tôi không?**
Không. File đó là luật cho các AI **đang xây chính repo này**. Muốn dùng ngay thì chép `bo-khoi-dau-lam-tay/AGENTS.md`. Khi có `ag`, lệnh `ag init` sẽ tự chép bản đầy đủ (`templates/AGENTS.md`).

**Có cần cài gói npm nào không?**
Không. `ag` chỉ dùng thư viện có sẵn của Node.js ≥ 20.

**Dùng công cụ AI nào?**
Bất kỳ công cụ nào đọc/ghi được file và chạy được lệnh trong terminal: Claude Code, Codex CLI, Gemini CLI, Cursor… Trộn nhiều công cụ trong một dự án cũng được. AI chỉ có khung chat trên web thì không tham gia được.

**Tôi muốn góp ý thiết kế?**
Mở issue trên GitHub, hoặc báo chủ repo. Mọi thay đổi đặc tả phải được chủ repo duyệt và ghi vào mục "Lịch sử thay đổi" của đặc tả.
