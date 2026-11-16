Trạng thái: Đã xong
Chủ dự án xác nhận hiển thị ổn trên Samsung Galaxy S22 Ultra ngày 16/11/2026.
Chủ dự án duyệt ngày 13/11/2026. File này là một phần của đặc tả (mục 6.6).
Điều phối kiểm tra lại ngày 16/11/2026:
- `testDebugUnitTest --rerun`: 33/33 đạt, gồm 4 ca lọc ở mục D, khớp đúng ô và số đã tính sẵn.
- Câu chữ Cài đặt, dải "Đang lọc", thông báo khi không có cặp và 3 câu hướng dẫn đã sửa đều khớp bản duyệt.
- Chưa kiểm tra trên máy thật.

# YC-002: Lọc thứ và giờ mua bán trong Cài đặt

**Quyết định của chủ dự án (13/11/2026):**
- Cài đặt dùng để **lọc** các thứ được xét. Ô không thuộc lựa chọn bị làm mờ. Câu kết luận và top 10 chỉ xét các ô được chọn.
- Cho chọn **cả giờ** mua và giờ bán (9:30 / 14:30). Bảng nhiệt của giờ không được chọn bị ẩn.

## A. Màn hình Cài đặt: mục mới "Thứ và giờ được xét"

Đặt ngay dưới "Danh mục mã". Gồm 4 nhóm chip chọn nhiều:

| Nhóm | Chip | Mặc định |
|---|---|---|
| Thứ mua | T2 T3 T4 T5 T6 | chọn tất cả |
| Thứ bán | T2 T3 T4 T5 T6 | chọn tất cả |
| Giờ mua | 9:30 · 14:30 | chọn cả hai |
| Giờ bán | 9:30 · 14:30 | chọn cả hai |

- Mỗi nhóm phải còn **ít nhất 1 chip**. Bấm bỏ chip cuối cùng thì không bỏ được, và hiện dòng nhỏ "Cần chọn ít nhất 1".
- Dòng mô tả dưới tiêu đề mục: "Chỉ xét các lần mua và bán theo thứ và giờ bạn chọn. Áp dụng cho mọi mã."
- Nút "Chọn tất cả" ở cuối mục để đặt lại mặc định.
- Lưu bằng DataStore, áp dụng chung cho mọi mã. Đổi lựa chọn thì tính lại ngay từ cache, không gọi API.

## B. Ảnh hưởng tới màn hình chính

Ô **được xét** là ô thoả cả 4 điều kiện: thứ mua, thứ bán, giờ mua, giờ bán đều nằm trong lựa chọn.

1. **Bảng nhiệt:** chỉ hiện các bảng có giờ mua thuộc "Giờ mua" **và** giờ bán thuộc "Giờ bán". Bảng còn lại ẩn hẳn.
   - Ví dụ: chọn giờ mua 14:30, giờ bán 14:30 thì chỉ còn bảng "Mua 14:30 · Bán 14:30".
2. **Ô không được xét** (thứ mua hoặc thứ bán không thuộc lựa chọn) trong bảng đang hiện:
   - Vẫn hiện số, nhưng làm mờ: độ đậm 30%, bỏ màu xanh/đỏ, dùng nền trung tính.
   - Vẫn bấm được để xem chi tiết từng lệnh.
3. **Câu kết luận và bảng "10 cặp lãi nhiều lần nhất":** chỉ xếp hạng các ô được xét, vẫn với điều kiện `feasible && n > 0` của mục 5.3.
4. **Không có ô nào hợp lệ** (ví dụ chỉ chọn mua T5, bán T6, vốn đều là ô "T+2"):
   - Câu kết luận hiện "Không có cặp mua – bán nào làm được với thứ và giờ đang chọn. Hãy chọn thêm trong Cài đặt."
   - Bảng top 10 để trống, kèm cùng câu đó.
5. **Dải báo đang lọc:** khi lựa chọn khác mặc định, hiện một dải ngay dưới công tắc phí:
   "Đang lọc: mua {T2, T6} lúc {9:30} · bán {T3, T4} lúc {9:30, 14:30}". Bên phải dải có nút **Bỏ lọc**, bấm vào thì đặt lại mặc định.
6. **Ô đang chọn** (viền đậm, bảng chi tiết): nếu ô đó không còn được xét hoặc bảng của nó bị ẩn, chuyển sang cặp tốt nhất trong các ô được xét.

## C. Sửa câu chữ hướng dẫn (YC-001)

| Vị trí | Câu cũ | Câu mới |
|---|---|---|
| Sheet "Cặp tốt nhất" | "Đây là ô có tỷ lệ lãi cao nhất trong 4 bảng bên dưới." | "Đây là ô có tỷ lệ lãi cao nhất trong các ô đang được xét (xem Cài đặt → Thứ và giờ được xét)." |
| Sheet "Bảng xếp hạng" | "10 ô có tỷ lệ lãi cao nhất trong cả 4 bảng." | "10 ô có tỷ lệ lãi cao nhất trong các ô đang được xét." |
| Sheet "Cách đọc bảng" | (thêm vào cuối) | "Ô mờ là ô không thuộc thứ bạn chọn trong Cài đặt." |
| Dải "Đang lọc" | (mới, thêm nút ⓘ) | Tiêu đề "Đang lọc". Nội dung: "Bạn đang chỉ xét một số thứ và giờ mua bán. Bảng của giờ không được chọn bị ẩn, ô của thứ không được chọn bị làm mờ, và cặp tốt nhất chỉ chọn trong phần còn lại. Bấm Bỏ lọc để xem tất cả." |

## D. Kiểm thử chấp nhận

**Unit test** dùng fixture và "bây giờ" = 13/11/2026 10:50 như mục 9.1 đặc tả, phí 0,3%, chế độ sau phí. Số đã tính bằng `reference/stats-reference.js` cộng thêm bước lọc.

| Mã | Lọc | Cặp tốt nhất phải là |
|---|---|---|
| TCB | mua T6; bán T3, T4; mọi giờ | `CP-CP` T6 → T4, 4/8, avgNet +0,12% |
| TCB | mọi thứ; mua 14:30; bán 14:30 | `CP-CP` T2 → T6, 5/7, avgNet +0,80% |
| HPG | mua T5; bán T6; mọi giờ | không có (tất cả là "T+2") |
| TCB | mặc định (không lọc) | `DP-CP` T2 → T4, 6/8, avgNet +0,96% (như cũ) |

**Kiểm tra trên máy thật:**
- Bỏ chọn giờ mua 9:30 → hai bảng "Mua 9:30 · …" biến mất, dải "Đang lọc" hiện ra. Bấm Bỏ lọc → hiện lại đủ 4 bảng.
- Không bỏ được chip cuối cùng của một nhóm.
- Đóng mở lại app → lựa chọn vẫn giữ nguyên.
