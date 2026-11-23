# Unit api (Go, net/http + PostgreSQL)

> Mẫu đi cùng `go.sh`. Chép thành `workflow/stack/<unit>.md`, thay mọi `TODO(…)` bằng kết quả khảo sát (kèm nguồn), xoá dòng này.

## a. Quy ước khác mặc định

- Phiên bản Go (`go.mod`), bố cục (`cmd/`, `internal/`), router, thư viện DB (pgx, sqlc, GORM…), log (slog…): TODO(QUY_UOC) (nguồn: <file:dòng>).
- Cách bọc lỗi và mã lỗi trả ra HTTP: TODO(LOI) (nguồn: <file:dòng>).
- Lint thật của dự án (`go vet` + gofmt hay golangci-lint, cấu hình ở đâu): TODO(LINT) (nguồn: CI).
- Biến môi trường nền: lấy danh sách biến bắt buộc từ `.env.example` / `.env.sample` / `.env.template` (**tuyệt đối không đọc `.env` thật**) và điền giá trị THỬ trong `stack_slot_env`. Kiểm xem thư viện nạp env của app (ví dụ `godotenv.Load` vs `Overload`) có giữ nguyên biến slot từ `run.sh` hay ghi đè: TODO(ENV_ORDER) (nguồn: <file:dòng>).

## b. Lens review

Áp thêm khi review (12 stage ở `DECISIONS.md` mục 6; mr7-review hỗ trợ Go). Vi phạm mục d là CRITICAL.
- [ ] Mọi `error` được kiểm; bọc bằng `fmt.Errorf("…: %w", err)` kèm ngữ cảnh; không nuốt lỗi.
- [ ] Không `panic` ngoài `main`/khởi động.
- [ ] `context.Context` là tham số đầu, được truyền xuống DB, HTTP client, và tôn trọng huỷ.
- [ ] Goroutine có đường kết thúc (không rò); channel đóng đúng bên gửi.
- [ ] `defer` đóng tài nguyên: `rows.Close()`, kiểm `rows.Err()`, `resp.Body.Close()`.
- [ ] State dùng chung giữa goroutine có khoá hoặc channel. Lệnh test cố định không có `-race`: nghi ngờ race thì ghi vào nhận xét để Master quyết.
- [ ] SQL tham số hoá (`$1`), không ghép chuỗi; không truy vấn trong vòng lặp (N+1).
- [ ] Interface nhỏ, khai ở bên dùng; code đã qua gofmt và `go vet`.

## c. Kiểm thật

- Loại `UNIT_KIND=web-service`, làm theo `DECISIONS.md` mục 3:
  1. `sh workflow/run.sh slot <wt> <unit> <n>` → `setup` → `migrate` → `seed` (tạo DB `<app>_s<n>`, chạy migration/seed của dự án nếu có).
  2. `sh workflow/run.sh doctor <wt> <unit>` kiểm tra `UNIT_TOOLS`, trạng thái `SLOT_PORT`, Postgres (hỗ trợ cả CLI trên máy lẫn `docker exec` qua `u_pg_container`) và Redis (nếu bật).
  3. `sh workflow/run.sh test <wt> <unit>` xanh (và `e2e` nếu unit có bật).
  4. `sh workflow/run.sh serve <wt> <unit>` ở nền (`run_in_background`, không `&`; build ra file tạm rồi `exec`, không `go run`; `run.sh` kiểm `SLOT_PORT` rảnh trước và dừng mã 2 nếu đang bận).
  5. Chờ health → `curl` từng tiêu chí → dừng tác vụ nền → `sh workflow/run.sh teardown <wt> <unit>` (xoá DB `<app>_s<n>`, và dọn Redis theo slot nếu bật, tuyệt đối không `FLUSHALL`).
- Cổng: xem `sh workflow/run.sh doctor <wt> <unit>`, gõ số thẳng vào URL (không dùng `$`). Unit cần nhiều cổng (HTTP + gRPC/metrics) hoặc gọi unit khác cùng slot dùng `slot_port_at <offset>` (`offset < SLOT_STRIDE`).
- Biến môi trường app đọc (`os.Getenv`): `PORT`, `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGSSLMODE`, `PGCONNECT_TIMEOUT` (TODO(TEN_BIEN) nếu khác). **Tuyệt đối không dùng `&` trong `DATABASE_URL`**: tham số kết nối Postgres tách thành biến riêng (`PGSSLMODE`, `PGCONNECT_TIMEOUT`).
- Quy tắc `curl` (URL đứng ngay sau `curl` hoặc `-X <METHOD>`; cờ `-H`, `-G`, `-d` đặt **SAU URL**; **cấm `&`** kể cả trong dấu nháy):
  - Health: `curl http://localhost:<cổng>/healthz -i` → 200.
  - GET có nhiều query params (dùng `-G -d` sau URL): `curl http://localhost:<cổng>/api/items -G -d "page=1" -d "limit=20"`.
- Endpoint chính: TODO(ENDPOINTS).
- Postgres dev (và Redis/Kafka nếu dùng): TODO(POSTGRES_DEV) (chạy trên máy hay Docker container `u_pg_container` / `u_redis_container`; user, mật khẩu THỬ; quyền `createdb`/`dropdb`). Nếu dùng Redis/Kafka: dùng `REDIS_DB=$SLOT` (`0..15`) hoặc `REDIS_KEY_PREFIX=${SLOT_NAME}:` và `KAFKA_GROUP_ID=<app>_$SLOT_NAME`. Không có dịch vụ phụ thuộc thì ghi rõ lý do, không ghi "đạt".
- Unit loại `cli`: bỏ `stack_serve`, thêm `stack_smoke` (`workflow/stack/README.md` mục 1) và so đầu ra + mã thoát với mong đợi.
- Unit loại `worker` (`UNIT_KIND=worker`, `DECISIONS.md` mục 3):
  - *Worker chạy dài hạn* (consumer Kafka/queue, cron daemon): chạy `sh workflow/run.sh serve <wt> <unit>` ở nền (không `&`), đẩy job/message thử vào queue/topic của slot (`${SLOT_NAME}:` / `KAFKA_GROUP_ID=<app>_$SLOT_NAME`), đối chiếu log nền, DB/queue slot và health (nếu có) rồi dừng tác vụ nền.
  - *Worker chạy một lần có giới hạn* (`--once`/drain + timeout tự thoát): dùng `sh workflow/run.sh smoke <wt> <unit>`, không chạy `smoke` nếu tiến trình không tự thoát.

## d. Kiểu lỏng (Go)

| Cấm | Dùng thay | Ngoại lệ |
|---|---|---|
| `any`, `interface{}` khi kiểu cụ thể dùng được | Kiểu cụ thể, generic có ràng buộc, interface nhỏ có method | API thư viện bắt buộc (`slog.Any`, `fmt`), ghi lý do |
| `map[string]any` cho JSON có cấu trúc biết trước | `struct` có tag `json` | Dữ liệu thật sự tự do (metadata do người dùng nhập), ghi lý do |
| Ép kiểu `v.(T)` không kiểm | `v, ok := x.(T)` hoặc `switch` kiểu | Không có |
