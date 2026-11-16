Trạng thái: Đã làm trong mã, chờ chủ dự án kiểm tra trên máy thật
Chủ dự án duyệt ngày 16/11/2026, kể cả nút "↑ Lên bảng nhiệt", cột "Giá" không tính phí và trạng thái "= Đứng giá". File này là một phần của đặc tả (mục 6.1 khoản 7).
Điều phối kiểm tra lại ngày 16/11/2026:
- `testDebugUnitTest --rerun`: 35/35 đạt.
- Ô TCB DP-CP T2 → T4 tính độc lập bằng `reference/stats-reference.js`: 8 lệnh, giá tăng 6, giảm 2, đứng giá 0. Khớp với test.
- Câu sheet "Từng lần mua bán" khớp mục C.
- APK build 16/11 09:34 vẫn còn constructor `MainViewModel(Application)`.
- Chưa kiểm tra tự cuộn trên máy thật.

# YC-004: Bấm ô thì xem ngay danh sách từng lần mua bán

**Lý do:** bảng "Chi tiết từng lệnh" (mục 6.1 khoản 7 của đặc tả) đã có, nhưng nằm dưới bảng top 10. Bấm một ô xong phải tự cuộn xuống mới thấy, nên người dùng không biết là có.

**Quyết định của chủ dự án (16/11/2026):**
- Bấm ô thì **tự cuộn xuống bảng chi tiết hiện có**. Không làm khung trượt hay màn hình riêng.
- Thêm cột **▲ Tăng / ▼ Giảm**, và dòng tóm tắt.

## A. Tự cuộn tới bảng chi tiết

1. Bấm một ô trong bảng nhiệt, hoặc một dòng trong bảng top 10:
   - Chọn ô đó như hiện nay (viền đậm).
   - **Cuộn mượt** màn hình sao cho tiêu đề bảng "Chi tiết từng lệnh" nằm ở đầu vùng nhìn thấy.
2. Nhấn giữ ô vẫn mở popup chỉ số như cũ, **không** cuộn.
3. Ô "T+2" và ô "0/0" vẫn không bấm được, không cuộn.
4. Bên phải tiêu đề bảng chi tiết có nút chữ **"↑ Lên bảng nhiệt"**. Bấm vào thì cuộn mượt về đúng bảng nhiệt chứa ô đang chọn.
5. Khi app vừa mở (ô được chọn sẵn là cặp tốt nhất), **không** tự cuộn.

## B. Nội dung bảng chi tiết

Dòng tiêu đề nhỏ dưới tên bảng (đã có), ví dụ: "TCB · mua thứ Hai lúc 9:30, bán thứ Tư lúc 14:30".

Các cột, theo thứ tự:

| Cột | Ví dụ | Ghi chú |
|---|---|---|
| Ngày mua | 21/09 (T2) | |
| Giá mua | 21,30 | nghìn đồng |
| Ngày bán | 23/09 (T4) | |
| Giá bán | 22,07 | nghìn đồng |
| Giá | ▲ Tăng | **Mới.** So **giá bán với giá mua**, không tính phí: `giá bán > giá mua` → "▲ Tăng" (xanh); `<` → "▼ Giảm" (đỏ); bằng nhau → "= Đứng giá" (màu chữ phụ). |
| Lãi/lỗ (hoặc Lãi/lỗ sau phí) | +3,60% | Giữ như hiện tại, theo công tắc phí (mục 6.1 khoản 7). |

- Sắp xếp theo ngày mua, cũ nhất ở trên (như hiện tại).
- Màn hình hẹp không đủ chỗ: bảng cuộn ngang trong khung của nó, màn hình không bị kéo ngang. Cột "Ngày mua" cố định bên trái.

**Dòng tóm tắt** ở cuối bảng:

> Giá tăng **{6}** lần, giảm **{2}** lần{, đứng giá {0} lần} · Lãi{ sau phí} **{5}/{8}** lần

- Phần "đứng giá" chỉ hiện khi có ít nhất 1 lần.
- Số "Lãi …/…" phải bằng đúng số ghi trong ô đang chọn.

**Vì sao "Tăng" có thể khác "Lãi sau phí":** một lần giá tăng 0,2% vẫn là "▲ Tăng", nhưng sau khi trừ phí 0,3% thì là lỗ. Dòng tóm tắt hiện cả hai con số để người dùng thấy rõ.

## C. Sửa câu hướng dẫn (YC-001, sheet "Từng lần mua bán")

| Câu cũ | Câu mới |
|---|---|
| "Từng lần mua – bán của ô đang chọn: ngày, giá mua, giá bán (nghìn đồng) và lãi/lỗ{ sau phí}. Xanh là lãi, đỏ là lỗ." | "Từng lần mua – bán của ô đang chọn: ngày, giá mua, giá bán (nghìn đồng), giá tăng hay giảm, và lãi/lỗ{ sau phí}. Cột "Giá" chỉ so giá bán với giá mua, chưa trừ phí. Bấm "↑ Lên bảng nhiệt" để quay lại." |

## D. Kiểm thử chấp nhận

**Unit test** (fixture và "bây giờ" = 13/11/2026 10:50, phí 0,3%, như mục 9.1 đặc tả). Với ô TCB `DP-CP` T2 → T4:
- Có 8 dòng. Dòng đầu: mua 21/09 giá 21,30, bán 23/09 giá 22,07, "▲ Tăng", +3,60%.
- Dòng tóm tắt khớp với số đếm thật từ 8 lệnh (số lần tăng, giảm, đứng giá). Phần "Lãi sau phí 6/8" khớp đúng ô.
- Thêm một ca có giá bán bằng giá mua (tự tạo dữ liệu nhỏ trong test) → hiện "= Đứng giá", và dòng tóm tắt có phần "đứng giá".

**Trên máy thật:**
- Bấm ô ở bảng nhiệt đầu tiên → màn hình cuộn tới bảng chi tiết của đúng ô đó. Bấm "↑ Lên bảng nhiệt" → quay về đúng bảng.
- Bấm một dòng top 10 → cuộn tới bảng chi tiết.
- Nhấn giữ ô → hiện popup, không cuộn.
