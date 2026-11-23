# Lệnh theo unit (`workflow/stack/`)

Agent chạy mọi lệnh code (cài, test, build, chạy server, chạy thử) qua một lệnh duy nhất:

```
sh workflow/run.sh <động từ> <worktree> <unit> [n]
```

`run.sh` nạp `workflow/stack/<unit>.sh` bằng `.` rồi gọi hàm ứng với động từ. Thư mục này chứa:

| File | Nội dung | Ai viết |
|---|---|---|
| `<unit>.sh` | Lệnh thật của unit (mục 1) | Master, sau khảo sát; Đại ca duyệt |
| `<unit>.md` | Quy ước riêng, lens review, cách kiểm thật, bảng kiểu lỏng (mục 2) | Master; Đại ca duyệt |
| `_slots.sh` | `BASE_PORT` (mặc định 4000), `SLOT_STRIDE` (mặc định 10), hàm `slot_port_at <offset>` | Kit đặt mặc định; Master đổi khi cổng bận, Đại ca duyệt |
| `examples/` | Mẫu để chép (mục 6). `run.sh` không đọc thư mục này | Kit |

Coder, Tester **không sửa** `workflow/stack/*` và `.slot.*.env`; cần đổi lệnh thì hỏi Master. Ở chế độ `subagent`, `.claude/agents/{coder,coder-pro,tester}.md` khoá `Edit`/`Write` trên `workflow/stack/**` qua `disallowedTools`; với agent chạy độc lập (`auto`, `window`, `manual`), `settings.json` chung không chặn để Master còn dùng, nên dựa vào luật vai và Tester kiểm diff của nhánh việc không chứa `workflow/stack/*` hay `.slot.*.env`.

## 1. File `<unit>.sh`

Tên file là tên unit, dạng `[a-z0-9_-]+`, không bắt đầu bằng `_` (dành cho file của kit như `_slots.sh`). Ví dụ đầy đủ:

```sh
# unit: server
# loại: web-service          # web-service | web-frontend | cli | library | worker
# nguồn lệnh: package.json scripts + .github/workflows/ci.yml, 2026-11-18, <SHA ngắn>
# Đại ca duyệt: <ngày>       # Master ghi sau khi Đại ca đồng ý; Coder/Tester KHÔNG sửa file này
UNIT_PATH=server
UNIT_KIND=web-service
PORT_OFFSET=0
HEALTH_PATH=/api/health     # web-service; rỗng nếu không có
UNIT_TOOLS="npm node"       # tuỳ chọn: công cụ cần kiểm trong doctor nếu hàm viết nhiều dòng/if
stack_setup()    { npm --prefix "$WT" ci; }
stack_test()     { npm --prefix "$UNIT_DIR" run test:cov -- --maxWorkers=2; }
stack_serve()    { exec env NODE_ENV=development node "$UNIT_DIR/src/index.js"; } # không --watch / --inspect
stack_slot_env() { echo "PORT=$SLOT_PORT"; echo "MONGO_URI=mongodb://localhost:27018/app_$SLOT_NAME"; }
```

**4 dòng đầu** (bắt buộc): tên unit, loại, nguồn lệnh (lấy từ đâu, ngày, SHA ngắn của commit đã khảo sát), ngày Đại ca duyệt (`chưa` khi đang soạn).

**Biến bắt buộc:**

| Biến | Ý nghĩa |
|---|---|
| `UNIT_PATH` | Thư mục unit, tính từ gốc worktree. `.` là chính gốc |
| `UNIT_KIND` | `web-service`, `web-frontend`, `cli`, `library` hoặc `worker`. Quyết định cách kiểm thật (`DECISIONS.md` mục 3) |
| `PORT_OFFSET` | Số nguyên ≥ 0, < `SLOT_STRIDE`. Mỗi unit trong cùng repo một số khác nhau |
| `HEALTH_PATH` | Đường kiểm server sẵn sàng (`web-service`, `web-frontend`). Rỗng nếu không có: khi đó chờ dòng log báo sẵn sàng |

**Biến tuỳ chọn:**

| Biến | Ý nghĩa |
|---|---|
| `UNIT_TOOLS` | Danh sách tên công cụ cách nhau bởi dấu cách (ví dụ `UNIT_TOOLS="pnpm node mongosh redis-cli"`). `run.sh doctor` hợp nhất `UNIT_TOOLS` với các lệnh tự đoán từ hàm một dòng, nên cần khai rõ khi hàm viết nhiều dòng hoặc dùng nhánh `if`/`docker exec`. Bị `run.sh` đặt lại khi nạp unit và không được ghi đè trong `stack_slot_env` |

**Hàm** (chỉ khai hàm unit hỗ trợ; thiếu hàm thì `run.sh` báo "unit <u> không hỗ trợ <động từ>", mã 2):

| Hàm | Động từ | Quy tắc |
|---|---|---|
| `stack_setup` | `setup` | Cài phụ thuộc cho worktree. Không tự sửa lockfile: pnpm `install --frozen-lockfile`, npm `ci`, Go `mod download`. Nếu unit có `package.json` nhưng thiếu `node_modules` ở `$UNIT_DIR` lẫn `$WT`, `run.sh` dừng sớm mã `2` ở `test`/`build`/`serve`/`lint`/`e2e` kèm `gợi_ý=sh workflow/run.sh setup ...` |
| `stack_migrate` | `migrate` | Chạy migration và codegen (ví dụ `prisma migrate deploy` + `prisma generate`, migration Go) trên DB của slot. Yêu cầu đã có `.slot.<unit>.env` |
| `stack_seed` | `seed` | Nạp dữ liệu thử / tài khoản thử vào DB của slot. Yêu cầu đã có `.slot.<unit>.env` |
| `stack_test` | `test` | **Một** lệnh unit test có coverage, giới hạn worker **cố định** (mục 4). Không nhận đối số. Kiểm `node_modules` nếu có `package.json`. Unit pnpm: đúng `pnpm --dir "$UNIT_DIR" run test:cov --maxWorkers=2` |
| `stack_e2e` | `e2e` | Chạy kiểm thử E2E/tích hợp trên DB/tài nguyên của slot (giới hạn worker nếu có). Yêu cầu đã có `.slot.<unit>.env` và kiểm `node_modules` nếu có `package.json` |
| `stack_build` | `build` | Build. Ngôn ngữ không cần build thì bỏ hàm. Kiểm `node_modules` nếu có `package.json` |
| `stack_serve` | `serve` | Chạy server ở tiền cảnh bằng `exec` (dừng tác vụ nền là dừng server). Chỉ nghe cổng của slot: không mở cổng cố định nào khác (ví dụ `--inspect` mặc định 9229). Yêu cầu đã có `.slot.<unit>.env`, kiểm `node_modules` nếu có `package.json`, và **`run.sh` kiểm `SLOT_PORT` đang rảnh trước khi chạy (bận thì dừng ngay mã 2)**. Với Node/TS nên `stack_build` rồi `exec env NODE_ENV=development node ...`, tránh `--watch`/`start:dev` để không rò tiến trình con |
| `stack_smoke` | `smoke` | Chạy thử cố định cho `cli`, hoặc `worker` có chế độ chạy một lần có giới hạn (`--once`/drain + timeout, tự thoát): một lệnh, đầu vào cố định, in kết quả để so với mong đợi. Worker chạy dài hạn dùng `stack_serve` (theo `DECISIONS.md` mục 3), không để `smoke` treo vô hạn |
| `stack_lint` | `lint` | Lint, kiểm định dạng (chỉ kiểm, không sửa file). Kiểm `node_modules` nếu có `package.json` |
| `stack_doctor` | `doctor` | Kiểm tra bổ sung riêng của unit (ví dụ kết nối DB/Redis/Docker container, công cụ phụ thuộc), gọi sau phần kiểm `UNIT_TOOLS` và trạng thái `SLOT_PORT` của `run.sh doctor` |
| `stack_slot_env` | `slot` | In thêm dòng `KEY=giá_trị` cho file slot (mục 5) |
| `stack_teardown` | `teardown` | Dọn tài nguyên của slot (DB tạm, container), chỉ tài nguyên mang `SLOT_NAME`. Xong thì `run.sh` xoá `.slot.<unit>.env` (cảnh báo nếu `SLOT_PORT` vẫn đang bận); lỗi (mã khác 0) thì giữ file để chạy lại. Với Redis chỉ dọn theo `REDIS_DB` hoặc prefix `${SLOT_NAME}:*`, **không bao giờ `FLUSHALL`** |

Ví dụ `stack_smoke` cho unit `cli` (đầu vào nằm trong repo, không gọi dịch vụ ngoài):

```sh
stack_smoke() { go -C "$UNIT_DIR" run ./cmd/tool --input testdata/smoke.txt; }
```

**Biến `run.sh` đặt sẵn:** `ROOT` (thư mục gốc), `WT` (worktree), `UNIT`, `UNIT_DIR` (= `$WT/$UNIT_PATH`, hoặc `$WT` khi `UNIT_PATH=.`). Khi có slot: `SLOT`, `SLOT_PORT`, `SLOT_NAME` (`s<n>`) và mọi dòng trong `<worktree>/.slot.<unit>.env` (đã `export`). Hàm chạy với thư mục hiện tại là `UNIT_DIR`, trong cùng tiến trình `run.sh`, có `set -u`. `_slots.sh` (gồm `slot_port_at`) được nạp trước khi gọi bất kỳ hàm `stack_*` nào.

**Luật viết:**
- File chỉ định nghĩa biến và hàm. Nạp file không được chạy lệnh nào, không in gì.
- POSIX sh (chạy bằng `sh`/dash và Git Bash). Trong script được dùng `$(...)`, `cd` (luật Bash của Đại ca áp cho lệnh agent gõ). Vẫn ghi rõ thư mục bằng cờ của công cụ khi có (`pnpm --dir`, `npm --prefix`, `go -C`) để lệnh tự nói nó chạy ở đâu; công cụ không có cờ đó (ví dụ `node dist/main.js`) thì chạy thẳng, vì `run.sh` đã đứng ở `UNIT_DIR`.
- `WT`, `UNIT_DIR`, `SLOT_*` chỉ dùng **trong hàm**: `run.sh` tính `UNIT_DIR` sau khi nạp file (vì cần `UNIT_PATH`). Có `set -u`, nên biến có thể chưa đặt thì viết `${TÊN:-}`.
- Hàm một dòng `stack_x() { lệnh …; }` giúp `run.sh doctor` đoán công cụ cần có (chữ đầu của lệnh, bỏ `exec` và `env` đứng sau `exec`); hàm nhiều dòng, nhánh `if`/`docker exec` dự phòng, hay lệnh bắt đầu bằng biến thì `doctor` không đoán — khi đó phải khai trong `UNIT_TOOLS="..."`.
- Hàm trả nguyên mã thoát của lệnh thật. Nhiều bước thì `lệnh_1 || return` rồi lệnh cuối.
- Biến riêng và hàm phụ đặt tiền tố `u_` (chữ thường), vì file được nạp vào chính tiến trình `run.sh`: tên khác dễ đè biến, hàm nội bộ của nó (`unit_file`, `unit_tools`, `stack_dir`…).
- Không đọc, không in `.env` thật hay khoá thật. Giá trị trong file chỉ là GIÁ TRỊ THỬ.
- Chỗ chưa chắc ghi `# cần kiểm`. Trước khi Đại ca duyệt, Master đã chạy thử và xoá hết `# cần kiểm`.
- Kiểm cú pháp: `sh -n workflow/stack/<unit>.sh`. Chạy thử với slot 0 của Master: `sh workflow/run.sh slot <gốc> <unit> 0`, rồi `doctor`, `setup`, `migrate`, `seed` (nếu có), `test`, `e2e` (nếu có), và `serve` ngắn rồi dừng nền trước khi `teardown`.

## 2. File `<unit>.md`

Bốn mục, chỉ ghi điều riêng của unit, mỗi điều có nguồn (file, dòng, hoặc câu trả lời của Đại ca):

```markdown
# Unit <tên> (<ngôn ngữ>, <framework>)
## a. Quy ước khác mặc định
- <điều khác so với OWNER-RULES và thói quen chung của ngôn ngữ> (nguồn: <file:dòng>)
## b. Lens review
- [ ] <mục kiểm riêng của ngôn ngữ, framework>
## c. Kiểm thật
- Loại: <UNIT_KIND>. Endpoint chính / trang chính / lệnh smoke: …
- Tài khoản, dữ liệu thử: <lấy ở đâu; chỉ giá trị thử của slot>
## d. Kiểu lỏng
| Cấm | Dùng thay | Ngoại lệ (phải ghi lý do trong code) |
```

Không chép lại OWNER-RULES hay `DECISIONS.md`: chỉ tham chiếu. Coder, Tester nhận file này qua `can_doc` của việc.

## 3. Nhận diện stack

Kit hiện có sẵn mẫu cho **Node.js (Express, npm hoặc pnpm), NestJS (pnpm + MongoDB hoặc PostgreSQL + Prisma), Go**. Stack khác: Master tự khảo sát và viết file unit theo cùng định dạng (mục 1, 2, giữ bất biến mục 4), kit chưa có mẫu.

Thứ tự nguồn sự thật (chi tiết ở `workflow/roles/master.md`): tài liệu dự án (AGENTS.md, CONTRIBUTING, README) → CI → runner sẵn có (Makefile, justfile, Taskfile, scripts trong manifest) → manifest và lockfile (bảng dưới) → file phiên bản (`.nvmrc`, `.node-version`, `go.mod`…) → `.devcontainer`, compose. Lệnh đã có trong CI hay runner thì dùng lại lệnh đó, bảng này chỉ để đoán khi chưa có.

| File nhận diện | Hệ sinh thái, trình gói | Mẫu gần nhất | Ghi chú |
|---|---|---|---|
| `nest-cli.json`, `@nestjs/core` trong `package.json` | NestJS | `nestjs-pnpm` hoặc `nestjs-postgres-prisma` (nếu có `@prisma/client` / `prisma/schema.prisma`) | Trình gói theo lockfile (hai dòng dưới) |
| `pnpm-lock.yaml` | Node + pnpm | `nestjs-pnpm`; Express thì `express-npm` đổi lệnh sang pnpm (mục 4) | `pnpm-workspace.yaml`: monorepo, cài ở gốc |
| `package-lock.json` | Node + npm | `express-npm` | `workspaces` trong `package.json`: monorepo, cài ở gốc |
| `go.mod` | Go | `go` | Không dựa vào `main.go` (gói main thường ở `cmd/`). `go.work`: nhiều module |

Lockfile quyết định trình gói; không có lockfile nào ở trên (yarn, bun, ngôn ngữ khác) là stack chưa có mẫu. Đoán loại unit: `nest-cli.json`, server HTTP (Express, `net/http` của Go…) thường là `web-service`; dev server giao diện thường là `web-frontend`; có `bin`/`cmd` mà không nghe cổng là `cli`; chỉ được import là `library`; tiêu thụ hàng đợi, cron là `worker`. Bảng chỉ là gợi ý: luôn chạy thử để xác nhận.

## 4. Lệnh test coverage có giới hạn worker

Bất biến cho mọi hệ sinh thái: `stack_test` là **một** lệnh, **có coverage**, **giới hạn worker cố định 2** (khớp `--maxWorkers=2` trong luật Đại ca), không nhận đối số. "Worker" mỗi nơi một nghĩa, ghi rõ trong bảng.

| Hệ sinh thái | Lệnh trong `stack_test` | Coverage cần | Giới hạn | Nguồn |
|---|---|---|---|---|
| Node + pnpm | `pnpm --dir "$UNIT_DIR" run test:cov --maxWorkers=2` | Script `test:cov` (`jest --coverage`, hoặc `vitest run --coverage` + gói coverage của Vitest) | `--maxWorkers`: số tiến trình worker của Jest/Vitest. pnpm chuyển cờ sau tên script cho script | jestjs.io/docs/cli, vitest.dev/guide/cli, pnpm.io/cli/run |
| Node + npm | `npm --prefix "$UNIT_DIR" run test:cov -- --maxWorkers=2` | Như trên | Như trên; `--` để npm chuyển cờ cho script | docs.npmjs.com (run-script, config `prefix`) |
| Go | `go -C "$UNIT_DIR" test -p 2 -parallel 2 -count=1 -cover ./...` | Có sẵn | `-p`: số gói test song song; `-parallel`: số test `t.Parallel` song song trong một gói. `-C` phải đứng đầu | pkg.go.dev/cmd/go |

Stack khác: chọn lệnh coverage có giới hạn worker tương đương theo tài liệu chính thức, ghi nguồn, để `# cần kiểm` cho tới khi chạy thử đạt.

Dự án thiếu script `test:cov` hay gói coverage của Jest/Vitest: Master **hỏi Đại ca** kèm ít nhất 2 phương án, vì thêm là đổi dự án. Test chạm DB dùng chung khi chạy song song thì mỗi worker cần DB riêng (Jest: `JEST_WORKER_ID`; Go: `-p 2` chạy 2 gói test cùng lúc nên mỗi gói chạm DB cần DB riêng): ghi vào `<unit>.md`.

## 5. Slot trong file unit

- Cổng: `SLOT_PORT = BASE_PORT + n × SLOT_STRIDE + PORT_OFFSET`. Slot 0 là của Master. Server chỉ nghe `SLOT_PORT`. Khi unit cần thêm cổng phụ (gRPC, metrics, WebSocket) hoặc kết nối tới unit khác trong cùng slot, dùng hàm `slot_port_at <offset>` từ `_slots.sh` (được `run.sh` nạp trước mọi hàm `stack_*`, gồm cả `stack_slot_env` và `stack_doctor`): in ra `BASE_PORT + SLOT * SLOT_STRIDE + offset`, kiểm tra `offset < SLOT_STRIDE` và cổng `<= 65535`.
- `stack_slot_env` in mỗi dòng `KEY=giá_trị`: tên chữ hoa, số, `_`; giá trị không có `` ` ``, `$`, `(`, `)`, `;`, `&`, `|`, `<`, `>`, hay ký tự điều khiển (`\r`, CRLF). Không được đè `SLOT`, `SLOT_PORT`, `SLOT_NAME`, `ROOT`, `WT`, `UNIT`, `UNIT_DIR`, `UNIT_PATH`, `UNIT_KIND`, `PORT_OFFSET`, `HEALTH_PATH`, `UNIT_TOOLS`, `BASE_PORT`, `SLOT_STRIDE`, `PATH`, `IFS`. `run.sh` kiểm khi ghi (động từ `slot`) và khi nạp; một dòng sai là dừng (mã `2`). Giá trị được gán nguyên văn: đừng bọc nháy (nháy sẽ nằm trong giá trị), tránh dấu cách. **Tuyệt đối không dùng `&` trong URI kết nối DB** (ví dụ không ghép nhiều tham số sau dấu `?` bằng ký tự `&`) và chuỗi kết nối không chứa `;`: khi cấu hình DB cần nhiều tham số, **tách thành các biến môi trường riêng** (`PGSSLMODE=disable`, `PGCONNECT_TIMEOUT=5`, `MONGO_AUTH_SOURCE=admin`…), hoặc app tự ghép từ khoá riêng (nếu đổi code app, hỏi Đại ca).
- Chỉ GIÁ TRỊ THỬ: tài khoản DB cục bộ, khoá giả. Không bao giờ trỏ vào DB chung hay thật. Worktree mới không có `.env` (và quyền `Read(**/.env)` / `Read(**/.env.*)` bị chặn): Master đọc `.env.example` / `.env.sample` / `.env.template` để lấy danh sách biến khởi động bắt buộc (`JWT_SECRET`, `SECRET_KEY`…) và điền **giá trị thử** vào `stack_slot_env`.
- Tài nguyên đặt tên theo `SLOT_NAME`: DB `<app>_<SLOT_NAME>`, compose project `<app>_<SLOT_NAME>`.
  - *MongoDB:* tự tạo DB khi ghi, chỉ cần xoá ở `stack_teardown` (mẫu `nestjs-pnpm`).
  - *PostgreSQL:* tạo DB ở `stack_setup` (`createdb`) và xoá ở `stack_teardown` (`dropdb --if-exists`) (mẫu `nestjs-postgres-prisma`, `go`, `express-npm`). `createdb`, `dropdb` không đọc `DATABASE_URL`, chỉ đọc `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`: `stack_slot_env` phải in cả các biến này, trùng với URL. Hỗ trợ `docker exec` dự phòng khi máy không cài CLI DB cục bộ.
  - *Redis:* dùng `REDIS_DB=$SLOT` (lưu ý Redis mặc định chỉ có `0..15`) hoặc `REDIS_KEY_PREFIX=${SLOT_NAME}:` (khi >15 slot hoặc dùng Redis Cluster); `stack_teardown` chỉ dọn phạm vi slot (`FLUSHDB` trên `REDIS_DB` của slot hoặc xoá key theo prefix `${SLOT_NAME}:*`), **tuyệt đối không `FLUSHALL`**.
  - *Kafka / Queue:* đặt `KAFKA_GROUP_ID=<app>_$SLOT_NAME` và tiền tố queue/BullMQ `${SLOT_NAME}:` để các slot song song không tranh message/job của nhau.
- Biến môi trường có thắng file cấu hình của app (`.env`…) không, tuỳ thư viện và cách dự án nạp (`@nestjs/config`, dotenv của Node, thư viện `.env` của Go): kiểm theo dự án khi khảo sát, ghi vào `<unit>.md`.
- `run.sh` nạp file slot trước mọi động từ, kể cả `test`: test không được nghe cổng lấy từ biến của slot (ví dụ test e2e gọi `listen(process.env.PORT)`) vì sẽ đụng server đang chạy. Vì vậy cũng **không đặt `NODE_ENV`** (hay biến đổi chế độ test) trong file slot: đặt ở `stack_serve` (`exec env NODE_ENV=development …`). Các động từ `migrate`, `seed`, `e2e`, `serve` đều yêu cầu `<wt>/.slot.<unit>.env` đã tồn tại trước khi chạy (thiếu thì `run.sh` dừng mã `2`).

## 6. Mẫu có sẵn (`examples/`)

| Mẫu | Loại | Test | Serve | Chỗ phải kiểm khi dùng |
|---|---|---|---|---|
| `nestjs-pnpm` | web-service | `pnpm --dir … run test:cov --maxWorkers=2` | `stack_build` rồi `exec env NODE_ENV=development node dist/main.js`, Mongo + Redis theo slot | Script `test:cov`, `dist/main.js`, health, Mongo/Redis dev |
| `nestjs-postgres-prisma` | web-service | `pnpm --dir … run test:cov --maxWorkers=2` | `stack_build` rồi `exec env NODE_ENV=development node dist/main.js`, Postgres (`migrate` Prisma + `seed`) + Redis theo slot | Script `test:cov`, Prisma schema/seed, quyền Postgres dev |
| `express-npm` | web-service | `npm --prefix … run test:cov -- --maxWorkers=2` | `exec env NODE_ENV=development node …` (tránh `--watch`/`--inspect`) | Entry point, app đọc `PORT`, Postgres dev (nếu có `migrate`/`seed`). Dự án dùng pnpm: đổi theo mục 4 |
| `go` | web-service | `go test -p 2 -parallel 2 -count=1 -cover` | build rồi `exec` file chạy | Gói main, quyền Postgres dev, `migrate`/`seed` (nếu có) |

Mỗi mẫu có `.md` cùng tên: quy ước khác mặc định, lens review, cách kiểm thật, bảng kiểu lỏng.

**Dùng mẫu:** chép `examples/<mẫu>.sh` thành `workflow/stack/<unit>.sh` và `.md` tương ứng; sửa 4 dòng đầu, biến, lệnh theo nguồn đã khảo sát; giải quyết mọi `# cần kiểm`; `sh -n`; chạy thử (mục 1); điền `.md`; đưa Đại ca duyệt rồi ghi ngày vào dòng "Đại ca duyệt". Stack chưa có mẫu (kể cả unit `web-frontend`): viết theo mục 1, 2 và bất biến mục 4.
