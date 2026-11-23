# Unit server (TypeScript, NestJS + MongoDB + Redis, pnpm)

> Mẫu đi cùng `nestjs-pnpm.sh`. Chép thành `workflow/stack/<unit>.md`, thay mọi `TODO(…)` bằng kết quả khảo sát (kèm nguồn), xoá dòng này.

## a. Quy ước khác mặc định

- Cấu trúc module `src/modules/<tên>/` (controllers, services, repositories, dto, interfaces, schemas, constants, utils) và DTO zod có `max` cho trường string: theo `workflow/OWNER-RULES.md` phần "Module", áp nguyên cho unit này.
- Tên file, alias import, cách trả lỗi chung (exception filter, mã lỗi) và thứ tự ưu tiên nạp env (`@nestjs/config` / `dotenv` có bị `.slot.<unit>.env` thắng hay không): TODO(QUY_UOC) (nguồn: <file:dòng>).
- Code cũ khác quy ước trên: chỗ nào, giữ hay sửa dần khi chạm tới: TODO(LECH_CODE_CU).

## b. Lens review

Áp thêm khi review (12 stage ở `DECISIONS.md` mục 6). Vi phạm mục d là CRITICAL.
- [ ] Controller mỏng: nhận request, gọi service. Nghiệp vụ ở service, truy cập DB ở repository.
- [ ] Mọi đầu vào ngoài đi qua DTO zod ở biên; trường string có `max`.
- [ ] Lỗi dùng exception cụ thể của Nest (`NotFoundException`, `ConflictException`…), có ngữ cảnh; không `catch` rỗng.
- [ ] Promise luôn được `await` hoặc trả về, không bỏ lửng.
- [ ] Mongo: không truy vấn trong vòng lặp (N+1); trường lọc, sắp xếp mới cần index thì phải hỏi (định dạng dữ liệu).
- [ ] Redis & Queue: key dùng tiền tố/DB theo cấu hình (`REDIS_DB`, `REDIS_KEY_PREFIX`), có TTL khi cache; không dùng `KEYS *` hay `FLUSHALL` trong runtime code.
- [ ] Health probe (`/api/health`) gắn trước auth guard và global rate limiter để kiểm tra sống còn không bị 401/429.
- [ ] Schema có `@ApiProperty(...)` cho trường hiện trên Swagger.
- [ ] Không log token, mật khẩu, PII; log key=value có correlation ID.
- [ ] Logic mới có test (service mock repository).

## c. Kiểm thật

- Loại `UNIT_KIND=web-service`, làm theo `DECISIONS.md` mục 3:
  1. `sh workflow/run.sh doctor <wt> <unit>` kiểm tra `UNIT_TOOLS`, trạng thái `SLOT_PORT`, `node_modules`, Mongo và Redis (hỗ trợ cả CLI trên máy lẫn `docker exec`).
  2. `sh workflow/run.sh test <wt> <unit>` xanh (cùng `seed` / `e2e` nếu unit có bật).
  3. `sh workflow/run.sh serve <wt> <unit>` ở nền (`run_in_background`, không `&`; chạy `stack_build` rồi `exec env NODE_ENV=development node dist/main.js`, không `--watch` hay `--inspect`; `run.sh` kiểm cổng rảnh trước và dừng mã 2 nếu đang bận).
  4. Chờ health → `curl` từng tiêu chí → dừng tác vụ nền → `sh workflow/run.sh teardown <wt> <unit>` (xoá DB Mongo và chỉ dọn DB/prefix Redis của slot, tuyệt đối không `FLUSHALL`).
- Cổng: xem `sh workflow/run.sh doctor <worktree> <unit>`, gõ số thẳng vào URL (không dùng `$`). Unit cần cổng phụ (gRPC, metrics, WS) hoặc gọi unit khác cùng slot dùng `slot_port_at <offset>` (`offset < SLOT_STRIDE`).
- Biến môi trường nền & DB:
  - Danh sách biến khởi động bắt buộc (`JWT_SECRET`, …) lấy từ `.env.example` / `.env.sample` / `.env.template` (**tuyệt đối không đọc `.env` thật**) và điền giá trị THỬ trong `stack_slot_env`.
  - Biến unit đọc: `PORT`, `MONGO_URI`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`, `REDIS_KEY_PREFIX` (TODO(TEN_BIEN) nếu tên khác). **Tuyệt đối không dùng `&` trong URI DB**: thêm tham số kết nối thì tách biến riêng (vd `MONGO_AUTH_SOURCE`).
- Quy tắc `curl` (URL đứng ngay sau `curl` hoặc `-X <METHOD>`; cờ `-H`, `-G`, `-d` đặt **SAU URL**; **cấm `&`** kể cả trong dấu nháy):
  - Health: `curl http://localhost:<cổng>/api/health -i` → 200.
  - GET có nhiều query params (dùng `-G -d` sau URL): `curl http://localhost:<cổng>/api/items -G -d "page=1" -d "limit=20"`.
  - POST JSON: `curl -X POST http://localhost:<cổng>/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"password123"}' -i`.
- Endpoint chính: TODO(ENDPOINTS) (ví dụ `POST /api/auth/login`, `GET /api/orders`).
- Tài khoản thử: TODO(TAI_KHOAN_THU) (seed hay endpoint đăng ký, trên DB của slot). Token lấy từ endpoint đăng nhập rồi dán nguyên vào lệnh sau.
- Swagger: TODO(SWAGGER_PATH) (nếu có).
- Mongo & Redis dev: TODO(MONGO_REDIS_DEV) (chạy trên máy hay Docker container `u_mongo_container`/`u_redis_container`, cổng mapping). Không có dịch vụ thì ghi rõ lý do, không ghi "đạt".
- Seed / E2E (nếu bật): TODO(MIGRATE_SEED_E2E).
- Nếu dự án có unit `worker` (BullMQ/Kafka/cron): đặt `UNIT_KIND=worker`; worker chạy dài hạn kiểm thật qua `run.sh serve` ở nền + đẩy job/message thử vào queue/topic mang `${SLOT_NAME}:` / `KAFKA_GROUP_ID=<app>_$SLOT_NAME`, đối chiếu log/DB/health rồi dừng nền; chỉ dùng `run.sh smoke` cho worker chạy một lần có giới hạn (`--once`/drain + timeout).

## d. Kiểu lỏng (TypeScript)

| Cấm | Dùng thay | Ngoại lệ |
|---|---|---|
| `any`, kể cả `as any`, `any[]`, `Record<string, any>` | Kiểu cụ thể, generic `<T>`, union, `z.infer<typeof schema>` | Không có |
| `unknown` | Parse bằng zod ra DTO có kiểu; type guard trả kiểu cụ thể. `catch (error)` không ghi kiểu, thu hẹp bằng `instanceof` | Không có |
| Lách kiểm kiểu: `@ts-ignore`, ép `as` sang kiểu không liên quan | Sửa kiểu cho đúng | Hỏi Master, ghi lý do cạnh dòng đó |
