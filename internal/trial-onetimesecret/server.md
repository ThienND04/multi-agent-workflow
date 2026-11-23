# Unit server (JavaScript CommonJS, Express 5, Mongoose, npm workspaces)

## a. Quy ước khác mặc định

- JavaScript thuần CommonJS, không TypeScript, không JSDoc (nguồn: server/package.json `"type": "commonjs"`, server/src/*). Luật `any`/`unknown` không áp dụng.
- Bố cục: `server/src/{config,controllers,middlewares,models,routes,services,utils,validators}`; validate đầu vào bằng zod ở `validators/`; lỗi dùng `utils/apiError.js` và `middlewares/errorHandler.js`; route gom ở `routes/index.js` (nguồn: README, server/src/app.js).
- Express 5 tự bắt promise reject trong handler; dự án bọc thêm `utils/catchAsync.js` (nguồn: server/src).
- Thông điệp commit: Conventional Commits (nguồn: `git log`: `feat: docker`, `fix(docker): …`).
- Cấu hình nạp bằng dotenv từ `server/.env.<NODE_ENV>` (nguồn: server/src/config/config.js).

## b. Lens review

- [ ] Route mới đăng ký trong `routes/index.js`; `req.body` qua validator zod, chuỗi có `max`.
- [ ] Handler dùng `catchAsync` hoặc để Express 5 bắt lỗi; lỗi trả bằng `ApiError`, không lộ stack.
- [ ] Mongoose: truy vấn tham số hoá, không ghép chuỗi vào filter; không trả trường nhạy cảm (mật khẩu, nội dung bí mật mã hoá).
- [ ] Không log token, mật khẩu, nội dung secret; log qua `config/logger`.
- [ ] Logic mới có test jest/supertest (import `src/app.js`, không `src/index.js`).

## c. Kiểm thật

- Loại `web-service`, theo `DECISIONS.md` mục 3. Cổng xem `sh workflow/run.sh doctor <wt> server`.
- Health: `curl http://localhost:<cổng>/api/health -i` → 200 (F-001 thêm).
- MongoDB: container `ots-agent-mongo` phải đang chạy ở 127.0.0.1:27018 (không có thì báo Master, không tự dựng). Mỗi slot database `ots_s<n>`.
- Khoá cloudinary, SMTP: không có giá trị thật; endpoint cần chúng thì không kiểm thật (ghi `N/A`).
- Tài khoản thử: tự đăng ký qua `POST /api/auth/...` vào database của slot (xem `authRoute.js`).

## d. Kiểu lỏng

JavaScript thuần, dự án không dùng JSDoc: không có luật kiểu lỏng riêng. Giữ tên rõ nghĩa, validate đầu vào ở biên (zod).
