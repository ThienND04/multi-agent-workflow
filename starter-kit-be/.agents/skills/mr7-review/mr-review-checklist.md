# Checklist cho mr7-review (Stage 3 đến 11)

File này do kit viết, vì `SKILL.md` gốc tham chiếu nó nhưng bản gốc không kèm. Mỗi mục là một câu hỏi: trả lời "không" ở chỗ có trong diff thì ghi finding. Mức độ theo `SKILL.md` (CRITICAL, WARNING, INFO). Ngôn ngữ: mục chung áp dụng cho mọi unit; mục riêng ghi rõ NestJS, Express, Go. Quy ước riêng của dự án ở `workflow/stack/<unit>.md` (mục b, d) áp thêm.

## Stage 3: Code (Clean Code)
- Tên nói rõ ý; boolean bắt đầu `is`/`has`; hàm làm một việc, ngắn, ít tầng lồng (guard clause); không quá 3 tham số.
- Không magic number/string, không code gỡ lỗi (`console.log`, `fmt.Println` tạm), không code chết hay bị comment, không đoạn làm dở.
- Comment giải thích VÌ SAO, không nhắc lại WHAT.
- Lỗi: không nuốt lỗi (`catch` rỗng, `_ = err`), exception hay error cụ thể, có ngữ cảnh.
- TypeScript: không `any`, `unknown`. Go: không `any`/`interface{}` khi có kiểu cụ thể, lỗi trả về luôn được xử lý. Node thuần: theo `workflow/stack/<unit>.md` mục d.

## Stage 4: Architecture
- Controller/handler không bỏ qua service để gọi thẳng DB; service không phụ thuộc vòng; side-effect (gửi mail, ghi file, gọi ngoài) không nằm ở lớp sai.
- NestJS: module khai báo đủ providers/imports; DTO validate (zod hay class-validator) ở biên; không import chéo module qua đường dẫn nội bộ.
- Express: route chỉ ghép middleware và controller; middleware xử lý lỗi đặt cuối; thứ tự middleware đúng (auth trước route cần bảo vệ).
- Go: gói tách theo trách nhiệm; không import vòng; interface định nghĩa phía người dùng; `context.Context` đi qua mọi lời gọi I/O.

## Stage 5: Security
- Đầu vào ngoài (body, query, params, header, file upload) được validate, có giới hạn độ dài và kích thước.
- Truy vấn tham số hoá; không ghép chuỗi vào filter Mongo, SQL, lệnh shell, đường dẫn file.
- Phân quyền kiểm ở server cho mọi endpoint nhạy cảm; không tin ID từ client để truy cập dữ liệu của người khác.
- Không hardcode khoá, mật khẩu, token; không in chúng ra log; không trả trường nhạy cảm (mật khẩu băm, secret) trong response; response lỗi không lộ stack trace.
- Cookie, CORS, JWT: cờ và thời hạn hợp lý; so sánh bí mật bằng hàm an toàn thời gian.

## Stage 6: Performance
- Không N+1 (truy vấn trong vòng lặp); danh sách có phân trang và giới hạn; truy vấn mới có index phù hợp.
- Không I/O đồng bộ trong handler; Go: không rò goroutine, không giữ khoá khi gọi I/O, đóng body và kết nối.
- Cache có hạn dùng, tránh dồn yêu cầu cùng lúc khi cache hết hạn.

## Stage 7: Observability
- Endpoint và job mới có log có cấu trúc (key=value), kèm correlation ID; lỗi có ngữ cảnh.
- Không log PII, token, nội dung bí mật. Không có log ồn trong vòng lặp nóng.
- Health, readiness: không bị chặn bởi rate limit, không phụ thuộc dịch vụ ngoài khi chỉ là liveness.

## Stage 8: API
- Đúng REST: động từ và mã trạng thái (200, 201, 204, 400, 401, 403, 404, 409); lỗi có dạng thống nhất.
- Endpoint mới có tài liệu (Swagger/OpenAPI nếu dự án đang dùng); DTO có giới hạn độ dài; thao tác ghi an toàn khi gọi lặp (idempotent) nếu client có thể thử lại.
- Phân trang, sắp xếp, lọc theo quy ước sẵn có của dự án.

## Stage 9: Testing
- Logic mới có test (unit, integration hoặc e2e); test thật sự kiểm kết quả (có so sánh), không bị `skip`, không chỉ chạy cho có.
- Có ca lỗi và ca biên, không chỉ happy path; thay đổi sửa lỗi có test tái hiện lỗi.
- Test không phụ thuộc thứ tự chạy, không dùng DB hay dịch vụ chung.

## Stage 10: Breaking Change
- Có xoá hoặc đổi tên endpoint, trường response, enum, khoá Redis, topic, collection, cột, biến môi trường bắt buộc không? Có thì CRITICAL, gắn nhãn `breaking-change`.
- Đổi kiểu hay ý nghĩa của trường cũ, siết validate làm client cũ bị từ chối cũng tính.

## Stage 11: Release và vận hành
- Migration an toàn khi chạy khi hệ thống còn phục vụ (thêm trước, xoá sau), có đường lui.
- Cấu hình, biến môi trường, khoá mới được ghi vào tài liệu và có giá trị mặc định an toàn; fail fast khi thiếu ở production.
- Endpoint cho probe (health) không nằm sau rate limit, xác thực hay middleware nặng ở production.
- Job, cron mới: chạy lặp lại an toàn, có giới hạn thời gian, không chạy trùng khi nhiều bản.
