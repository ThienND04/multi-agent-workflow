# unit: server
# loại: web-service
# nguồn lệnh: MẪU của kit (chưa khảo sát). Master thay bằng nguồn thật: package.json scripts + CI, <ngày>, <SHA ngắn>
# Đại ca duyệt: chưa
#
# Mẫu NestJS + pnpm + PostgreSQL + Prisma + Redis. Chép thành workflow/stack/<unit>.sh rồi sửa theo dự án.
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
HEALTH_PATH=/api/health      # cần kiểm: đường health thật của dự án; không có thì để rỗng
# shellcheck disable=SC2034
UNIT_TOOLS="pnpm node"       # pnpm và node bắt buộc trên máy; CLI Postgres/Redis kiểm trong stack_doctor (hỗ trợ docker exec)
}

# Tên DB của slot = <u_db_prefix>_<SLOT_NAME>, để mọi slot có DB riêng, không bao giờ trỏ DB chung.
u_db_prefix=app              # Master đổi theo tên app
u_pg_host=127.0.0.1          # Postgres dev cục bộ (dùng 127.0.0.1 tránh lệch IPv6 ::1 với Docker)
u_pg_port=5432
u_pg_user=postgres           # GIÁ TRỊ THỬ của Postgres dev (cần kiểm quyền createdb/dropdb)
u_pg_password=postgres
u_pg_sslmode=disable         # tham số kết nối tách biến riêng, KHÔNG ghép & vào DATABASE_URL
u_pg_connect_timeout=5
u_pg_container="${U_PG_CONTAINER:-}"       # tuỳ chọn: tên container Postgres khi máy không cài psql/createdb/dropdb

u_redis_host=127.0.0.1
u_redis_port=6379
u_redis_isolation=db         # db (dùng REDIS_DB=$SLOT cho 0..15) | prefix (dùng chung DB 0 + xoá theo REDIS_KEY_PREFIX)
u_redis_container="${U_REDIS_CONTAINER:-}" # tuỳ chọn: tên container Redis khi máy không cài redis-cli
u_redis_container_port=6379

u_has_node_modules() {
  [ -d "$UNIT_DIR/node_modules" ] || [ -d "$WT/node_modules" ]
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

u_redis_cli() {
  if command -v redis-cli >/dev/null 2>&1; then
    redis-cli -h "${REDIS_HOST:-$u_redis_host}" -p "${REDIS_PORT:-$u_redis_port}" "$@"
    return $?
  fi
  if [ -n "$u_redis_container" ]; then
    if ! command -v docker >/dev/null 2>&1; then
      printf '[stack] lỗi=thiếu redis-cli và thiếu docker để chạy container %s gợi_ý=cài redis-cli hoặc docker\n' "$u_redis_container" >&2
      return 1
    fi
    u_rdc_running=$(docker inspect -f '{{.State.Running}}' "$u_redis_container" 2>/dev/null || true)
    if [ "$u_rdc_running" != true ]; then
      printf '[stack] lỗi=container Redis %s chưa chạy gợi_ý=docker start %s\n' "$u_redis_container" "$u_redis_container" >&2
      return 1
    fi
    docker exec "$u_redis_container" redis-cli -h 127.0.0.1 -p "$u_redis_container_port" "$@"
    return $?
  fi
  printf '[stack] lỗi=thiếu redis-cli trên máy và chưa đặt u_redis_container gợi_ý=cài redis-cli hoặc đặt u_redis_container\n' >&2
  return 1
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

u_install_deps() {
  # Monorepo pnpm workspace cài ở gốc $WT; repo một gói có lockfile riêng ở $UNIT_DIR thì cài tại $UNIT_DIR.
  # --frozen-lockfile: không tự sửa pnpm-lock.yaml.
  if [ -f "$WT/pnpm-workspace.yaml" ] || [ ! -f "$UNIT_DIR/pnpm-lock.yaml" ]; then
    pnpm --dir "$WT" install --frozen-lockfile
  else
    pnpm --dir "$UNIT_DIR" install --frozen-lockfile
  fi
}

u_redis_flush_prefix() {
  u_rfp_db=$1
  u_rfp_prefix=$2
  u_rfp_keys=$(u_redis_cli -n "$u_rfp_db" --scan --pattern "${u_rfp_prefix}*") || return 1
  if [ -z "$u_rfp_keys" ]; then
    return 0
  fi
  while IFS= read -r u_rfp_key; do
    if [ -z "$u_rfp_key" ]; then
      continue
    fi
    u_redis_cli -n "$u_rfp_db" DEL "$u_rfp_key" >/dev/null || return 1
  done <<EOF
$u_rfp_keys
EOF
}

u_teardown_redis() {
  u_tdr_slot=${SLOT_NAME:-}
  if [ -z "$u_tdr_slot" ]; then
    return 0
  fi
  u_tdr_pong=$(u_redis_cli PING) || {
    printf '[stack] lỗi=không kết nối được Redis để dọn slot %s\n' "$u_tdr_slot" >&2
    return 1
  }
  if [ "$u_tdr_pong" != PONG ]; then
    printf '[stack] lỗi=Redis PING trả %s khi dọn slot %s\n' "$u_tdr_pong" "$u_tdr_slot" >&2
    return 1
  fi
  u_tdr_db=${REDIS_DB:-0}
  u_tdr_prefix=${REDIS_KEY_PREFIX:-${u_tdr_slot}:}
  # Chỉ dọn phạm vi DB hoặc prefix của slot; tuyệt đối không dùng FLUSHALL.
  if [ "$u_redis_isolation" = prefix ] || [ "${SLOT:-0}" -gt 15 ]; then
    u_redis_flush_prefix "$u_tdr_db" "$u_tdr_prefix"
    return $?
  fi
  u_redis_cli -n "$u_tdr_db" FLUSHDB >/dev/null
}

stack_setup() {
  u_install_deps || return
  if [ -f "$UNIT_DIR/prisma/schema.prisma" ]; then
    pnpm --dir "$UNIT_DIR" exec prisma generate || return
  fi
  if [ -n "${SLOT_NAME:-}" ]; then
    u_ensure_slot_db || return
  else
    printf '[stack] thông_báo=chưa có slot nên bỏ qua tạo DB slot; chạy run.sh slot rồi setup hoặc migrate\n' >&2
  fi
}

# Áp migration sẵn có lên DB của slot (không dùng `migrate dev` để tránh tương tác/tự sinh migration).
# cần kiểm: nếu dự án có script migrate riêng trong package.json thì đối chiếu.
stack_migrate() {
  u_ensure_slot_db || return
  pnpm --dir "$UNIT_DIR" exec prisma migrate deploy || return
  pnpm --dir "$UNIT_DIR" exec prisma generate
}

# cần kiểm: lệnh seed thật của dự án (`prisma db seed` hoặc `pnpm --dir "$UNIT_DIR" run seed`).
stack_seed() {
  pnpm --dir "$UNIT_DIR" exec prisma db seed
}

# Đúng nguyên văn luật Đại ca (OWNER-RULES): `pnpm run test:cov --maxWorkers=2`, dùng --dir thay cho cd.
stack_test() { pnpm --dir "$UNIT_DIR" run test:cov --maxWorkers=2; }

# cần kiểm: tên script e2e trong package.json (thường là test:e2e). Nếu các suite e2e xoá bảng dùng chung trên
# cùng DB slot, đổi --maxWorkers=2 thành --runInBand hoặc tách DB theo JEST_WORKER_ID.
stack_e2e() { pnpm --dir "$UNIT_DIR" run test:e2e --maxWorkers=2; }

stack_build() { pnpm --dir "$UNIT_DIR" run build; }

# cần kiểm: đảm bảo script lint chỉ kiểm, không tự sửa file (--fix/--write).
stack_lint() { pnpm --dir "$UNIT_DIR" run lint; }

# Build rồi chạy trực tiếp file JS bằng `exec node` (không dùng `start:dev` / `--watch` / `--inspect` để
# dừng tác vụ nền là dừng sạch tiến trình con và không mở cổng cố định 9229).
# NODE_ENV chỉ đặt ở đây, không đặt trong file slot (`test` cũng nạp file slot).
# cần kiểm: đường dẫn file chạy sau build (`dist/main.js` hoặc `dist/src/main.js`).
stack_serve() {
  stack_build || return
  exec env NODE_ENV=development node "$UNIT_DIR/dist/main.js"
}

stack_doctor() {
  u_doc_rc=0
  if u_has_node_modules; then
    printf 'node_modules=có\n'
  else
    printf 'node_modules=thiếu gợi_ý=sh workflow/run.sh setup %s %s\n' "$WT" "$UNIT"
    u_doc_rc=1
  fi

  if [ -f "$UNIT_DIR/prisma/schema.prisma" ]; then
    if [ -d "$UNIT_DIR/node_modules/.prisma/client" ] || [ -d "$WT/node_modules/.prisma/client" ] || [ -d "$UNIT_DIR/generated/prisma" ]; then
      printf 'prisma_client=có\n'
    else
      printf 'prisma_client=chưa_sinh gợi_ý=sh workflow/run.sh migrate %s %s\n' "$WT" "$UNIT"
    fi
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

  if ! command -v redis-cli >/dev/null 2>&1 && [ -z "$u_redis_container" ]; then
    printf 'redis=thiếu_công_cụ gợi_ý=cài redis-cli hoặc đặt u_redis_container\n'
    u_doc_rc=1
  else
    u_doc_pong=$(u_redis_cli PING 2>/dev/null || true)
    if [ "$u_doc_pong" = PONG ]; then
      printf 'redis=sẵn_sàng host=%s port=%s\n' "${REDIS_HOST:-$u_redis_host}" "${REDIS_PORT:-$u_redis_port}"
    else
      printf 'redis=không_kết_nối_được host=%s port=%s container=%s\n' "${REDIS_HOST:-$u_redis_host}" "${REDIS_PORT:-$u_redis_port}" "${u_redis_container:--}"
      u_doc_rc=1
    fi
  fi

  return "$u_doc_rc"
}

# Mỗi dòng KEY=giá_trị; TUYỆT ĐỐI KHÔNG chứa `&`, nháy, dấu cách, $, (), ;, |, <, >, backtick, ký tự điều khiển.
# Tham số Postgres tách thành biến riêng (PGSSLMODE, PGCONNECT_TIMEOUT…), không ghép `&` trong DATABASE_URL.
# PGHOST/PGPORT/PGUSER/PGPASSWORD cũng cần cho createdb/dropdb/psql vì chúng không đọc DATABASE_URL.
stack_slot_env() {
  printf 'PORT=%s\n' "$SLOT_PORT"
  printf 'DATABASE_URL=postgresql://%s:%s@%s:%s/%s_%s?schema=public\n' \
    "$u_pg_user" "$u_pg_password" "$u_pg_host" "$u_pg_port" "$u_db_prefix" "$SLOT_NAME"
  printf 'PGHOST=%s\n' "$u_pg_host"
  printf 'PGPORT=%s\n' "$u_pg_port"
  printf 'PGUSER=%s\n' "$u_pg_user"
  printf 'PGPASSWORD=%s\n' "$u_pg_password"
  printf 'PGDATABASE=%s_%s\n' "$u_db_prefix" "$SLOT_NAME"
  printf 'PGSSLMODE=%s\n' "$u_pg_sslmode"
  printf 'PGCONNECT_TIMEOUT=%s\n' "$u_pg_connect_timeout"
  printf 'REDIS_HOST=%s\n' "$u_redis_host"
  printf 'REDIS_PORT=%s\n' "$u_redis_port"
  if [ "$u_redis_isolation" = prefix ] || [ "${SLOT:-0}" -gt 15 ]; then
    printf 'REDIS_DB=0\n'
  else
    printf 'REDIS_DB=%s\n' "$SLOT"
  fi
  printf 'REDIS_KEY_PREFIX=%s:\n' "$SLOT_NAME"
  # Biến nền lấy danh sách từ .env.example / .env.sample / .env.template (tuyệt đối không đọc .env thật), chỉ điền GIÁ TRỊ THỬ:
  # printf 'JWT_SECRET=slot_dev_jwt_secret_%s\n' "$SLOT_NAME"
  # Nếu unit cần cổng phụ (gRPC, metrics, WebSocket) hoặc gọi unit khác cùng slot, dùng slot_port_at <offset>:
  # printf 'METRICS_PORT=%s\n' "$(slot_port_at 1)"
}

# Chỉ xoá DB và dữ liệu Redis thuộc đúng slot này. Lỗi thì trả mã khác 0 để run.sh giữ file slot chạy lại sau.
stack_teardown() {
  if [ -z "${SLOT_NAME:-}" ]; then
    return 0
  fi
  u_td_rc=0
  u_td_db="${u_db_prefix}_$SLOT_NAME"
  if ! u_pg_cmd dropdb --if-exists "$u_td_db"; then
    printf '[stack] lỗi=không xoá được DB %s gợi_ý=kiểm quyền Postgres dev hoặc container %s\n' "$u_td_db" "${u_pg_container:--}" >&2
    u_td_rc=1
  fi
  if ! u_teardown_redis; then
    u_td_rc=1
  fi
  return "$u_td_rc"
}
