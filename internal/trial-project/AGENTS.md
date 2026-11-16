# Hướng dẫn luồng công việc cho AI

Bạn là AI được giao **góp ý** hoặc **xây dựng** ứng dụng Android "Lịch mua bán". Đọc hết file này trước khi làm bất cứ việc gì. File này áp dụng cho mọi AI (Claude, ChatGPT/Codex, Gemini, Cursor, Copilot, …).

## 1. Ai làm gì

| Vai trò | Là ai | Việc |
|---|---|---|
| **Chủ dự án** | Người dùng | Quyết định mọi yêu cầu. Là người duy nhất được thay đổi phạm vi. |
| **Điều phối** | Một phiên Claude theo dõi thư mục này | Trả lời câu hỏi, cập nhật đặc tả, chuyển câu hỏi cần quyết định cho chủ dự án. **Không tự quyết thay chủ dự án.** |
| **Bạn** (AI thực hiện) | AI đang đọc file này | Góp ý đặc tả, hoặc xây dựng app đúng theo đặc tả. |

Bạn không liên lạc trực tiếp với chủ dự án hay Điều phối. **Mọi trao đổi đều qua file trong thư mục này** (mục 4, 5).

## 2. Các file và ai được sửa

| Đường dẫn | Nội dung | Ai được sửa |
|---|---|---|
| `AGENTS.md` | File này | Điều phối |
| `README.md` | Giới thiệu thư mục | Điều phối |
| `SPEC-lich-mua-ban-android.md` | **Đặc tả. Luôn là bản đúng nhất.** Mục 11 là lịch sử thay đổi. | Điều phối |
| `reference/stats-reference.js` | Bản cài đặt tham chiếu (JavaScript) của thuật toán | Điều phối |
| `fixtures/*.json` | Dữ liệu giá thật dùng cho kiểm thử | Không ai sửa |
| `hoi-dap/cau-hoi-NNN.md` | Câu hỏi | **Bạn** (chỉ tạo mới, không sửa file đã gửi) |
| `hoi-dap/tra-loi-NNN.md` | Câu trả lời | Điều phối |
| `REVIEW.md` | Kết quả góp ý đặc tả | **Bạn** (chỉ khi được giao góp ý) |
| `loi/LOI-NNN.md` | Báo lỗi gửi cho bạn (mục 6b) | Điều phối |
| `yeu-cau/YC-NNN-*.md` | Yêu cầu tính năng mới đã được chủ dự án duyệt (mục 6c) | Điều phối |
| `TIEN-DO.md` | Nhật ký tiến độ xây dựng | **Bạn** |
| `android/` | Mã nguồn app | **Bạn** |

Không tạo file nào khác ở thư mục gốc có chữ "review" trong tên (trừ `REVIEW.md`). File như vậy sẽ bị xử lý tự động như một bản góp ý.

## 3. Khởi động (mỗi lần bắt đầu làm việc)

1. Đọc `AGENTS.md` (file này), rồi `README.md`.
2. Đọc `SPEC-lich-mua-ban-android.md`. Nếu đây không phải lần đầu, xem **mục 11 "Lịch sử thay đổi"** để biết điều gì mới.
3. Đọc mọi file `hoi-dap/tra-loi-*.md`, nhất là những file đã đổi từ "Đang chờ chủ dự án" sang "Đã trả lời".
4. Nếu đang xây dựng, đọc `TIEN-DO.md` để biết đã làm tới đâu.
5. Đọc mọi file `loi/LOI-*.md` có `Trạng thái: Cần sửa`. **Sửa lỗi trước mọi việc khác** (mục 6b).
6. Đọc mọi file `yeu-cau/YC-*.md` có `Trạng thái: Cần làm`. Làm sau khi đã hết lỗi cần sửa (mục 6c). Bỏ qua file có trạng thái "Nháp".
7. Chạy `node reference/stats-reference.js` để thấy kết quả đúng mà app phải đạt.

## 4. Luồng A: góp ý đặc tả

1. Đọc kỹ đặc tả, đối chiếu với `reference/stats-reference.js`.
2. Tìm chỗ: sai (logic, quy định chứng khoán Việt Nam như giờ phiên, T+2, phí, thuế), mơ hồ, còn thiếu, hoặc mâu thuẫn.
3. Viết **một file** `REVIEW.md` ở thư mục gốc. Viết xong toàn bộ rồi mới lưu. Mỗi góp ý theo mẫu:

```markdown
### [Mức độ: Nghiêm trọng | Vừa | Nhỏ] Tiêu đề ngắn
- Mục: (ví dụ 5.1)
- Vấn đề: ...
- Đề xuất sửa: ...
```

4. Không sửa đặc tả. Điều phối sẽ xử lý từng góp ý: sửa đặc tả, giải thích lý do không sửa, hoặc hỏi chủ dự án. Kết quả nằm ở `hoi-dap/phan-hoi-gop-y-NNN.md` và mục 11 của đặc tả. Lần góp ý sau: ghi đè `REVIEW.md` bằng bản mới.

## 5. Hỏi khi chưa rõ (dùng trong cả hai luồng)

**Nguyên tắc: không tự đoán.** Gặp chỗ đặc tả mơ hồ, mâu thuẫn, hoặc không nói tới, thì hỏi. Đừng tự chọn một cách rồi làm tiếp như thể đó là yêu cầu.

1. Tạo file mới `hoi-dap/cau-hoi-NNN.md`, với NNN là số tiếp theo (001, 002, …). Một file cho một câu hỏi hoặc một nhóm câu hỏi liên quan. Viết xong rồi mới lưu.
2. Mẫu:

```markdown
# Câu hỏi NNN: tiêu đề ngắn
- Mục đặc tả: (ví dụ 4.2)
- Có chặn công việc không: Có | Không
- Câu hỏi: ...
- Phương án bạn đề xuất (nếu có): A) ... B) ...
```

3. Câu trả lời sẽ có ở `hoi-dap/tra-loi-NNN.md`. Dòng đầu cho biết trạng thái:
   - `Trạng thái: Đã trả lời` → làm theo. Nếu yêu cầu thay đổi, đặc tả cũng đã được sửa.
   - `Trạng thái: Đang chờ chủ dự án` → chưa có quyết định. Tạm làm phần khác, kiểm tra lại sau.
4. Trong lúc chờ: nếu câu hỏi **không chặn**, làm tiếp phần khác. Nếu **chặn**, ghi vào `TIEN-DO.md` là đang chờ câu hỏi NNN, rồi làm việc khác không phụ thuộc vào nó.
5. Muốn hỏi thêm về cùng chủ đề: tạo file câu hỏi mới và nhắc số câu hỏi cũ. Không sửa file cũ.

## 6. Luồng B: xây dựng ứng dụng

Làm trong thư mục `android/`. Đi theo từng mốc, mốc sau chỉ bắt đầu khi mốc trước đạt.

| Mốc | Nội dung | Đạt khi |
|---|---|---|
| **M1** | Tạo project (Kotlin, Compose, Material 3; mục 7). Viết `StatsEngine` thuần Kotlin (mục 3, 4.2, 5). | Unit test mục 9.1 và 9.2 chạy bằng `fixtures/` và **cho đúng các số trong đặc tả**. |
| **M2** | Tầng dữ liệu: `PriceSource` gọi API, Room cache, tải lại cả cửa sổ mỗi lần làm mới (mục 3, 4). | Mở app có mạng thì tải được. Tắt mạng thì vẫn hiện cache. |
| **M3** | Màn hình chính (mục 6.1, 6.4). | Đủ 9 phần của mục 6.1, đúng định dạng số. |
| **M4** | Danh mục mã (mục 6.3) và Cài đặt (mục 6.2). | Các ca kiểm thử thủ công về thêm/xoá mã ở mục 9.3 đều đạt. |
| **M5** | Trường hợp biên (mục 8), chế độ tối, xoay màn hình. | Toàn bộ mục 9.3 đạt. |

Quy tắc khi xây dựng:

- Không thêm tính năng ngoài đặc tả (xem mục 10 "Ngoài phạm vi"). Có ý tưởng thì ghi vào câu hỏi, đừng tự làm.
- Kết quả tính toán phải khớp tuyệt đối với `reference/stats-reference.js`. Lệch thì sửa app, không sửa file tham chiếu. Nếu tin rằng file tham chiếu sai thì đặt câu hỏi.
- Không ghi đè hay xoá file ngoài `android/`, `TIEN-DO.md` và `hoi-dap/cau-hoi-*.md`.
- Unit test của `StatsEngine` không chứng minh app mở được. Mỗi `ViewModel` phải có test xác nhận tạo được bằng factory mà `MainActivity` dùng (xem `loi/LOI-001.md`). Trong `TIEN-DO.md`, ghi rõ app **đã** hay **chưa** chạy thử trên máy thật.

## 6b. Sửa lỗi được báo

Khi chủ dự án dùng thử app và gặp lỗi, Điều phối sẽ điều tra rồi viết `loi/LOI-NNN.md`, gồm: hiện tượng, nguyên nhân (nếu đã xác định), yêu cầu sửa.

1. Lỗi có `Trạng thái: Cần sửa` được ưu tiên trên mọi việc khác.
2. Làm đúng các bước trong mục "Yêu cầu sửa". Mỗi lỗi phải có ít nhất một test chống tái phát, trừ khi file lỗi nói khác.
3. Nếu nguyên nhân ghi trong file có vẻ sai hoặc chưa đủ, đặt câu hỏi qua `hoi-dap/` (mục 5). Đừng tự sửa theo hướng khác.
4. Xong thì thêm mục lên đầu `TIEN-DO.md`, tiêu đề có mã lỗi (ví dụ `LOI-001`). **Không sửa file lỗi.** Điều phối sẽ kiểm tra lại rồi đổi trạng thái sang `Đã sửa` hoặc ghi thêm vấn đề còn lại.

## 6c. Làm yêu cầu tính năng mới

Tính năng mới do chủ dự án đề ra nằm trong `yeu-cau/YC-NNN-*.md`. Đặc tả có mục trỏ tới file đó, và file đó là một phần của đặc tả.

1. Chỉ làm file có `Trạng thái: Cần làm`. File "Nháp" là chủ dự án chưa duyệt, không làm.
2. **Giữ đúng câu chữ** hiển thị cho người dùng như trong file. Muốn đổi câu nào thì đặt câu hỏi qua `hoi-dap/`.
3. Làm đủ mục "Kiểm thử chấp nhận" trong file. Phần chạy được trên JVM thì viết unit test. Phần cần thiết bị thì ghi rõ "chưa kiểm tra trên máy thật" trong `TIEN-DO.md`.
4. Không phá kết quả cũ: `testDebugUnitTest` phải vẫn đạt toàn bộ.
5. Xong thì build lại `assembleDebug`, rồi thêm mục lên đầu `TIEN-DO.md` với tiêu đề có mã yêu cầu (ví dụ `YC-001`). Ghi đã làm gì, kết quả test, thời gian build APK. **Không sửa file yêu cầu.** Điều phối kiểm tra lại rồi đổi trạng thái.

## 7. Báo cáo tiến độ: `TIEN-DO.md`

Cập nhật sau mỗi buổi làm việc và mỗi khi xong một mốc. Thêm mục mới lên **đầu** file:

```markdown
## 2026-11-14 — M1 đang làm
- Đã xong: ...
- Kết quả kiểm thử: (dán tóm tắt, ví dụ "9.1: 6/6 đạt, 9.2: 3/3 đạt")
- Đang chờ câu hỏi: 003 (chặn phần ...)
- Việc tiếp theo: ...
```

## 8. Bàn giao

Khi xong M5, thêm vào đầu `TIEN-DO.md` mục "Bàn giao" ghi:

- Cách build (lệnh Gradle) và đường dẫn file APK.
- Cách chạy unit test, và kết quả lần chạy cuối.
- Danh sách việc còn thiếu hoặc đã biết là chưa đúng (nếu có).
