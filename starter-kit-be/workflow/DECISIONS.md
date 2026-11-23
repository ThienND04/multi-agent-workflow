# Quyết định của dự án

Master điền ở lần đầu trong dự án (`workflow/roles/master.md`), chỉ sửa khi Đại ca đồng ý. Coder, Tester đọc, không sửa.
Chỗ chưa điền ghi `TODO(<TRƯỜNG>)`; chỗ khảo sát chưa rõ ghi `[NEEDS CLARIFICATION]`. Còn một trong hai dấu này thì chưa giao việc code.

## 1. Unit và lệnh

Unit là một phần chạy được riêng của dự án, có `workflow/stack/<unit>.sh` (lệnh) và `<unit>.md` (ghi chú), định dạng ở `workflow/stack/README.md`.

| unit | thư mục | loại | ngôn ngữ/phiên bản | trình gói | file stack | nguồn lệnh | Đại ca duyệt |
|---|---|---|---|---|---|---|---|
| TODO(UNIT) | TODO(THƯ_MỤC) | TODO(LOẠI) | TODO(NGÔN_NGỮ) | TODO(TRÌNH_GÓI) | `workflow/stack/TODO(UNIT).sh` | TODO(NGUỒN) | TODO(NGÀY) |

Loại: `web-service` | `web-frontend` | `cli` | `library` | `worker`, quyết định cách kiểm thật (mục 3). Nguồn lệnh: file đã khảo sát, ngày, SHA ngắn.

**Mọi lệnh code chạy qua `sh workflow/run.sh <động từ> <worktree> <unit> [n]`**, gọi từ thư mục gốc, `<worktree>` là đường dẫn tuyệt đối; không gõ lệnh gốc (AGENTS.md mục 7). 12 động từ: `slot` (cần `n`, mục 4), `setup`, `migrate` (tuỳ chọn, cần slot), `seed` (tuỳ chọn, cần slot), `test` (0 đối số, luôn một lệnh unit coverage giới hạn 2 worker), `e2e` (tuỳ chọn, cần slot), `build`, `serve` (chạy nền, không `&`; cần slot và `SLOT_PORT` phải rảnh — cổng bận `run.sh` dừng mã 2), `smoke`, `lint`, `doctor` (in `UNIT_TOOLS`, gọi `stack_doctor` nếu có, báo trạng thái `SLOT_PORT`), `teardown` (dọn tài nguyên slot, cảnh báo nếu `SLOT_PORT` còn bận). Nếu unit có `package.json` nhưng thiếu `node_modules` ở cả `$UNIT_DIR` lẫn `$WT`, các lệnh `test`, `e2e`, `build`, `serve`, `lint` dừng sớm với mã 2 kèm `gợi_ý=sh workflow/run.sh setup ...`. Gặp `[run.sh] lỗi=… gợi_ý=…` (mã 2): làm theo gợi ý nếu trong quyền, không thì hỏi Master; không lách bằng lệnh khác.

Tài khoản, khoá THỬ của slot (chỉ giá trị thử, không dùng thứ thật, không đọc hay in `.env`): TODO(TÀI_KHOẢN_THỬ) (lấy ở đâu: seed, endpoint đăng ký, file mẫu; cho unit nào). Biến môi trường nền cần khi chạy worktree (`JWT_SECRET`, `APP_KEY`…), Master đọc danh sách từ `.env.example` / `.env.sample` / `.env.template` (**tuyệt đối không đọc `.env` thật**; lưu ý trong Claude Code `Read(**/.env.*)` trong `deny` có thể chặn cả công cụ `Read` đối với file `.env.example`/`.env.sample`/`.env.template`, khi đó Master lấy danh sách tên biến qua shell hoặc hỏi Đại ca) và nạp giá trị thử qua `stack_slot_env`, không gõ tay.

## 2. Quy ước code

### 2a. Luật chung

Theo `workflow/OWNER-RULES.md` (nguyên văn) và AGENTS.md mục 8.
Ưu tiên khi xung đột: OWNER-RULES mục II (luật thay bằng bản khác không có mục đó thì: đúng và an toàn, dễ đọc, DRY, hiệu năng sau khi đo).

### 2b. Quy ước theo unit

Mỗi unit ở `workflow/stack/<unit>.md`: chỉ ghi điều KHÁC mặc định, mỗi điều kèm nguồn. Code cũ khác OWNER-RULES ở đâu thì ghi ở đó.

## 3. Kiểm thật

Nguồn duy nhất; file vai chỉ trỏ về đây. Làm sau khi test xanh (`sh workflow/run.sh test <wt> <unit>`, unit có `e2e` thì chạy thêm `sh workflow/run.sh e2e <wt> <unit>` nếu cần), theo từng tiêu chí của việc trong `SPEC.md`, chọn cách theo loại của từng unit ở dòng `Unit:` (cột loại ở mục 1, hoặc `loại=` trong `sh workflow/run.sh doctor <wt> <unit>`; không dùng dòng chú thích `# loại:`). Coder làm ở bước 8 và 10 (`Slot:`); Tester tự làm lại ở bước 9 và 10b (`Slot Tester:`), không tin bằng chứng của Coder. Ghi tóm tắt vào `## Kiểm thật` của file việc, không chép log dài. Việc thuần nội bộ, không chạm hành vi chạy được: `N/A: <lý do>`.

**web-service**
1. `sh workflow/run.sh serve <wt> <unit>` ở nền (Bash `run_in_background`, không `&`; dừng mã `2` nếu `SLOT_PORT` đang bận).
2. Chờ sẵn sàng: `curl http://localhost:<SLOT_PORT><HEALTH_PATH>` (`HEALTH_PATH` trong file unit, `SLOT_PORT` xem bằng `run.sh doctor`), không có thì đọc log nền.
3. Theo từng tiêu chí, `curl` tới `http://localhost:<SLOT_PORT>/...`. Quyền khớp theo tiền tố: URL đứng ngay sau `curl` (hoặc sau `-X <METHOD>`), cờ khác SAU URL, ví dụ `curl -X POST http://localhost:<SLOT_PORT>/<path> -H "Content-Type: application/json" -d '<json>' -i`. **Cấm tuyệt đối ký tự `&` trong lệnh `curl` (kể cả bọc trong dấu nháy)** vì làm mất hiệu lực rule allow của Claude Code và bật hỏi quyền; khi request GET có nhiều query params, đặt cờ `-G` và các `-d` **SAU URL**, ví dụ `curl http://localhost:<SLOT_PORT>/<path> -G -d "page=1" -d "limit=20"`. Không pipe, không `$(...)`; token lấy từ endpoint đăng nhập của slot, dán nguyên vào lệnh sau.
4. Bảng: `tiêu chí | request (method, path, body tóm tắt) | mong đợi (status, body) | thực tế | đạt`.
5. Dừng tác vụ nền trước khi `teardown`.

Tester thêm ca biên: dữ liệu sai (400), thiếu quyền (401/403), không tồn tại (404), trùng (409), phân trang, giới hạn độ dài.

**web-frontend**
1. `run.sh serve` ở nền như trên, chờ dev server sẵn sàng.
2. Mở `http://localhost:<SLOT_PORT>` bằng công cụ trình duyệt bạn có (trình duyệt trong ứng dụng Claude, Claude in Chrome, Playwright…; chưa nạp thì tìm và nạp trước).
3. Thử từng tiêu chí, đối chiếu mockup nếu có; mỗi tiêu chí một dòng: mở đâu, làm gì, thấy gì, đạt hay không. Lưu được ảnh thì lưu `<gốc>/workflow/F-NNN-…/shots/T-xx-<tiêu-chí>.png` và ghi tên file.
4. Dừng tác vụ nền.

Tester tự làm lại, nhất là trường hợp biên. Không có công cụ trình duyệt thì ghi rõ, không ghi "đạt".

**cli, worker, library:**
- **`cli`:** chạy một lần bằng `sh workflow/run.sh smoke <wt> <unit>`, so đầu ra (stdout/stderr) và mã thoát với mong đợi (bảng `tiêu chí | lệnh | mong đợi | thực tế | đạt`).
- **`worker`:** phân tách theo vòng đời:
  1. *Worker chạy dài hạn* (consumer Kafka, queue/BullMQ, cron daemon): chạy `sh workflow/run.sh serve <wt> <unit>` ở nền (không `&`), đẩy/kích hoạt job thử vào queue/topic của slot, kiểm tra log nền, bản ghi DB/queue của slot và endpoint health (nếu có), ghi bảng `tiêu chí | tác nhân / lệnh | mong đợi (log, DB/queue slot, health) | thực tế | đạt`, rồi dừng tác vụ nền.
  2. *Worker có chế độ chạy một lần có giới hạn* (`--once` / drain + timeout tự thoát): dùng `sh workflow/run.sh smoke <wt> <unit>`, so đầu ra, kết quả DB/queue slot và mã thoát. Không chạy `smoke` nếu lệnh không tự thoát.
- **`library`:** chỉ chạy `sh workflow/run.sh test <wt> <unit>`.

**Chung:** chỉ gọi tiến trình localhost của chính worktree, với tài nguyên của slot mình; không gọi staging, production, dịch vụ chung; không dùng khoá, tài khoản thật. Không chạy được: ghi rõ lý do vào bàn giao, đừng ghi "đạt". Quy tắc phân lập môi trường khi kiểm thật:
- *Env nền của worktree:* Master đọc danh sách biến bắt buộc từ `.env.example` / `.env.sample` / `.env.template` và nạp giá trị thử qua `stack_slot_env`; **tuyệt đối không đọc `.env` thật** (`Read(**/.env)` và `Read(**/.env.*)` bị chặn trên toàn monorepo; trong Claude Code `deny` ưu tiên hơn `allow`, nên nếu `Read` chặn file `.env.example` thì Master đọc tên biến qua shell hoặc hỏi Đại ca, còn `.slot.*.env` vẫn đọc bình thường).
- *Phân lập Redis:* dùng `REDIS_DB=$SLOT` (lưu ý giới hạn `0..15` của Redis mặc định) hoặc `REDIS_KEY_PREFIX=${SLOT_NAME}:`; `teardown` chỉ dọn phạm vi slot (`FLUSHDB` đúng DB hoặc xoá key theo prefix `${SLOT_NAME}:*`), **không bao giờ `FLUSHALL`**.
- *Phân lập Kafka / Queue:* dùng `KAFKA_GROUP_ID=<app>_$SLOT_NAME` và tiền tố queue `${SLOT_NAME}:` để các slot không tranh message/job.
- *Nhiều cổng:* dùng `slot_port_at <offset>` (`offset < SLOT_STRIDE`) khi unit mở thêm cổng (HTTP + gRPC/metrics) hoặc gọi unit khác trong cùng slot.
- *Tham số DB (cấm `&`):* tuyệt đối không ghép `&` trong URI DB của file slot; tách nhiều tham số thành biến môi trường riêng (`PGSSLMODE`, `PGCONNECT_TIMEOUT`, v.v.).

## 4. Slot

Mỗi worktree một slot (cổng, tài nguyên riêng) để nhiều agent chạy cùng lúc.
- `SLOT_PORT = BASE_PORT + n*SLOT_STRIDE + PORT_OFFSET`. `BASE_PORT` (mặc định 4000), `SLOT_STRIDE` (mặc định 10) ở `workflow/stack/_slots.sh`; `PORT_OFFSET` ở file unit (mặc định 0, mỗi unit cùng repo một số khác, nhỏ hơn `SLOT_STRIDE`). Khi một unit cần thêm cổng phụ (gRPC, metrics, WebSocket) hoặc kết nối tới unit khác cùng slot, dùng hàm `slot_port_at <offset>` trong `_slots.sh` (`BASE_PORT + SLOT*SLOT_STRIDE + offset`, kiểm `offset < SLOT_STRIDE` và `<= 65535`).
- Slot 0 của Master, mỗi lúc một Master dùng (Master song song chờ, hoặc dùng slot cố định Đại ca ghi ở dòng Trạng thái). Master ghi trong "Ngữ cảnh từ Master": `Slot: <n>` (Coder), `Slot Tester: <m>` (làn đủ). Slot chạy cùng lúc phải khác nhau.
- DB, Redis, Kafka/hàng đợi, thư mục tạm… đặt tên theo `SLOT_NAME` (`s<n>`), khai trong `stack_slot_env`: Redis dùng `REDIS_DB=$SLOT` (`0..15`) hoặc `REDIS_KEY_PREFIX=${SLOT_NAME}:` (teardown tuyệt đối không `FLUSHALL`); Kafka/queue dùng `KAFKA_GROUP_ID=<app>_$SLOT_NAME` và tiền tố `${SLOT_NAME}:`; biến nền worktree lấy danh sách từ `.env.example`/`.env.sample`/`.env.template` (không đọc `.env`) với giá trị thử; tham số DB tách thành biến riêng (`PGSSLMODE`, `PGCONNECT_TIMEOUT`…), không dùng `&` trong URI. Không bao giờ trỏ vào DB chung hay DB thật.
- `<wt>/.slot.<unit>.env` chỉ do `run.sh slot` sinh: không viết tay, không commit (`run.sh` tự thêm vào `.git/info/exclude`); không tính là sửa ngoài `files:`. Các động từ `migrate`, `seed`, `e2e`, `serve` đều yêu cầu đã có file slot này trước khi chạy. Xong việc, dừng server nền trước rồi nếu unit có tài nguyên thì chạy `run.sh teardown`.
- App chưa nhận cổng, tài nguyên từ `.slot.<unit>.env` (ghi cứng): Master vẫn ghi `Slot: <n>` vì `run.sh serve` cần file slot, nhưng giao tuần tự, mỗi lúc một agent chạy unit đó; cổng thật của app ghi ở `<unit>.md` mục c, kiểm thật dùng cổng đó thay `SLOT_PORT`.
- Trạng thái: TODO(SLOT).

## 5. Quy ước commit

- Mỗi commit một ý. Thông điệp theo Conventional Commits, tiếng Anh, thể mệnh lệnh, khớp lịch sử git của dự án (Master đối chiếu `git log` ở lần đầu). Một dòng: `<type>(<scope>): <mô tả>`, type là `feat`, `fix`, `refactor`, `test`, `docs`, `chore`…, scope là phần mã bị đổi. Cần giải thích thêm: dòng trống, rồi mỗi ý một dòng bắt đầu bằng `- `.
  ```
  feat(health): add GET /api/health endpoint, test coverage, and starter kit configuration
  ```
  ```
  feat(health): add GET /api/health endpoint, test coverage, and starter kit configuration

  - A
  - B
  - C
  ```
- **Chỉ có nội dung mô tả, không gì khác**: không trailer hay dòng phụ (`Co-Authored-By`, `Signed-off-by`, `Task:`, `Agent-Id`, `Generated with…`), không nhắc tên agent hay AI, không emoji. Tác giả là cấu hình git sẵn có của máy: không đổi `user.name`, `user.email`, không `--author`. Mã Jira (nếu dự án đòi) theo kiểu lịch sử git hiện có, trong scope hay đầu mô tả, không đặt trong trailer.
- **Ai commit, ở đâu:** Coder chỉ trên nhánh việc trong worktree của mình; Master chỉ trên nhánh tích hợp. `git add` từng file trong `files:` của việc, không `git add -A` hay `git add .`. Không bao giờ add hay commit ở thư mục gốc, trên `WORK_BRANCH` hay `BASE_BRANCH` (nhánh của Đại ca).
- Commit trên nhánh của việc, trong worktree: `git -C <worktree> commit ...`. Không `--no-verify`.
- Không commit `.env`, `.slot.*.env`, `.mr-review/`.

## 6. Review

Skill `mr7-review` (kit kèm sẵn ở `.claude/skills/mr7-review/` cho Claude Code và `.agents/skills/mr7-review/` cho Antigravity, có `mr-review-checklist.md` cho Node, NestJS, Go; ngôn ngữ khác vẫn chạy nếu công cụ có skill), cộng lens trong `workflow/stack/<unit>.md`, checklist OWNER-RULES mục IV và bảng kiểu lỏng (AGENTS.md mục 8). Không có skill: 12 stage thủ công bên dưới.
- Base: `BASE_BRANCH` (`workflow/project.conf`); có remote thì `origin/<BASE_BRANCH>`. Review đo **toàn bộ diff của nhánh so với base**, kể cả commit có sẵn của nhánh làm việc (`WORK_BRANCH`). Riêng phạm vi `files:` của từng việc đo so với `WORK_BRANCH` (không có thì `BASE_BRANCH`).
- Gọi skill: nêu đường dẫn tuyệt đối của worktree, bảo dùng `git -C <worktree>` cho merge-base và diff, báo cáo vào `<worktree>/.mr-review/reports/` (không commit, không chép nguyên). Nêu thêm đường dẫn `workflow/F-NNN-…/SPEC.md`, file việc và `workflow/stack/<unit>.md` (chúng nằm ngoài diff; thiếu thì Stage 1 chỉ báo WARNING "không có spec"). Skill không theo được thì làm thủ công, ghi lý do. Làn trực tiếp không cần.
- Ghi vào `## Nhận xét code`: kết luận, điểm tổng, finding quan trọng (file:line, mức độ, đề xuất).

| Mức độ | Hành động |
|---|---|
| CRITICAL (kể cả nhãn `breaking-change`) | Tester tạo `bugs/B-NN.md` `kind: review`, việc `reopened` |
| WARNING | Ghi vào `## Nhận xét code`; Tester quyết chặn hay không. WARNING của Stage 5 Security, hoặc Stage 9 Testing "logic mới không có test", thì chặn (lỗi `kind: review`) |
| INFO | Chỉ ghi gợi ý |

12 stage (thủ công: đọc `git -C <worktree> diff <base>...HEAD`, mỗi stage PASS / WARNING / CRITICAL / N/A kèm lý do một câu):
1. Spec: khớp `SPEC.md` và `files:`; không có file trong `workflow/`, không `.slot.*.env`.
2. Impact: ảnh hưởng tới module, dữ liệu, client, unit khác.
3. Code: đúng, dễ đọc, không code gỡ lỗi, code chết, đoạn làm dở.
4. Architecture: cấu trúc theo quy ước unit, tách lớp, phụ thuộc.
5. Security: validate đầu vào, truy vấn tham số hoá, không lộ khoá hay `.env`, phân quyền, log không PII.
6. Performance: N+1, truy vấn thiếu index, tải hay render thừa.
7. Observability: log có cấu trúc, correlation ID, lỗi có ngữ cảnh.
8. API: giao diện công khai (HTTP, màn hình, lệnh CLI, hàm xuất) khớp `SPEC.md`.
9. Testing: test thật sự kiểm tiêu chí (có so sánh kết quả, không bị bỏ qua), logic mới có test.
10. Breaking Change: đổi API, dữ liệu, giao diện làm hỏng client hay dữ liệu cũ.
11. Release & Ops: migration, cấu hình, biến môi trường mới.
12. Report: kết luận PASS / PASS WITH WARNINGS / BLOCK.

---

Nhật ký thay đổi (chỉ ghi thêm, ngay trên dòng phiên bản; mỗi lần sửa tăng Phiên bản, đổi "Sửa lần cuối"):
- TODO(NGÀY) TODO(ID_MASTER): lập file.

Phiên bản: 1 | Lập: TODO(NGÀY) | Sửa lần cuối: TODO(NGÀY)
