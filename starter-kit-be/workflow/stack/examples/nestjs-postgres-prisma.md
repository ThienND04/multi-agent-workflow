# Unit server (TypeScript, NestJS + PostgreSQL + Prisma + Redis, pnpm)

> Mẫu đi cùng `nestjs-postgres-prisma.sh`. Chép thành `workflow/stack/<unit>.md`, thay mọi `TODO(…)` bằng kết quả khảo sát (kèm nguồn), xoá dòng này.

## a. Quy ước khác mặc định

- Cấu trúc module `src/modules/<tên>/` (controllers, services, repositories, dto, interfaces, constants, utils) và DTO zod có `max` cho trường string: theo `workflow/OWNER-RULES.md` phần "Module"; lớp `repositories/` bọc `PrismaService` thay cho schema Mongo, schema dữ liệu đặt tại `prisma/schema.prisma`.
- Tên file, alias import, cách trả lỗi chung (exception filter ánh xạ mã lỗi Prisma như `P2002` → 409, `P2025` → 404), và thứ tự ưu tiên nạp env (`@nestjs/config` / `dotenv` có bị `.slot.<unit>.env` thắng hay không): TODO(QUY_UOC) (nguồn: <file:dòng>).
- Code cũ khác quy ước trên: chỗ nào, giữ hay sửa dần khi chạm tới: TODO(LECH_CODE_CU).

## b. Lens review

Áp thêm khi review (12 stage ở `DECISIONS.md` mục 6). Vi phạm mục d là CRITICAL.
- [ ] Controller mỏng: nhận request, gọi service. Nghiệp vụ ở service, truy vấn Prisma gói trong repository (không gọi `PrismaService` trực tiếp từ controller).
- [ ] Mọi đầu vào ngoài (body, query, params) đi qua DTO zod ở biên; trường string có `max`, số phân trang có giới hạn trên.
- [ ] **Prisma / SQL Transaction & An toàn dữ liệu:**
  - [ ] Thao tác ghi nhiều bảng hoặc đọc-rồi-ghi phụ thuộc nhau phải bọc trong `prisma.$transaction(...)`; giữ transaction ngắn, không gọi HTTP ngoài hay đẩy queue/gửi mail bên trong transaction.
  - [ ] Không ghép chuỗi vào `$queryRawUnsafe` / `$executeRawUnsafe`; chỉ dùng `$queryRaw` tagged template hoặc API tham số hoá của Prisma.
  - [ ] Cập nhật tránh race condition (kiểm tra điều kiện ở `where` trong `updateMany`/`deleteMany`, `upsert`, hoặc mức cô lập phù hợp).
- [ ] **Prisma / SQL N+1 & Hiệu năng:**
  - [ ] Không gọi truy vấn Prisma trong vòng lặp (`for`, `map`, `Promise.all` theo từng bản ghi) — gom bằng `include`, `select`, `where: { id: { in: [...] } }`, hoặc `createMany`.
  - [ ] Dùng `select` / `omit` rõ ràng, không trả thừa cột nhạy cảm (`passwordHash`, secret, token).
  - [ ] Danh sách luôn có phân trang (`take`/`skip` hoặc cursor) và sắp xếp ổn định; cột lọc/sắp xếp mới trong `schema.prisma` có `@@index` phù hợp.
  - [ ] Migration an toàn khi chạy song song (thêm trước, xoá sau; chú ý lock bảng khi thêm cột `NOT NULL` không default).
- [ ] **Redis & Queue (nếu dùng):** mọi key có tiền tố `${REDIS_KEY_PREFIX}` / DB theo slot và TTL; không dùng `KEYS *` hay `FLUSHALL`; job BullMQ/Kafka có tính idempotent, timeout và dùng `REDIS_KEY_PREFIX` / `KAFKA_GROUP_ID` theo slot.
- [ ] Health probe (`/api/health`) gắn trước auth guard và global rate limiter để kiểm tra sống còn không bị 401/429.
- [ ] Lỗi dùng exception cụ thể của Nest (`NotFoundException`, `ConflictException`…), có ngữ cảnh; không `catch` rỗng; Promise luôn được `await` hoặc trả về.
- [ ] Schema/DTO có `@ApiProperty(...)` cho trường hiện trên Swagger; không log token, mật khẩu, PII; log `key=value` có correlation ID.
- [ ] Logic mới có unit test (service mock repository) và e2e test khi đụng DB/migration.

## c. Kiểm thật

- Loại `UNIT_KIND=web-service`, làm theo `DECISIONS.md` mục 3:
  1. `sh workflow/run.sh slot <wt> <unit> <n>` → `setup` → `migrate` → `seed` (tạo DB `<app>_s<n>`, chạy `prisma migrate deploy` + `prisma generate`, nạp dữ liệu thử).
  2. `sh workflow/run.sh doctor <wt> <unit>` kiểm tra `UNIT_TOOLS`, trạng thái `SLOT_PORT`, `node_modules`, `.prisma/client`, Postgres và Redis (hỗ trợ cả CLI trên máy lẫn `docker exec`).
  3. `sh workflow/run.sh test <wt> <unit>` xanh (và `sh workflow/run.sh e2e <wt> <unit>` nếu dự án có suite e2e).
  4. `sh workflow/run.sh serve <wt> <unit>` ở nền (`run_in_background`, không `&`; chạy `stack_build` rồi `exec env NODE_ENV=development node dist/main.js`, không `--watch`/`--inspect`; `run.sh` kiểm `SLOT_PORT` rảnh trước và dừng mã 2 nếu đang bận).
  5. Chờ health → gọi `curl` từng tiêu chí → dừng tác vụ nền → `sh workflow/run.sh teardown <wt> <unit>` (chạy `dropdb --if-exists` và chỉ dọn DB/prefix Redis của slot, tuyệt đối không `FLUSHALL`).
- Cổng: xem `sh workflow/run.sh doctor <wt> <unit>`, gõ số thẳng vào URL (không dùng `$`). Unit cần nhiều cổng (HTTP + gRPC/metrics/WS) hoặc gọi unit khác cùng slot dùng `slot_port_at <offset>` (`offset < SLOT_STRIDE`).
- Biến môi trường nền & DB:
  - Danh sách biến khởi động bắt buộc (`JWT_SECRET`, …) lấy từ `.env.example` / `.env.sample` / `.env.template` (**tuyệt đối không đọc `.env` thật**) và điền giá trị THỬ trong `stack_slot_env`.
  - **Tuyệt đối không dùng `&` trong URI DB**: tham số Postgres tách thành biến riêng (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGSSLMODE`, `PGCONNECT_TIMEOUT`).
  - Redis theo slot: `REDIS_DB=$SLOT` (`0..15`) hoặc `REDIS_KEY_PREFIX=${SLOT_NAME}:`.
- Quy tắc `curl` (URL đứng ngay sau `curl` hoặc `-X <METHOD>`; cờ `-H`, `-G`, `-d` đặt **SAU URL**; **cấm `&`** kể cả trong dấu nháy):
  - Health: `curl http://localhost:<cổng>/api/health -i` → 200.
  - GET có nhiều query params (dùng `-G -d` sau URL): `curl http://localhost:<cổng>/api/items -G -d "page=1" -d "limit=20"`.
  - POST JSON: `curl -X POST http://localhost:<cổng>/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"password123"}' -i`.
- Endpoint chính: TODO(ENDPOINTS) (ví dụ `POST /api/auth/login`, `GET /api/items`).
- Tài khoản thử: TODO(TAI_KHOAN_THU) (từ `seed` hoặc endpoint đăng ký trên DB của slot). Token lấy từ endpoint đăng nhập rồi dán nguyên vào lệnh sau.
- Swagger: TODO(SWAGGER_PATH) (nếu có).
- Postgres & Redis dev: TODO(POSTGRES_REDIS_DEV) (chạy trên máy hay Docker container `u_pg_container`/`u_redis_container`; user/pass THỬ; quyền `createdb`/`dropdb`). Không có DB/Redis thì ghi rõ lý do, không ghi "đạt".
- Nếu dự án tách unit `worker` (NestJS consumer BullMQ/Kafka, cron): đặt `UNIT_KIND=worker`. Worker chạy dài hạn kiểm thật bằng `sh workflow/run.sh serve <wt> <unit>` ở nền, đẩy job/message thử vào queue/topic có tiền tố `${SLOT_NAME}:` / `KAFKA_GROUP_ID=<app>_$SLOT_NAME`, đối chiếu log nền và DB/queue của slot rồi dừng nền; chỉ dùng `run.sh smoke` cho worker chạy một lần có giới hạn (`--once`/drain + timeout tự thoát).

## d. Kiểu lỏng (TypeScript)

| Cấm | Dùng thay | Ngoại lệ |
|---|---|---|
| `any`, kể cả `as any`, `any[]`, `Record<string, any>` | Kiểu cụ thể, generic `<T>`, union, `z.infer<typeof schema>`, kiểu sinh từ Prisma (`Prisma.<Model>GetPayload<...>`) | Không có |
| `unknown` | Parse bằng zod ra DTO có kiểu (kể cả cột `Prisma.JsonValue`); type guard trả kiểu cụ thể. `catch (error)` không ghi kiểu, thu hẹp bằng `instanceof` (`Prisma.PrismaClientKnownRequestError`) | Không có |
| Lách kiểm kiểu: `@ts-ignore`, ép `as` sang kiểu không liên quan | Sửa kiểu cho đúng | Hỏi Master, ghi lý do cạnh dòng đó |
