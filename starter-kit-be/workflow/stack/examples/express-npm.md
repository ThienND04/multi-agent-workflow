# Unit api (JavaScript hoặc TypeScript, Express + PostgreSQL, npm)

> Mẫu đi cùng `express-npm.sh`. Chép thành `workflow/stack/<unit>.md`, thay mọi `TODO(…)` bằng kết quả khảo sát (kèm nguồn), xoá dòng này.

## a. Quy ước khác mặc định

- Ngôn ngữ: TODO(JS_HAY_TS). JavaScript thuần thì kiểu theo JSDoc nếu dự án đã dùng (nguồn: <file:dòng>).
- Phiên bản Express: TODO(EXPRESS_4_HAY_5). Express 4 không tự bắt promise bị reject trong handler; Express 5 thì có.
- Bố cục thư mục (routes, controllers, services, middlewares), thư viện validate đầu vào, cách trả lỗi chung và thứ tự ưu tiên nạp env (`dotenv` không ghi đè biến slot đã nạp từ `run.sh`): TODO(QUY_UOC) (nguồn: <file:dòng>).
- Nếu dự án dùng `pnpm` thay cho `npm`: đổi `npm --prefix "$UNIT_DIR"` thành `pnpm --dir "$UNIT_DIR"` (`install --frozen-lockfile` ở `stack_setup`), và bỏ `--` trong `stack_test` (`pnpm --dir "$UNIT_DIR" run test:cov --maxWorkers=2`, theo `workflow/stack/README.md` mục 4).

## b. Lens review

Áp thêm khi review (12 stage ở `DECISIONS.md` mục 6). Vi phạm mục d là CRITICAL.
- [ ] Mọi `req.body`, `req.params`, `req.query` được validate bằng thư viện của dự án trước khi dùng; chuỗi có giới hạn độ dài.
- [ ] Express 4: lỗi trong handler async được chuyển cho `next(error)`, không để promise reject lửng.
- [ ] Thứ tự middleware đúng: health route (`/health`) đặt trước auth guard và global rate limiter; middleware xác thực đặt trước route cần bảo vệ; middleware xử lý lỗi đặt cuối.
- [ ] Mã HTTP đúng (400, 401, 403, 404, 409); response lỗi không lộ stack trace.
- [ ] DB / SQL: truy vấn tham số hoá (`$1`), không ghép chuỗi; giải phóng client/pool đúng cách; bọc transaction khi ghi nhiều bảng phụ thuộc; không truy vấn trong vòng lặp (N+1).
- [ ] Không đọc biến môi trường rải rác: cấu hình gom một chỗ, thiếu thì fail fast lúc khởi động.
- [ ] Không log token, mật khẩu, PII; log key=value có correlation ID.
- [ ] Logic mới có test (Jest/Vitest, supertest cho route nếu dự án đã dùng).

## c. Kiểm thật

- Loại `UNIT_KIND=web-service`, làm theo `DECISIONS.md` mục 3:
  1. `sh workflow/run.sh slot <wt> <unit> <n>` → `setup` → `migrate` → `seed` (cài `node_modules`, tạo DB `<app>_s<n>`, chạy migration/seed nếu unit dùng).
  2. `sh workflow/run.sh doctor <wt> <unit>` kiểm tra `UNIT_TOOLS` (`npm node`), trạng thái `SLOT_PORT`, `node_modules` và Postgres (hỗ trợ cả CLI trên máy lẫn `docker exec` qua `u_pg_container`).
  3. `sh workflow/run.sh test <wt> <unit>` xanh (và `e2e` nếu unit có bật).
  4. `sh workflow/run.sh serve <wt> <unit>` ở nền (`run_in_background`, không `&`; chạy thẳng `exec env NODE_ENV=development node "$UNIT_DIR/$u_entry"`, không dùng `npm run dev` / `--watch` / `--inspect` 9229; `run.sh` kiểm `SLOT_PORT` rảnh trước và dừng mã 2 nếu đang bận).
  5. Chờ health → `curl` từng tiêu chí → dừng tác vụ nền → `sh workflow/run.sh teardown <wt> <unit>` (xoá DB `<app>_s<n>` qua `dropdb --if-exists`).
- Cổng: xem `sh workflow/run.sh doctor <worktree> <unit>`, gõ số thẳng vào URL (không dùng `$`). Unit cần thêm cổng phụ (metrics, WS) hoặc gọi unit khác cùng slot dùng `slot_port_at <offset>` (`offset < SLOT_STRIDE`).
- Biến môi trường nền & DB:
  - Danh sách biến khởi động bắt buộc (`JWT_SECRET`, `SESSION_SECRET`, …) lấy từ `.env.example` / `.env.sample` / `.env.template` (**tuyệt đối không đọc `.env` thật**) và điền giá trị THỬ trong `stack_slot_env`.
  - Biến unit đọc: `PORT`, `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGSSLMODE`, `PGCONNECT_TIMEOUT` (TODO(TEN_BIEN) nếu khác). **Tuyệt đối không dùng `&` trong `DATABASE_URL`**: tham số kết nối tách thành biến riêng (`PGSSLMODE`, `PGCONNECT_TIMEOUT`).
- Quy tắc `curl` (URL đứng ngay sau `curl` hoặc `-X <METHOD>`; cờ `-H`, `-G`, `-d` đặt **SAU URL**; **cấm `&`** kể cả trong dấu nháy):
  - Health: `curl http://localhost:<cổng>/health -i` → 200 (TODO(HEALTH) nếu khác).
  - GET có nhiều query params (dùng `-G -d` sau URL): `curl http://localhost:<cổng>/api/items -G -d "page=1" -d "limit=20"`.
  - POST JSON: `curl -X POST http://localhost:<cổng>/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"password123"}' -i`.
- Endpoint chính: TODO(ENDPOINTS).
- Tài khoản, dữ liệu thử: TODO(TAI_KHOAN_THU) (chỉ giá trị thử của slot).
- Postgres dev: TODO(POSTGRES_DEV) (chạy trên máy hay Docker container `u_pg_container`; user/pass THỬ; quyền `createdb`/`dropdb`). Không có DB thì ghi rõ lý do, không ghi "đạt".
- Nếu dự án tách unit `worker` (queue/cron): đặt `UNIT_KIND=worker`; worker chạy dài hạn kiểm thật qua `run.sh serve` ở nền + đẩy job thử vào queue mang `${SLOT_NAME}:`, đối chiếu log/DB rồi dừng nền; worker chạy một lần có giới hạn (`--once`/drain + timeout) dùng `run.sh smoke`.

## d. Kiểu lỏng

TypeScript:

| Cấm | Dùng thay | Ngoại lệ |
|---|---|---|
| `any`, kể cả `as any`, `Record<string, any>` | Kiểu cụ thể, generic, union, kiểu suy ra từ schema validate | Không có |
| `unknown` | Validate ra kiểu cụ thể; `catch (error)` không ghi kiểu, thu hẹp bằng `instanceof` | Không có |
| `@ts-ignore`, ép `as` để lách | Sửa kiểu | Hỏi Master, ghi lý do |

JavaScript thuần (chỉ khi dự án đã dùng JSDoc):

| Cấm | Dùng thay | Ngoại lệ |
|---|---|---|
| `@type {*}`, `@param {any}`, `{Object}` chung chung | `@typedef` mô tả đúng trường, kiểu cụ thể | Không có |
| Hàm export không có JSDoc khi file đó đã dùng JSDoc | Thêm `@param`, `@returns` | Hàm nội bộ ngắn |
