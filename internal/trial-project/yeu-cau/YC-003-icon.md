Trạng thái: Đã xong
Chủ dự án xác nhận hiển thị ổn trên Samsung Galaxy S22 Ultra ngày 16/11/2026.
Chủ dự án duyệt ngày 13/11/2026, kể cả việc bỏ các số 2–6. File này là một phần của đặc tả (mục 6.7).
Điều phối kiểm tra lại ngày 16/11/2026:
- APK build 13/11 17:16 có `android:icon` và `android:roundIcon`.
- `ic_launcher.xml` đủ 3 lớp background, foreground, monochrome.
- Chưa xem icon trên máy thật.

# YC-003: Icon cho app

**Quyết định của chủ dự án (13/11/2026):** chọn phương án C, "nến theo thứ". Icon gồm 5 cây nến giá ứng với T2–T6 trên nền tối.

**Điều chỉnh so với bản phác thảo** (chủ dự án đã duyệt): bỏ các số 2–6 dưới chân nến. Lý do:
- Ở kích thước icon trên màn hình chính (khoảng 48dp), chữ số chỉ cao khoảng 4dp nên không đọc được.
- Các số nằm ngoài vùng an toàn của icon thích ứng, nên sẽ bị cắt khi launcher bo icon thành hình tròn.

## File có sẵn trong `yeu-cau/YC-003-icon/`

| File | Dùng làm |
|---|---|
| `icon-preview.svg` | Ảnh xem trước (vòng tròn nét đứt chỉ là vạch vùng an toàn, **không** đưa vào app) |
| `ic_launcher_foreground.xml` | Lớp trước (vector 108×108dp) |
| `ic_launcher_monochrome.xml` | Lớp đơn sắc cho icon theo chủ đề (Android 13+) |

## Yêu cầu

1. Chép `ic_launcher_foreground.xml` và `ic_launcher_monochrome.xml` vào `android/app/src/main/res/drawable/`. Giữ nguyên hình.
2. Thêm màu nền `ic_launcher_background` = `#2C2C2A` vào `res/values/colors.xml`.
3. Tạo `res/mipmap-anydpi-v26/ic_launcher.xml` và `ic_launcher_round.xml` (cùng nội dung):
   ```xml
   <adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
       <background android:drawable="@color/ic_launcher_background"/>
       <foreground android:drawable="@drawable/ic_launcher_foreground"/>
       <monochrome android:drawable="@drawable/ic_launcher_monochrome"/>
   </adaptive-icon>
   ```
4. Trong `AndroidManifest.xml`, thêm `android:icon="@mipmap/ic_launcher"` và `android:roundIcon="@mipmap/ic_launcher_round"` vào thẻ `<application>`.
5. Không cần ảnh PNG cho từng độ phân giải, vì `minSdk 26` đã hỗ trợ icon thích ứng.

## Kiểm thử chấp nhận

- Build `assembleDebug` thành công. `apkanalyzer manifest print` cho thấy `android:icon` trỏ tới `@mipmap/ic_launcher`.
- Trên máy thật: icon trên màn hình chính và trong danh sách ứng dụng là 5 cây nến, không bị cắt khi launcher bo tròn hoặc bo vuông.
- Bật "Biểu tượng theo chủ đề" (Android 13+, nếu máy hỗ trợ): icon đổi sang một màu theo hình nền mà vẫn rõ 5 cây nến.
