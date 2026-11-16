# Lịch mua bán

Ứng dụng Android thống kê cổ phiếu sàn HOSE trong 8 tuần gần nhất, để tìm cặp ngày và giờ mua – bán (lúc 9:30 sau ATO, lúc 14:30 trước ATC) có số lần lãi nhiều nhất. Danh mục mặc định: TCB, HPG.

**Nếu bạn là AI được giao việc: đọc [AGENTS.md](AGENTS.md) trước tiên.** File đó mô tả luồng công việc: ai làm gì, cách đặt câu hỏi, cách góp ý, các mốc xây dựng và cách báo cáo.

## Nội dung thư mục

| Đường dẫn | Nội dung |
|---|---|
| [AGENTS.md](AGENTS.md) | Luồng công việc cho AI |
| [SPEC-lich-mua-ban-android.md](SPEC-lich-mua-ban-android.md) | Đặc tả đầy đủ (bản đúng nhất) |
| `reference/stats-reference.js` | Bản cài đặt tham chiếu của thuật toán (Node 18+) |
| `fixtures/` | Dữ liệu giá thật HPG, TCB (nến 15 phút, 07/09 – 13/11/2026) cho kiểm thử |
| `hoi-dap/` | Câu hỏi (`cau-hoi-NNN.md`) và câu trả lời (`tra-loi-NNN.md`) |
| `TIEN-DO.md` | Nhật ký tiến độ (AI thực hiện tạo khi bắt đầu xây dựng) |
| `android/` | Mã nguồn app (AI thực hiện tạo) |

Kiểm tra nhanh kết quả đúng mà app phải đạt:

```bash
node reference/stats-reference.js
```
