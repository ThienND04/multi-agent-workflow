# unit: server
# loại: web-service
# nguồn lệnh: MẪU của kit (chưa khảo sát). Master thay bằng nguồn thật: package.json scripts + CI, <ngày>, <SHA ngắn>
# Đại ca duyệt: chưa
#
# Mẫu NestJS + pnpm + MongoDB + Redis. Chép thành workflow/stack/<unit>.sh rồi sửa theo dự án.
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
UNIT_TOOLS="pnpm node"       # pnpm và node bắt buộc trên máy; mongosh/redis-cli kiểm trong stack_doctor (hỗ trợ docker exec)
}

# Tên DB của slot = <tiền tố>_<SLOT_NAME>, để mọi slot có DB riêng, không bao giờ trỏ DB chung.
u_db_prefix=app              # Master đổi theo tên app
u_mongo_host=127.0.0.1:27017 # Mongo dev cục bộ (dùng 127.0.0.1 tránh lệch IPv6 ::1 với Docker)
u_mongo_container="${U_MONGO_CONTAINER:-}" # tuỳ chọn: tên container Mongo khi máy không cài mongosh (vd: app-mongo)
u_mongo_container_port=27017

u_redis_host=127.0.0.1
u_redis_port=6379
u_redis_isolation=db         # db (dùng REDIS_DB=$SLOT cho 0..15) | prefix (dùng chung DB 0 + xoá theo REDIS_KEY_PREFIX)
u_redis_container="${U_REDIS_CONTAINER:-}" # tuỳ chọn: tên container Redis khi máy không cài redis-cli (vd: app-redis)
u_redis_container_port=6379

u_has_node_modules() {
  [ -d "$UNIT_DIR/node_modules" ] || [ -d "$WT/node_modules" ]
}

u_mongosh_eval() {
  u_mgc_db=$1
  u_mgc_js=$2
  if command -v mongosh >/dev/null 2>&1; then
    mongosh "mongodb://$u_mongo_host/$u_mgc_db" --quiet --eval "$u_mgc_js"
    return $?
  fi
  if [ -n "$u_mongo_container" ]; then
    if ! command -v docker >/dev/null 2>&1; then
      printf '[stack] lỗi=thiếu mongosh và thiếu docker để chạy container %s gợi_ý=cài mongosh hoặc docker\n' "$u_mongo_container" >&2
      return 1
    fi
    u_mgc_running=$(docker inspect -f '{{.State.Running}}' "$u_mongo_container" 2>/dev/null || true)
    if [ "$u_mgc_running" != true ]; then
      printf '[stack] lỗi=container Mongo %s chưa chạy gợi_ý=docker start %s\n' "$u_mongo_container" "$u_mongo_container" >&2
      return 1
    fi
    docker exec "$u_mongo_container" mongosh "mongodb://127.0.0.1:$u_mongo_container_port/$u_mgc_db" --quiet --eval "$u_mgc_js"
    return $?
  fi
  printf '[stack] lỗi=thiếu mongosh trên máy và chưa đặt u_mongo_container gợi_ý=cài mongosh hoặc đặt u_mongo_container\n' >&2
  return 1
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

u_teardown_mongo() {
  u_tdm_slot=${SLOT_NAME:-}
  if [ -z "$u_tdm_slot" ]; then
    return 0
  fi
  u_tdm_db="${u_db_prefix}_$u_tdm_slot"
  u_mongosh_eval "$u_tdm_db" "db.dropDatabase()" >/dev/null
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

# Monorepo pnpm workspace cài ở gốc $WT; repo một gói có lockfile riêng ở $UNIT_DIR thì cài tại $UNIT_DIR.
# --frozen-lockfile: không tự sửa pnpm-lock.yaml (lockfile là file dùng chung, chỉ một việc được đổi).
stack_setup() {
  if [ -f "$WT/pnpm-workspace.yaml" ] || [ ! -f "$UNIT_DIR/pnpm-lock.yaml" ]; then
    pnpm --dir "$WT" install --frozen-lockfile
  else
    pnpm --dir "$UNIT_DIR" install --frozen-lockfile
  fi
}

# Tuỳ chọn (bỏ `#` nếu dự án có script seed / e2e):
# cần kiểm: tên script seed thật trong package.json (ví dụ seed, db:seed)
# stack_seed() { pnpm --dir "$UNIT_DIR" run seed; }

# Đúng nguyên văn luật Đại ca (OWNER-RULES): `pnpm run test:cov --maxWorkers=2`, dùng --dir thay cho cd.
stack_test() { pnpm --dir "$UNIT_DIR" run test:cov --maxWorkers=2; }

# cần kiểm: tên script e2e thật trong package.json; nếu e2e xoá collection dùng chung, cân nhắc --runInBand
# stack_e2e() { pnpm --dir "$UNIT_DIR" run test:e2e --maxWorkers=2; }

stack_build() { pnpm --dir "$UNIT_DIR" run build; }

# cần kiểm: đảm bảo script lint chỉ kiểm, không tự sửa file (--fix/--write).
stack_lint() { pnpm --dir "$UNIT_DIR" run lint; }

# Build rồi chạy trực tiếp file JS bằng `exec node`: không dùng `start:dev` (--watch hay mở tiến trình con)
# và không dùng `start:debug` (--inspect mở cổng cố định 9229 gây đụng giữa các slot).
# NODE_ENV chỉ đặt ở đây, không đặt trong file slot: `test` cũng nạp file slot, mà jest chỉ tự đặt NODE_ENV=test khi biến này chưa có.
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

  if ! command -v mongosh >/dev/null 2>&1 && [ -z "$u_mongo_container" ]; then
    printf 'mongo=thiếu_công_cụ gợi_ý=cài mongosh hoặc đặt u_mongo_container\n'
    u_doc_rc=1
  elif u_mongosh_eval admin "if (!db.runCommand({ ping: 1 }).ok) { quit(1); }" >/dev/null 2>&1; then
    printf 'mongo=sẵn_sàng host=%s\n' "$u_mongo_host"
  else
    printf 'mongo=không_kết_nối_được host=%s container=%s\n' "$u_mongo_host" "${u_mongo_container:--}"
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
# Nếu kết nối Mongo cần thêm tham số (vd: authSource, replicaSet), tách biến riêng, KHÔNG ghép `&` vào MONGO_URI.
# cần kiểm: tên biến app thật sự đọc (MONGO_URI, MONGODB_URI, REDIS_URL…) và app có đọc từ biến môi trường không.
stack_slot_env() {
  printf 'PORT=%s\n' "$SLOT_PORT"
  printf 'MONGO_URI=mongodb://%s/%s_%s\n' "$u_mongo_host" "$u_db_prefix" "$SLOT_NAME"
  # Ví dụ tham số Mongo tách riêng (nếu app hỗ trợ):
  # printf 'MONGO_AUTH_SOURCE=admin\n'
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

# Mongo tự tạo DB khi ghi lần đầu, nên chỉ cần xoá DB và dữ liệu Redis mang đúng slot này.
# Lỗi thì trả mã khác 0: run.sh giữ file slot để chạy lại teardown sau khi sửa.
stack_teardown() {
  if [ -z "${SLOT_NAME:-}" ]; then
    return 0
  fi
  u_td_rc=0
  if ! u_teardown_mongo; then
    printf '[stack] lỗi=không xoá được DB %s_%s gợi_ý=kiểm Mongo hoặc container %s\n' "$u_db_prefix" "$SLOT_NAME" "${u_mongo_container:--}" >&2
    u_td_rc=1
  fi
  if ! u_teardown_redis; then
    u_td_rc=1
  fi
  return "$u_td_rc"
}
