# Multi-agent workflow

Cách để **nhiều AI** (Claude, Codex, Gemini, Cursor…) **cùng làm một phần mềm mà không loạn**, còn **bạn là người quyết định**:

- Mỗi AI một vai: **Master** phân tích và chia việc, **Coder** viết code, **Tester** kiểm tra.
- AI **không tự đoán**: chỗ nào chưa rõ thì hỏi, câu nào Master không trả lời được thì hỏi bạn.
- **Người làm không tự nghiệm thu**: Coder xong thì Tester kiểm tra độc lập.
- **Mọi thứ ghi vào file và git**: AI nào hết token hay bị tắt, AI khác đọc file là làm tiếp được.
- **Không AI nào tự push code.** Bạn xem rồi mới push.

---

## Dùng ngay: 3 bước

1. Chép file [bo-khoi-dau-lam-tay/AGENTS.md](bo-khoi-dau-lam-tay/AGENTS.md) vào **thư mục gốc** dự án của bạn.
2. Mở một công cụ AI tại thư mục dự án, dán (điền yêu cầu thật của bạn):
   ```text
   Đọc AGENTS.md và làm theo. ID của bạn: master. Vai: Master.
   Yêu cầu của tôi: <bạn muốn xây gì, cho ai, chạy trên đâu>.
   Hỏi tôi đến khi đủ để viết đặc tả. Không tự quyết.
   ```
3. Làm tiếp theo [bo-khoi-dau-lam-tay/HUONG-DAN.md](bo-khoi-dau-lam-tay/HUONG-DAN.md): duyệt đặc tả, mở phiên Coder, mở phiên Tester, gộp và push. Một trang, có lời nhắn dán sẵn.

Không cần cài gì. Chỉ cần Git và 2–3 phiên AI chạy được lệnh trong terminal.

---

## Đang làm gì tiếp

Đây là **bản làm tay**: đủ các ý chính, nhưng AI làm sai luật thì không có gì tự động chặn lại, bạn phải để ý.

Bản đầy đủ sẽ có công cụ dòng lệnh **`ag`** làm hàng rào: chặn sai vai, chặn tự nghiệm thu, chặn push. Công cụ này **đang được xây** và sẽ được thu gọn dựa trên phản hồi từ việc dùng bản làm tay. Bấm **Watch → Releases** trên GitHub để được báo khi có bản dùng được.

---

## Repo này có gì

| Thư mục / file | Dành cho |
|---|---|
| `bo-khoi-dau-lam-tay/` | **Bạn**: dùng workflow cho dự án của mình |
| `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `dac-ta/`, `templates/`, `noi-bo/` | Người **xây công cụ `ag`**. Người dùng không cần đọc. Bắt đầu từ [noi-bo/README.md](noi-bo/README.md) |

**Lưu ý:** đừng chép `AGENTS.md` ở gốc repo này sang dự án của bạn. File đó là luật cho các AI đang xây chính repo này. File để chép là `bo-khoi-dau-lam-tay/AGENTS.md`.

Góp ý: mở issue trên GitHub.
