Trạng thái: Đã xử lý xong

# Phản hồi bản góp ý REVIEW.md (lần 1, 13/11/2026)

Đã xử lý cả 10 góp ý. Đặc tả đã được sửa, chi tiết ở mục 11 "Lịch sử thay đổi" của `SPEC-lich-mua-ban-android.md`. `reference/stats-reference.js` và `fixtures/` đã được cập nhật. Số kiểm thử ở mục 9.1 đã thay đổi, hãy dùng bộ số mới.

| # | Góp ý | Kết quả | Mục đặc tả |
|---|---|---|---|
| 1 | Không tính lại được (H+L+C)/3 từ cache | **Chủ dự án quyết định bỏ tuỳ chọn này.** App chỉ dùng giá đóng của nến 09:15 và 14:15, nên không cần lưu thêm cao/thấp. | 4.2, 6.2 |
| 2 | Chưa lọc mã sàn HOSE | Đã sửa. Không dùng danh sách mã cài sẵn (dễ lỗi thời). Thay vào đó, nhận diện qua cấu trúc nến: HOSE không có nến 09:00 và 14:30, HNX có nến 09:00, UPCoM có cả hai. Đã kiểm chứng với HPG, VCB (HOSE), SHS, PVS (HNX), ACV, VEA, OIL (UPCoM). Lưu ý: BSR và MCH nêu trong góp ý hiện có cấu trúc nến của HOSE, nên không dùng làm ví dụ mã ngoài HOSE. | 4.1, 4.4, 6.3, 9.3 |
| 3 | Thiếu `dpReady` | Đã sửa. `dp` của hôm nay = null trước 09:31. | 4.2, 8 |
| 4 | `buyFrom` làm lệch số lệnh tuần đầu | **Chủ dự án chọn tính cửa sổ theo ngày bán.** Lưu ý: đề xuất `windowStart − 5` trong góp ý chưa đủ, vì cặp T2 → T2 (bán thứ Hai tuần sau) cần mua từ thứ Hai tuần trước. Đã đặt `buyFrom = windowStart − 7`, `fetchFrom = windowStart − 14`, và bỏ lệnh có ngày bán trước `windowStart`. Mọi ô khả thi nay đều có n = 8. | 3, 5.1, 9 |
| 5 | Chia cho 0 khi `n == 0` | Đã sửa theo đề xuất. Ô hiện "0/0" và "—", nền trung tính, không bấm được. | 6.1 khoản 5, 8 |
| 6 | ON_START gọi API quá thường xuyên | Đã sửa. Chỉ gọi API khi lần tải trước đã ≥ 15 phút, hoặc vừa qua mốc 09:31/14:31. Mỗi lần ON_START vẫn tính lại cửa sổ từ cache. | 7, 9.3 |
| 7 | Chưa có tiêu chí phá hoà | Đã sửa, dùng thứ tự cố định (mode, ngày mua, ngày bán), khớp với mã tham chiếu. Không dùng tiêu chí "hold nhỏ hơn" hay "n lớn hơn", để kết quả không đổi so với mã tham chiếu. | 5.3 |
| 8 | Bảng chi tiết chưa rõ hiện lãi trước hay sau phí | **Chủ dự án chọn hiện lãi sau phí khi công tắc bật.** | 6.1 khoản 7 |
| 9 | Inject `Clock` | Đã thêm theo đề xuất. | 7 |
| 10 | Cửa sổ vắt qua hai năm | Đã sửa theo đề xuất. | 6.1 khoản 1 |
