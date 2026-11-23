# unit: api
# loại: web-service
# nguồn lệnh: MẪU của kit (chưa khảo sát). Master thay bằng nguồn thật: package.json scripts + CI, <ngày>, <SHA ngắn>
# Đại ca duyệt: chưa
#
# Mẫu Express + npm + PostgreSQL (Jest hoặc Vitest). Chép thành workflow/stack/<unit>.sh rồi sửa theo dự án.
# File chỉ định nghĩa biến và hàm; run.sh nạp bằng `.` rồi gọi hàm theo động từ.
# WT, UNIT_DIR, SLOT_* chỉ dùng TRONG hàm: run.sh tính chúng sau khi nạp file.

{
# shellcheck disable=SC2034
UNIT_PATH=.
# shellcheck disable=SC2034
UNIT_KIND=web-service
# shellcheck disable=SC2034
PORT_OFFSET=0
# shellcheck disable=SC2034
HEALTH_PATH=/health          # cần kiểm: đường health thật của dự án; không có thì để rỗng
# shellcheck disable=SC2034
UNIT_TOOLS="npm node"        # npm và node bắt buộc trên máy; CLI Postgres kiểm trong stack_doctor (hỗ trợ docker exec)
}

u_entry=src/index.js         # cần kiểm: src/index.js, src/server.js, hoặc dist/index.js nếu dùng TypeScript
u_db_prefix=app              # DB của slot = <tiền tố>_<SLOT_NAME>
u_pg_host=127.0.0.1          # Postgres dev cục bộ (dùng 127.0.0.1 tránh lệch IPv6 ::1 với Docker)
u_pg_port=5432
u_pg_user=dev                # GIÁ TRỊ THỬ của Postgres dev (cần kiểm quyền createdb/dropdb)
u_pg_password=dev
u_pg_sslmode=disable         # tham số kết nối tách biến riêng, KHÔNG ghép & vào DATABASE_URL
u_pg_connect_timeout=5
u_pg_container="${U_PG_CONTAINER:-}" # tuỳ chọn: tên container Postgres khi máy không cài psql/createdb/dropdb

u_has_node_modules() {
  [ -d "$UNIT_DIR/node_modules" ] || [ -d "$WT/node_modules" ]
}

u_npm_has_script() {
  if [ ! -f "$UNIT_DIR/package.json" ]; then
    return 1
  fi
  node -e '
    const fs = require("fs");
    const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    process.exit(pkg.scripts && Object.prototype.hasOwnProperty.call(pkg.scripts, process.argv[2]) ? 0 : 1);
  ' "$UNIT_DIR/package.json" "$1" 2>/dev/null
}

u_pg_cmd_run() {
  u_pgc_stdin=$1
  u_pgc_tool=$2
  shift 2
  u_pgc_host=${PGHOST:-$u_pg_host}
  u_pgc_port=${PGPORT:-$u_pg_port}
  u_pgc_user=${PGUSER:-$u_pg_user}
  u_pgc_pass=${PGPASSWORD:-$u_pg_password}
  u_pgc_ssl=${PGSSLMODE:-$u_pg_sslmode}
  u_pgc_timeout=${PGCONNECT_TIMEOUT:-$u_pg_connect_timeout}
  if command -v "$u_pgc_tool" >/dev/null 2>&1; then
    env \
      "PGHOST=$u_pgc_host" \
      "PGPORT=$u_pgc_port" \
      "PGUSER=$u_pgc_user" \
      "PGPASSWORD=$u_pgc_pass" \
      "PGSSLMODE=$u_pgc_ssl" \
      "PGCONNECT_TIMEOUT=$u_pgc_timeout" \
      "$u_pgc_tool" "$@"
    return $?
  fi
  if [ -n "$u_pg_container" ]; then
    if ! command -v docker >/dev/null 2>&1; then
      printf '[stack] lỗi=thiếu %s và thiếu docker để chạy container %s gợi_ý=cài postgresql-client hoặc docker\n' "$u_pgc_tool" "$u_pg_container" >&2
      return 1
    fi
    u_pgc_running=$(docker inspect -f '{{.State.Running}}' "$u_pg_container" 2>/dev/null || true)
    if [ "$u_pgc_running" != true ]; then
      printf '[stack] lỗi=container Postgres %s chưa chạy gợi_ý=docker start %s\n' "$u_pg_container" "$u_pg_container" >&2
      return 1
    fi
    if [ "$u_pgc_stdin" = stdin ]; then
      docker exec -i -e "PGPASSWORD=$u_pgc_pass" "$u_pg_container" "$u_pgc_tool" -U "$u_pgc_user" "$@"
    else
      docker exec -e "PGPASSWORD=$u_pgc_pass" "$u_pg_container" "$u_pgc_tool" -U "$u_pgc_user" "$@"
    fi
    return $?
  fi
  printf '[stack] lỗi=thiếu %s trên máy và chưa đặt u_pg_container gợi_ý=cài postgresql-client hoặc đặt u_pg_container\n' "$u_pgc_tool" >&2
  return 1
}

u_pg_cmd() {
  u_pg_cmd_run nostdin "$@"
}

u_pg_cmd_stdin() {
  u_pg_cmd_run stdin "$@"
}

# Trả 0 nếu DB đã có, 1 nếu chưa có, 2 nếu không kết nối được Postgres hoặc thiếu CLI.
u_db_exists() {
  u_dbe_list=$(u_pg_cmd psql -d postgres -Atc "SELECT datname FROM pg_database") || return 2
  printf '%s\n' "$u_dbe_list" | grep -qxF "$1"
}

u_ensure_slot_db() {
  u_esd_slot=${SLOT_NAME:-}
  if [ -z "$u_esd_slot" ]; then
    return 0
  fi
  u_esd_db="${u_db_prefix}_$u_esd_slot"
  u_esd_rc=0
  u_db_exists "$u_esd_db" || u_esd_rc=$?
  case $u_esd_rc in
    0) return 0 ;;
    2)
      printf '[stack] lỗi=không kết nối được Postgres hoặc thiếu psql/createdb gợi_ý=bật Postgres và cài postgresql-client hoặc đặt u_pg_container\n' >&2
      return 1 ;;
  esac
  u_pg_cmd createdb "$u_esd_db" || {
    printf '[stack] lỗi=không tạo được DB %s gợi_ý=kiểm quyền Postgres dev hoặc container %s\n' "$u_esd_db" "${u_pg_container:--}" >&2
    return 1
  }
}

# npm ci: không bao giờ ghi package.json hay package-lock.json, lệch nhau thì báo lỗi (cần package-lock.json);
# nó xoá node_modules trước khi cài. npm workspaces thì cài ở gốc worktree ("$WT") thay cho "$UNIT_DIR".
stack_setup() {
  npm --prefix "$UNIT_DIR" ci || return
  if [ -n "${SLOT_NAME:-}" ]; then
    u_ensure_slot_db || return
  else
    printf '[stack] thông_báo=chưa có slot nên bỏ qua tạo DB slot; chạy run.sh slot rồi setup hoặc migrate\n' >&2
  fi
}

# cần kiểm: đổi theo công cụ migration của dự án (Knex, TypeORM, node-pg-migrate…) hoặc xoá hàm nếu không dùng migration.
stack_migrate() {
  u_ensure_slot_db || return
  if u_npm_has_script migrate; then
    npm --prefix "$UNIT_DIR" run migrate
    return $?
  fi
  printf '[stack] lỗi=chưa cấu hình lệnh migrate cho unit (cần kiểm package.json scripts.migrate) gợi_ý=Master cập nhật stack_migrate hoặc xoá hàm nếu không dùng migration\n' >&2
  return 1
}

# cần kiểm: đổi theo script seed trong package.json hoặc scripts/seed.sql; xoá hàm nếu không dùng seed.
stack_seed() {
  if u_npm_has_script seed; then
    npm --prefix "$UNIT_DIR" run seed
    return $?
  fi
  if [ -f "$UNIT_DIR/scripts/seed.sql" ]; then
    u_pg_cmd_stdin psql -v ON_ERROR_STOP=1 -d "${u_db_prefix}_$SLOT_NAME" < "$UNIT_DIR/scripts/seed.sql"
    return $?
  fi
  printf '[stack] lỗi=chưa cấu hình lệnh seed cho unit (cần kiểm package.json scripts.seed hoặc scripts/seed.sql) gợi_ý=Master cập nhật stack_seed hoặc xoá hàm nếu không dùng seed\n' >&2
  return 1
}

# `--` để npm chuyển cờ cho script; script test:cov phải có (ví dụ `jest --coverage`), thiếu thì Master hỏi Đại ca.
stack_test() { npm --prefix "$UNIT_DIR" run test:cov -- --maxWorkers=2; }

# Tuỳ chọn (bỏ `#` nếu dự án có suite E2E / cần bước build TypeScript):
# stack_e2e() { npm --prefix "$UNIT_DIR" run test:e2e -- --maxWorkers=2; }
# stack_build() { npm --prefix "$UNIT_DIR" run build; }

# cần kiểm: đảm bảo script lint chỉ kiểm, không tự sửa file (--fix/--write).
stack_lint() { npm --prefix "$UNIT_DIR" run lint; }

# Chạy trực tiếp bằng `exec node`: không dùng `npm run dev` (tránh `nodemon --watch` để sót tiến trình con
# hoặc `--inspect` mở cổng cố định 9229 làm đụng các slot).
# NODE_ENV chỉ đặt ở đây, không đặt trong file slot (`test` cũng nạp file slot).
# Nếu dự án dùng TypeScript: bỏ `#` cho `stack_build`, gọi `stack_build || return` rồi đổi `$u_entry` thành `dist/index.js`.
stack_serve() {
  exec env NODE_ENV=development node "$UNIT_DIR/$u_entry"
}

stack_doctor() {
  u_doc_rc=0
  if u_has_node_modules; then
    printf 'node_modules=có\n'
  else
    printf 'node_modules=thiếu gợi_ý=sh workflow/run.sh setup %s %s\n' "$WT" "$UNIT"
    u_doc_rc=1
  fi

  u_doc_pg_cli=0
  if command -v psql >/dev/null 2>&1 && command -v createdb >/dev/null 2>&1 && command -v dropdb >/dev/null 2>&1; then
    u_doc_pg_cli=1
  fi
  if [ "$u_doc_pg_cli" -eq 0 ] && [ -z "$u_pg_container" ]; then
    printf 'postgres=thiếu_công_cụ gợi_ý=cài psql/createdb/dropdb hoặc đặt u_pg_container\n'
    u_doc_rc=1
  elif u_pg_cmd psql -d postgres -Atc "SELECT 1" >/dev/null 2>&1; then
    if [ -n "${SLOT_NAME:-}" ]; then
      if u_db_exists "${u_db_prefix}_$SLOT_NAME"; then
        printf 'postgres=sẵn_sàng slot_db=có (%s)\n' "${u_db_prefix}_$SLOT_NAME"
      else
        printf 'postgres=sẵn_sàng slot_db=chưa_tạo (%s)\n' "${u_db_prefix}_$SLOT_NAME"
      fi
    else
      printf 'postgres=sẵn_sàng\n'
    fi
  else
    printf 'postgres=không_kết_nối_được host=%s port=%s container=%s\n' "${PGHOST:-$u_pg_host}" "${PGPORT:-$u_pg_port}" "${u_pg_container:--}"
    u_doc_rc=1
  fi

  return "$u_doc_rc"
}

# Mỗi dòng KEY=giá_trị; TUYỆT ĐỐI KHÔNG chứa `&`, nháy, dấu cách, $, (), ;, |, <, >, backtick, ký tự điều khiển.
# Tham số Postgres tách thành biến riêng (PGSSLMODE, PGCONNECT_TIMEOUT…), không ghép `&` trong DATABASE_URL.
# PGHOST/PGPORT/PGUSER/PGPASSWORD cần cho createdb/dropdb/psql vì chúng không đọc DATABASE_URL.
stack_slot_env() {
  printf 'PORT=%s\n' "$SLOT_PORT"
  printf 'DATABASE_URL=postgres://%s:%s@%s:%s/%s_%s\n' \
    "$u_pg_user" "$u_pg_password" "$u_pg_host" "$u_pg_port" "$u_db_prefix" "$SLOT_NAME"
  printf 'PGHOST=%s\n' "$u_pg_host"
  printf 'PGPORT=%s\n' "$u_pg_port"
  printf 'PGUSER=%s\n' "$u_pg_user"
  printf 'PGPASSWORD=%s\n' "$u_pg_password"
  printf 'PGDATABASE=%s_%s\n' "$u_db_prefix" "$SLOT_NAME"
  printf 'PGSSLMODE=%s\n' "$u_pg_sslmode"
  printf 'PGCONNECT_TIMEOUT=%s\n' "$u_pg_connect_timeout"
  # Biến nền lấy danh sách từ .env.example / .env.sample / .env.template (tuyệt đối không đọc .env thật), chỉ điền GIÁ TRỊ THỬ:
  # printf 'JWT_SECRET=slot_dev_jwt_secret_%s\n' "$SLOT_NAME"
  # Nếu unit cần cổng phụ (metrics, WebSocket) hoặc gọi unit khác cùng slot, dùng slot_port_at <offset>:
  # printf 'METRICS_PORT=%s\n' "$(slot_port_at 1)"
}

# Chỉ xoá DB mang hậu tố của chính slot này. Lỗi thì trả mã khác 0 để run.sh giữ file slot chạy lại sau.
stack_teardown() {
  if [ -z "${SLOT_NAME:-}" ]; then
    return 0
  fi
  u_td_db="${u_db_prefix}_$SLOT_NAME"
  if ! u_pg_cmd dropdb --if-exists "$u_td_db"; then
    printf '[stack] lỗi=không xoá được DB %s gợi_ý=kiểm quyền Postgres dev hoặc container %s\n' "$u_td_db" "${u_pg_container:--}" >&2
    return 1
  fi
}
