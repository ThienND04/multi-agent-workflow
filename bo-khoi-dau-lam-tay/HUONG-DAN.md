# Bộ khởi đầu làm tay: dùng workflow multi-agent ngay hôm nay

Không cần cài gì. Chỉ cần **1 file** và **2–3 phiên AI**.

## Bước 1. Chép file vào dự án

Chép `AGENTS.md` trong thư mục này vào **thư mục gốc** dự án của bạn. Đặt ở gốc, **không** đặt trong `dac-ta/`.

```
du-an-cua-ban/
  AGENTS.md      ← ở đây
  (code của bạn, nếu có)
```

Công cụ dùng tên file khác thì tạo thêm một file chỉ một dòng *"Đọc và làm theo AGENTS.md"*:
- Claude Code: `CLAUDE.md`;
- Gemini CLI: `GEMINI.md`.

## Bước 2. Mở phiên Master và nêu yêu cầu

Mở công cụ AI **tại thư mục dự án**, dán (thay phần trong `<…>` bằng yêu cầu thật):

```text
Đọc AGENTS.md và làm theo. ID của bạn: master. Vai: Master.
Đây là dự án <mới / đã có code>. Lần đầu nên hãy dựng khung theo mục 2 của AGENTS.md.
Yêu cầu của tôi: <mô tả bạn muốn xây: dùng cho ai, làm được gì, chạy trên đâu, dữ liệu lấy từ đâu>.
Hỏi tôi đến khi đủ để viết đặc tả có tiêu chí chấp nhận. Không tự quyết.
```

Master sẽ dựng khung `dac-ta/` (và xin phép chạy `git init` nếu cần), hỏi bạn từng điểm, rồi viết đặc tả và chia việc.

## Bước 3. Duyệt đặc tả

Đọc `dac-ta/DAC-TA.md` và các file trong `dac-ta/viec/`. Ổn thì nói với Master: **"duyệt"**. Các việc chuyển sang `approved`.

## Bước 4. Giao việc cho Coder

Mở **phiên AI mới**, tại thư mục dự án:

```text
Đọc AGENTS.md và làm theo. ID của bạn: coder-01. Vai: Coder. Việc: T-001.
```

Muốn làm song song thì mở thêm `coder-02` với việc khác. Master đã chia sao cho các việc không sửa chung file.

## Bước 5. Giao Tester kiểm tra

Khi việc có `status: in_test`, mở **phiên AI khác**. Nên dùng công cụ khác với Coder:

```text
Đọc AGENTS.md và làm theo. ID của bạn: tester-01. Vai: Tester. Kiểm tra việc: T-001.
```

- **Trượt:** Tester ghi lỗi, việc về `reopened`. Bảo Coder sửa.
- **Đạt:** việc thành `verified`.

## Bước 6. Gộp và push

Nói với Master: *"T-001 đã verified, gộp đi."* Master gộp vào `main` và chạy lại test.

Bạn xem lại rồi tự push:
```bash
git push origin main
```

Lặp lại bước 4 đến 6 cho các việc tiếp theo.

---

## Hằng ngày bạn chỉ cần

| Khi nào | Làm gì |
|---|---|
| Master báo có câu hỏi (hoặc có file `dac-ta/hoi-dap/D-NNN.md` ghi `to: owner`) | Trả lời trong phiên Master |
| Muốn biết tiến độ | Hỏi Master: *"Tóm tắt trạng thái các việc"* |
| Một phiên AI hết token hoặc bị tắt | Mở phiên mới **trong đúng thư mục làm việc của nó** (`../<tên-dự-án>-wt/<ID>`), dán: *"Đọc AGENTS.md (ở thư mục dự án chính) và làm theo. ID của bạn: <ID cũ>, làm tiếp việc <T-NNN>. Đọc bàn giao rồi làm tiếp."* |

## Bản làm tay khác bản có công cụ `ag` thế nào

Bản làm tay giữ đủ các ý chính:
- AI có vai riêng;
- AI hỏi khi chưa rõ;
- người làm không tự nghiệm thu;
- mọi thứ ghi vào file và git.

Cái **thiếu** là hàng rào tự động: AI làm sai luật (sửa nhầm file, tự đặt "xong") thì không có gì chặn, bạn phải để ý. Khi công cụ `ag` xong, bạn chuyển sang bản đầy đủ. Các file trong `dac-ta/` vẫn dùng tiếp được.
