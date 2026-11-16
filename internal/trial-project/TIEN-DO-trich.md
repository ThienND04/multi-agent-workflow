## 2026-11-16 — YC-004: Bấm ô thì xem ngay danh sách từng lần mua bán
- Đã xong:
  - Tạo lớp thuần Kotlin `TradeDetailsBuilder.kt` dựng tiêu đề phụ (`"{MÃ} · mua {thứ} lúc {giờ}, bán {thứ} lúc {giờ}"`), cột **Giá** (`▲ Tăng`, `▼ Giảm`, `= Đứng giá` so giá bán với giá mua, chưa trừ phí), cột lãi/lỗ theo công tắc phí và dòng tóm tắt (`Giá tăng X lần, giảm Y lần{, đứng giá Z lần} · Lãi{ sau phí} W/N lần`).
  - Cập nhật `MainScreen.kt`:
    - Tách mỗi bảng nhiệt (hoặc hàng 2 bảng trên màn rộng) thành item có khoá riêng trong `LazyColumn` với `rememberLazyListState()`.
    - Bấm ô khả thi (`n > 0`) trên bảng nhiệt hoặc bấm dòng trong bảng Top 10: chọn ô và cuộn mượt tới tiêu đề `"Chi tiết từng lệnh"`. Nhấn giữ xem popup, ô `T+2`, ô `0/0` và khi mới mở app không tự cuộn.
    - Thêm nút chữ **"↑ Lên bảng nhiệt"** ở góc phải tiêu đề `"Chi tiết từng lệnh"` để cuộn mượt về đúng bảng nhiệt chứa ô đang chọn.
    - Cập nhật `TradeDetailsTable`: cố định cột `"Ngày mua"` bên trái, các cột còn lại (`Giá mua`, `Ngày bán`, `Giá bán`, `Giá`, `Lãi/lỗ` / `Lãi/lỗ sau phí`) cuộn ngang trong khung thẻ, và hiển thị dòng tóm tắt ở cuối bảng.
  - Cập nhật câu hướng dẫn sheet `"Từng lần mua bán"` (`GuideSection.TRADE_DETAILS`) trong `GuideContentBuilder.kt` đúng theo `YC-004` mục C.
  - Bổ sung unit test ở `StatsEngineTest.kt` (2 ca mục D kiểm tra `TCB DP-CP T2→T4` 8 dòng, `21,30 → 22,07`, `"▲ Tăng"`, `+3,60%`, dòng tóm tắt `"Lãi sau phí 6/8 lần"` và ca giá bán = giá mua hiện `"= Đứng giá"` + `"đứng giá 1 lần"`) và `GuideContentBuilderTest.kt`.
  - Ghi nhận các yêu cầu `YC-001`, `YC-002`, `YC-003` đã được Điều phối cập nhật trạng thái `Đã xong`.
- Kết quả kiểm thử:
  - `.\gradlew.bat testDebugUnitTest`: **35/35 đạt** (`StatsEngineTest`: 27/27, `GuideContentBuilderTest`: 5/5, `MainViewModelTest`: 3/3; 0 skipped, 0 failures, 0 errors).
  - `.\gradlew.bat assembleDebug`: Build thành công lúc `16/11/2026 09:34:20` (`app-debug.apk`, 10.645.642 bytes).
- Chạy thử trên máy thật: Việc cuộn mượt khi bấm ô/dòng top 10, nút `"↑ Lên bảng nhiệt"`, nhấn giữ không cuộn và cuộn ngang cột bảng chi tiết trên màn hình hẹp **chưa kiểm tra trên máy thật**.

## 2026-11-13 — YC-003: Icon cho app
- Đã xong:
  - Sao chép `ic_launcher_foreground.xml` và `ic_launcher_monochrome.xml` từ `yeu-cau/YC-003-icon/` vào `android/app/src/main/res/drawable/`.
  - Tạo `colors.xml` định nghĩa màu nền `<color name="ic_launcher_background">#2C2C2A</color>`.
  - Tạo `ic_launcher.xml` và `ic_launcher_round.xml` với đầy đủ `<background>`, `<foreground>` và `<monochrome>`.
  - Gắn `android:icon="@mipmap/ic_launcher"` và `android:roundIcon="@mipmap/ic_launcher_round"` trong `AndroidManifest.xml`.
- Kết quả kiểm thử:
  - `.\gradlew.bat assembleDebug`: Build thành công lúc `13/11/2026 17:16:01` (`app-debug.apk`, 10.626.998 bytes).
  - `.\gradlew.bat testDebugUnitTest`: **33/33 đạt** (`StatsEngineTest`: 25/25, `GuideContentBuilderTest`: 5/5, `MainViewModelTest`: 3/3; 0 skipped, 0 failures, 0 errors).
  - `apkanalyzer.bat manifest print`: xác nhận `<application>` có `android:icon="@ref/0x7f080000"` và `android:roundIcon="@ref/0x7f080001"`; `apkanalyzer.bat resources xml --file res/mipmap-anydpi-v26/ic_launcher.xml`: xác nhận `<adaptive-icon>` đủ 3 lớp `<background>`, `<foreground>`, `<monochrome>`.
- Chạy thử trên máy thật: Việc hiển thị icon trên launcher và monochrome themed icon trên Android 13+ **chưa kiểm tra trên máy thật**.


…(đã cắt, chỉ giữ 2 mục gần nhất)
