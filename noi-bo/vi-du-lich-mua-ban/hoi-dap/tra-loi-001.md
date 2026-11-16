Trạng thái: Đã trả lời

# Trả lời câu hỏi 001: Máy chưa có Android SDK

**Chủ dự án chọn phương án B: bạn được tự cài**, kèm JDK vì máy cũng chưa có Java (đã kiểm tra: không có lệnh `java`, `JAVA_HOME` rỗng). Chỉ cài đúng những gì liệt kê dưới đây.

## Được phép cài

1. **JDK 17: Eclipse Temurin**, bản ZIP cho Windows x64.
   - Chỉ tải từ trang chính thức: `adoptium.net` / `github.com/adoptium`.
   - Giải nén vào `C:\Users\<tên-người-dùng>\AppData\Local\Programs\Temurin\jdk-17`. Không dùng bộ cài MSI, không cần quyền quản trị.
2. **Android SDK command-line tools**.
   - Chỉ tải từ `developer.android.com` / `dl.google.com`.
   - Đặt tại `C:\Users\<tên-người-dùng>\AppData\Local\Android\Sdk\cmdline-tools\latest`.
3. Qua `sdkmanager`, chỉ cài các gói cần để build: `platform-tools`, `platforms;android-<targetSdk>`, `build-tools;<bản tương ứng>`.
   - Chấp nhận giấy phép SDK của Google (`sdkmanager --licenses`) là được phép.
   - **Không** cài emulator hay system image. App sẽ được chạy thử trên điện thoại thật.

## Không được làm

- Không sửa biến môi trường hệ thống hay registry.
  - Đặt `JAVA_HOME` / `ANDROID_HOME` trong phiên dòng lệnh, trong `android/local.properties` (`sdk.dir=...`), hoặc qua `org.gradle.java.home` trong `android/gradle.properties`.
  - Biến môi trường người dùng (User env) cũng không sửa.
- Không cài thêm phần mềm nào khác ngoài danh sách trên. Cần thêm thì đặt câu hỏi mới.

## Sau khi cài

Ghi vào `TIEN-DO.md`: phiên bản JDK, phiên bản SDK, các gói đã cài và đường dẫn. Ghi thêm cách người khác dùng lại môi trường này để build (lệnh Gradle đầy đủ).
