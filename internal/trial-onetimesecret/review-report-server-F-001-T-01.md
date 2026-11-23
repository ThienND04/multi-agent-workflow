# Báo Cáo Rà Soát Merge Request

Nhánh: F-001/T-01 (commit `92477dc`) · Base: `master` (merge-base `1991f2a`) · 5 file, +41/-6

## 1. Tóm Tắt Phạm Vi Ảnh Hưởng

Thêm endpoint liveness `GET /api/health` (trả `200 {"status":"ok"}`, không auth, không chạm DB), đăng ký trong `routes/index.js`, thêm `jest.config.js`, script `test:cov` và một test supertest. Chỉ ảnh hưởng tầng routing của `server` (Express). Không đụng DB, cache, event. Ngoài ra `routes/index.js` có chỉnh format (bỏ dấu phẩy cuối, thêm `;`, newline cuối file).

Ghi chú giới hạn: không đọc được `mr-review-checklist.md` (bị chặn quyền), nên Stage 3–11 được đánh giá theo mô tả của từng stage trong SKILL.md. Không chạy test vì `node_modules` chưa được cài trong worktree.

## 2. Tổng Hợp Trạng Thái Các Stage

| Stage | Trạng thái | Lý do |
|---|---|---|
| 1 Spec Review | WARNING | Diff không đổi spec nào; chưa có spec F-001 để đối chiếu nghiệp vụ (chưa đọc `workflow/`). |
| 2 Impact Analysis | PASS | Chỉ thêm route mới trong `routes/index.js`; không ảnh hưởng route cũ. |
| 3 Code Review | PASS | Code ngắn, rõ; `httpStatus.default.OK` đúng quy ước repo (`middlewares/auth.js:33`). |
| 4 Architecture | PASS | Route độc lập, không gọi controller/service/DB, đúng với mục đích liveness. |
| 5 Security | PASS | Endpoint công khai chỉ trả `{status:'ok'}`, không lộ thông tin nội bộ. |
| 6 Performance | PASS | Handler đồng bộ, không I/O. |
| 7 Observability | PASS | Health check không cần log/metric riêng (morgan đã log request ở non-prod). |
| 8 API Review | PASS | Status code và JSON hợp lý; thiếu Swagger là INFO. |
| 9 Testing | PASS | Có test cho endpoint mới; mới có happy path. |
| 10 Breaking Change | PASS | Không xoá/đổi tên endpoint, field, enum nào. |
| 11 Release & Operations | WARNING | `/api/health` nằm sau `rateLimiter` toàn cục ở production, probe có thể bị 429. |
| 12 Report | PASS | Báo cáo này. |

## 3. Chi Tiết Phát Hiện Review

### Stage 1 – Spec
- **Mức Độ**: WARNING
- **Vị Trí**: toàn diff (không có file spec trong diff)
- **Tác Động**: Chưa xác minh được tính đúng nghiệp vụ so với yêu cầu F-001/T-01.
- **Đề Xuất Sửa**: Đối chiếu với `workflow/F-001-*/SPEC.md` và file việc T-01.

### Stage 11 – Release & Operations
- **Mức Độ**: WARNING
- **Vị Trí**: `server/src/app.js:34-38` (ngữ cảnh) + `server/src/routes/index.js:17-20` (route mới)
- **Tác Động**: Ở production `rateLimiter` áp dụng cho mọi `/api` (mặc định 100 request / 15 phút / IP, `config.js:84-88`). Probe liveness/readiness của k8s hoặc load balancer gọi định kỳ từ cùng IP sẽ vượt ngưỡng, nhận 429, và pod có thể bị restart sai.
- **Đề Xuất Sửa**: Mount `/api/health` trước `app.use(rateLimiter)`, hoặc dùng `skip` trong `rateLimit({ skip: (req) => req.path === '/health' })`.

### Stage 8 – API
- **Mức Độ**: INFO
- **Vị Trí**: `server/src/routes/healthRoute.js:6`
- **Tác Động**: Endpoint chưa có tài liệu Swagger trong khi dự án có `docsRoute`.
- **Đề Xuất Sửa**: Thêm JSDoc `@swagger` hoặc cập nhật file OpenAPI nếu hợp đồng API cần liệt kê.

### Stage 9 – Testing
- **Mức Độ**: INFO
- **Vị Trí**: `server/tests/health.test.js:5-11`
- **Tác Động**: Test import toàn bộ `app` nên nạp config, cloudinary, logger. Chưa có test chứng minh endpoint không chạm DB, và chưa xác nhận test chạy được (chưa cài dependency).
- **Đề Xuất Sửa**: Chạy `sh workflow/run.sh test <worktree> server` sau khi cài dependency để xác nhận xanh.

### Stage 3 – Clean Code
- **Mức Độ**: INFO
- **Vị Trí**: `server/src/routes/index.js:10-39`
- **Tác Động**: Các thay đổi format (dấu phẩy cuối, `;`) không liên quan tới tính năng, làm diff nhiễu.
- **Đề Xuất Sửa**: Tách thành commit format riêng hoặc bỏ nếu không cần.

Các stage còn lại: Không có vấn đề.

## 4. Điểm Đánh Giá

Kiến Trúc 10/10
Bảo Mật 10/10
Hiệu Năng 5/10 (rate limiter áp lên health probe)
Quan Sát Hệ Thống 10/10
Kiểm Thử 8/10
Clean Code 8/10

**Điểm Tổng:** 8.5/10

## 5. Kết Luận Cuối Cùng

**PASS WITH WARNINGS**

## 6. Hướng Dẫn Khắc Phục Và Cải Thiện

Ưu tiên xử lý WARNING ở Stage 11: loại `/api/health` khỏi rate limiter trước khi gắn probe (thư mục `server/k8s/` đang untracked, có thể sẽ dùng endpoint này). Sau đó cài dependency và chạy test qua `workflow/run.sh` để xác nhận test xanh.

## 7. Hướng Dẫn Auto-Fix

Nếu Đại ca muốn áp dụng các đề xuất có thể sửa an toàn, hãy prompt: `/auto-fix` hoặc "Áp dụng các đề xuất từ báo cáo". Auto-fix không tự sửa breaking change, API contract hay hành vi liên quan bảo mật nếu chưa được xác nhận rõ ràng.
