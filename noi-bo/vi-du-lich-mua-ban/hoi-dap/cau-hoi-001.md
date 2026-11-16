# Câu hỏi 001: Máy chưa có Android SDK
- Mục đặc tả: 7
- Có chặn công việc không: Không (M1 – StatsEngine và unit test chạy trên JVM thuần, không cần Android SDK. Nhưng chặn M2 trở đi khi cần build APK.)
- Câu hỏi: Máy hiện không có Android SDK cài đặt (không tìm thấy `ANDROID_HOME`, không có thư mục SDK ở `%LOCALAPPDATA%\Android\Sdk` hay bất kỳ đường dẫn nào khác). Để tiếp tục sang M2 (build app hoàn chỉnh với Room, Retrofit, Jetpack Compose), tôi cần Android SDK. Xin xác nhận một trong hai phương án:
  - A) Chủ dự án tự cài Android SDK (ví dụ: cài Android Studio hoặc chạy `sdkmanager` command-line tools) rồi thông báo đường dẫn.
  - B) Cho phép tôi tải và cài đặt Android command-line tools tự động vào đường dẫn mặc định `C:\Users\<tên-người-dùng>\AppData\Local\Android\Sdk`.

