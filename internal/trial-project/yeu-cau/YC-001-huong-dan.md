Trạng thái: Đã xong
Chủ dự án xác nhận hiển thị ổn trên Samsung Galaxy S22 Ultra ngày 16/11/2026.
Chủ dự án duyệt nội dung ngày 13/11/2026. File này là một phần của đặc tả (mục 6.5).
Câu của sheet "Từng lần mua bán" được thay bởi `YC-004-chi-tiet-o.md` mục C. Khi khác nhau, làm theo YC-004.
Một số câu trong mục B, C (sheet "Cặp tốt nhất", "Bảng xếp hạng", "Cách đọc bảng") được thay hoặc bổ sung bởi `YC-002-loc-thu-gio.md` mục C. Khi khác nhau, làm theo YC-002.

Điều phối kiểm tra lại ngày 13/11/2026 lúc 17:00:
- `testDebugUnitTest --rerun`: 28/28 đạt (StatsEngine 21, GuideContentBuilder 4, MainViewModel 3).
- APK build 16:56:11 có `OnboardingModal`, và vẫn còn constructor `MainViewModel(Application)` (LOI-001 không quay lại).
- Câu chữ trang 1–5 và 8 sheet khớp bản đã duyệt. Có nút ? ở thanh tiêu đề, nút ⓘ gắn đủ 8 phần.
- Chưa kiểm tra trên máy thật: giao diện, chế độ tối, chữ cỡ lớn.

# YC-001: Hướng dẫn sử dụng trong app

**Lý do:** chủ dự án dùng thử và thấy người dùng mới mở app không hiểu các phần trên màn hình.

**Quyết định của chủ dự án (13/11/2026):**
- Có **cả hai dạng**: trang giới thiệu khi mở app lần đầu, và nút ⓘ cạnh từng phần.
- Ví dụ trong hướng dẫn **lấy từ số liệu thật** của mã đang chọn.

Chữ trong `{ngoặc nhọn}` là số liệu thật, lấy lúc hiển thị. Các mẫu câu cố định giữ đúng như viết dưới đây.

---

## A. Trang giới thiệu (lần đầu mở app)

- Hiện ngay khi mở app lần đầu, trước màn hình chính. Lưu cờ `daXemGioiThieu` trong DataStore.
- Gồm 5 trang, trượt ngang. Dưới cùng có chấm chỉ trang, nút **Bỏ qua** (góc trên phải) và nút **Tiếp** (trang cuối là **Bắt đầu**).
- Xem lại được: thanh tiêu đề màn hình chính có nút **?** cạnh nút Cài đặt. Bấm vào thì mở lại 5 trang này.
- Trong lúc người dùng đọc trang 1–2, app vẫn tải dữ liệu ở nền như bình thường.

**Trang 1: App này làm gì**
> **Nên mua và bán vào lúc nào trong tuần?**
> App xem lại giá cổ phiếu trong 8 tuần gần nhất. Với mỗi cách "mua ngày này, bán ngày kia", app đếm xem có bao nhiêu lần lãi. Bạn sẽ thấy cách nào lãi nhiều lần nhất.

**Trang 2: Hai thời điểm mua bán**
> **9:30 và 14:30**
> App chỉ tính giá ở hai thời điểm:
> - **9:30**: ngay sau phiên mở cửa (ATO, 9:00–9:15).
> - **14:30**: ngay trước phiên đóng cửa (ATC, 14:30–14:45).
>
> App không dùng giá của chính phiên ATO và ATC.

**Trang 3: Cách đọc một ô** (ví dụ từ số liệu thật)
- Vẽ đúng một ô của bảng nhiệt, là ô của **cặp tốt nhất** hiện tại (cùng kiểu vẽ với màn hình chính), kèm 3 mũi tên chú thích.
> Ô **{6/8}** ở hàng **{T2}**, cột **{T4}** của bảng **"{Mua 9:30 · Bán 14:30}"**:
> - Trong 8 tuần có **{8}** lần mua **{thứ Hai}** lúc **{9:30}** rồi bán **{thứ Tư}** lúc **{14:30}**.
> - **{6}** lần trong số đó có lãi{ sau phí}.
> - **{+0,96%}** là lãi trung bình mỗi lần{ sau phí}.
>
> Màu **xanh** càng đậm là càng nhiều lần lãi, **đỏ** là ít lần lãi.
- Nếu dữ liệu chưa tải xong: hiện "Đang tải số liệu để làm ví dụ…" và chờ tối đa 10 giây. Hết 10 giây vẫn chưa có (mất mạng, lần đầu cài) thì dùng ví dụ cố định ở trên, ghi rõ dòng nhỏ "Ví dụ minh hoạ, không phải số liệu hiện tại".

**Trang 4: Ô "T+2" và phí**
> **Vì sao có ô ghi "T+2"?**
> Cổ phiếu mua hôm nay phải tới chiều ngày giao dịch thứ 2 sau đó mới về tài khoản. Ô "T+2" là cách mua – bán không làm được vì chưa có cổ phiếu để bán.
>
> **Phí {0,3}%**
> Khi bật "Chỉ tính lệnh lãi sau phí", một lần chỉ được tính là lãi khi lãi hơn {0,3}%, phần đủ trả phí mua, phí bán và thuế. Mức phí đổi được trong Cài đặt.

**Trang 5: Lưu ý**
> **Trước khi dùng kết quả**
> - Đây là thống kê quá khứ. Mỗi ô chỉ có khoảng 8 lần, nên một phiên tăng giảm mạnh cũng làm kết quả thay đổi nhiều.
> - App không phải lời khuyên đầu tư.
> - Thêm mã khác (sàn HOSE) bằng nút **+ Thêm mã**. Bấm **ⓘ** cạnh mỗi phần để xem giải thích.

---

## B. Nút ⓘ cạnh từng phần

- Biểu tượng ⓘ nhỏ (vùng bấm ≥ 48dp) đặt ở cuối tiêu đề mỗi phần dưới đây.
- Bấm vào thì mở **bottom sheet** gồm tiêu đề và nội dung. Vuốt xuống hoặc bấm ra ngoài để đóng.
- Số liệu trong `{}` lấy theo mã và trạng thái công tắc phí hiện tại.

| Vị trí | Tiêu đề sheet | Nội dung |
|---|---|---|
| Dòng "8 tuần … · cập nhật …" | Khoảng thời gian | Thống kê dùng các lần bán nằm trong 8 tuần gần nhất, từ {21/09} đến {13/11/2026}. Sang tuần mới thì tuần cũ nhất được bỏ ra. "Cập nhật {16:21}" là lần cuối tải giá thành công. Kéo màn hình xuống để tải lại. |
| Hàng chọn mã | Danh mục mã | Bấm một mã để xem thống kê của mã đó. Bấm "+ Thêm mã" để thêm mã sàn HOSE, tối đa 10 mã. Nhấn giữ một mã để xoá. |
| Công tắc phí | Lãi sau phí | **Bật:** một lần mua – bán chỉ tính là lãi khi lãi hơn {0,3}%, phần đủ trả phí mua, phí bán và thuế bán. **Tắt:** lãi trên 0% đã tính là lãi. Đổi mức phí trong Cài đặt. |
| Câu kết luận | Cặp tốt nhất | Đây là ô có tỷ lệ lãi cao nhất trong 4 bảng bên dưới. Nếu nhiều ô bằng nhau, ô có lãi trung bình cao hơn đứng trước. Hiện là ô **{6/8}** của bảng **"{Mua 9:30 · Bán 14:30}"**, hàng {T2}, cột {T4}. |
| Tiêu đề mỗi bảng nhiệt (4 bảng dùng chung nội dung) | Cách đọc bảng | Mỗi bảng là một cặp giờ: **giờ mua** và **giờ bán**. **Hàng** là ngày mua, **cột** là ngày bán. Ví dụ: ô hàng {T2}, cột {T4} của bảng "{Mua 9:30 · Bán 14:30}" ghi **{6/8}** và **{+0,96%}**, nghĩa là có {8} lần mua {thứ Hai} lúc {9:30} rồi bán {thứ Tư} lúc {14:30}, {6} lần có lãi, lãi trung bình {+0,96%} mỗi lần. Hàng và cột cùng thứ (ví dụ T2 → T2) là bán vào tuần sau. Ô "T+2": không bán kịp vì cổ phiếu chưa về. Ô "0/0": chưa có lần nào. Bấm một ô để xem từng lần mua bán. Nhấn giữ để xem thêm lãi thấp nhất, cao nhất. |
| Bảng "10 cặp lãi nhiều lần nhất" | Bảng xếp hạng | 10 ô có tỷ lệ lãi cao nhất trong cả 4 bảng. **Số lệnh:** số lần mua – bán. **Lãi:** số lần lãi trên 0%. **Lãi sau phí:** số lần lãi hơn {0,3}%. **Lãi TB:** lãi trung bình mỗi lần. Bấm một dòng để xem từng lần. |
| Bảng "Chi tiết từng lệnh" | Từng lần mua bán | Từng lần mua – bán của ô đang chọn: ngày, giá mua, giá bán (nghìn đồng) và lãi/lỗ{ sau phí}. Xanh là lãi, đỏ là lỗ. |
| Mục "Giá lúc 9:30 và 14:30 từng ngày" | Giá dùng để tính | Giá 9:30 là giá khớp cuối cùng trong 15 phút sau phiên ATO. Giá 14:30 là giá khớp cuối cùng trước phiên ATC. Giá đã điều chỉnh theo cổ tức, chia tách, nên giá những ngày cũ có thể khác giá bạn thấy trên bảng điện lúc đó. "Chưa có" là thời điểm đó chưa tới. |

---

## C. Kiểm thử chấp nhận

- Cài mới → trang giới thiệu hiện ra. Bấm Bỏ qua → vào màn hình chính. Đóng mở lại app → không hiện lại.
- Bấm **?** trên thanh tiêu đề → mở lại 5 trang.
- Trang 3 có dữ liệu → số trong câu khớp đúng với ô cặp tốt nhất trên màn hình chính. Mất mạng khi cài mới → sau 10 giây hiện ví dụ cố định kèm dòng "Ví dụ minh hoạ".
- Mỗi nút ⓘ mở đúng sheet. Đổi mã hoặc bật/tắt công tắc phí rồi mở lại sheet → số liệu đổi theo.
- Chế độ tối và chữ cỡ lớn (Cài đặt hệ thống → cỡ chữ lớn nhất) vẫn đọc được, không bị cắt chữ.
