#!/usr/bin/env sh
# Cửa duy nhất để agent chạy lệnh code của dự án: cài, test, build, chạy server, chạy thử.
# Vì sao: luật Bash (workflow/OWNER-RULES.md) cấm agent gõ cd, tiền tố biến môi trường và lệnh gốc của
# trình gói. run.sh lo các việc đó sau một lệnh đã cấp quyền; lệnh thật của từng unit nằm ở
# workflow/stack/<unit>.sh (Master viết, Đại ca duyệt), nên agent nào cũng chạy đúng lệnh đã duyệt.
#
# Dùng (ở thư mục gốc dự án; Windows dùng Git Bash):
#   sh workflow/run.sh <động từ> <worktree tuyệt đối> <unit> [n]
#     slot <n>                               ghi <worktree>/.slot.<unit>.env cho slot n
#     setup | migrate | seed | test | e2e | build | serve | smoke | lint   gọi stack_<động từ> của file unit
#     doctor                                 in cấu hình unit, slot, cổng, công cụ thiếu
#     teardown                               gọi stack_teardown (nếu có) rồi xoá file slot
# Đặc tả: workflow/stack/README.md. Mã thoát 2 là lỗi của run.sh; mã khác là của lệnh thật, trả nguyên.

set -u

# Biến nội bộ viết thường: dòng env của slot (chỉ chữ hoa) không đè được chúng.
stack_verbs='setup migrate seed test e2e build serve smoke lint'
slot_pattern='.slot.*.env'
max_port=65535
# Dạng dòng env hợp lệ theo đặc tả: không có ký tự nào để shell hiểu thành lệnh (tuyệt đối chặn & và ký tự điều khiển).
env_line_re='^[A-Z_][A-Z0-9_]*=[^`$();&|<>[:cntrl:]]*$'
# Biến run.sh đặt cho file unit: file slot mà đè thì lệnh chạy sai thư mục, sai cổng hay sai PATH.
reserved_re='^(ROOT|WT|UNIT|UNIT_DIR|UNIT_PATH|UNIT_KIND|PORT_OFFSET|HEALTH_PATH|UNIT_TOOLS|BASE_PORT|SLOT_STRIDE|PATH|IFS)='
# Ba biến header ở dòng 1-3 do run_slot() sinh: stack_slot_env và dòng 4+ của .slot.<unit>.env không được ghi đè.
slot_reserved_re='^(SLOT|SLOT_PORT|SLOT_NAME)='
usage='sh workflow/run.sh <slot|setup|migrate|seed|test|e2e|build|serve|smoke|lint|doctor|teardown> <worktree tuyệt đối> <unit> [n]'

log()  { printf '[run.sh] %s\n' "$*" >&2; }
fail() { log "lỗi=$1 gợi_ý=$2"; exit 2; }

# Số nguyên >= 0 không có số 0 đứng đầu: sh hiểu 010 là số bát phân.
is_uint() { case $1 in ''|*[!0-9]*|0?*) return 1 ;; esac; }

# Đường dẫn thật (bỏ symlink; Git Bash đổi C:/x thành /c/x) để so worktree cho đúng.
real_dir() { (cd "$1" 2>/dev/null && pwd -P); }

# command -v in đúng tên khi đó là hàm, in đường dẫn khi là chương trình ngoài.
has_function() { [ "$(command -v "$1")" = "$1" ]; }

check_verb() {
  case $1 in
    slot|setup|migrate|seed|test|e2e|build|serve|smoke|lint|doctor|teardown) ;;
    *) fail "động từ lạ: $1" "$usage" ;;
  esac
}

# Gốc = worktree chính (dòng đầu git worktree list), tìm từ chỗ đặt run.sh chứ không từ thư mục hiện tại:
# file stack luôn đọc ở gốc, vì bản workflow/ trong worktree là bản cũ.
resolve_root() {
  here=$(real_dir "$(dirname "$0")") || fail "không mở được thư mục chứa run.sh" "gọi từ thư mục gốc: $usage"
  main_wt=$(git -C "$here" worktree list --porcelain 2>/dev/null | sed -n '1s/^worktree //p')
  [ -n "$main_wt" ] || fail "$here không nằm trong repo git" "chạy git init ở thư mục gốc dự án"
  ROOT=$(real_dir "$main_wt") || fail "không mở được thư mục gốc $main_wt" "xem git worktree list"
  stack_dir="$ROOT/workflow/stack"
}

list_worktrees() {
  git -C "$ROOT" worktree list --porcelain | sed -n 's/^worktree //p' |
    while IFS= read -r wt_path; do real_dir "$wt_path"; done
}

# Chỉ nhận worktree của chính repo này: run.sh cài gói, xoá DB tạm, không được chạy trên thư mục lạ.
resolve_worktree() {
  case $1 in
    /*|[A-Za-z]:[\\/]*) ;;
    *) fail "worktree phải là đường dẫn tuyệt đối: $1" "dùng một dòng của git worktree list" ;;
  esac
  WT=$(real_dir "$1") || fail "không có thư mục $1" "tạo worktree trước: git -C <thư mục gốc> worktree add …"
  list_worktrees | grep -qxF "$WT" ||
    fail "$1 không thuộc git worktree list của $ROOT" "dùng đúng một dòng của: git -C $ROOT worktree list"
}

# Tên _*.sh để dành cho file của kit (_slots.sh), không phải unit.
resolve_unit() {
  case $1 in
    ''|_*|*[!a-z0-9_-]*) fail "tên unit sai: $1" "chỉ a-z 0-9 _ -, không bắt đầu bằng _; xem DECISIONS.md mục 1" ;;
  esac
  UNIT=$1
  unit_file="$stack_dir/$UNIT.sh"
  [ -f "$unit_file" ] || fail "không có file unit workflow/stack/$UNIT.sh" "xem tên unit ở DECISIONS.md mục 1; thiếu thì hỏi Master"
}

# Lệnh trong file unit đã cố định nên chỉ slot nhận đối số (n); test không được thêm cờ.
check_args() {
  if [ "$verb" = slot ]; then
    [ $# -eq 1 ] || fail "slot cần đúng một số n" "sh workflow/run.sh slot $WT $UNIT <n>"
    is_uint "$1" || fail "n phải là số nguyên >= 0: $1" "0 là của Master; Coder, Tester dùng số trong Ngữ cảnh từ Master"
    return 0
  fi
  [ $# -eq 0 ] || fail "$verb không nhận đối số thêm: $*" "sh workflow/run.sh $verb $WT $UNIT"
}

# Xoá giá trị thừa hưởng từ shell gọi trước khi nạp file unit: thiếu biến nào thì nhận mặc định,
# thiếu hàm nào thì báo "không hỗ trợ", không lấy nhầm của môi trường.
load_unit() {
  UNIT_PATH=.
  UNIT_KIND=
  PORT_OFFSET=0
  HEALTH_PATH=
  UNIT_TOOLS=
  unset SLOT SLOT_PORT SLOT_NAME
  unset -f stack_setup stack_migrate stack_seed stack_test stack_e2e stack_build stack_serve stack_smoke stack_lint stack_doctor stack_teardown stack_slot_env
  . "$unit_file"
  UNIT_DIR=$WT
  [ "$UNIT_PATH" = . ] || UNIT_DIR="$WT/$UNIT_PATH"
  [ -d "$UNIT_DIR" ] || fail "không có thư mục unit $UNIT_DIR" "kiểm UNIT_PATH trong workflow/stack/$UNIT.sh"
}

# In số dòng sai dạng hoặc đè biến dành riêng (rỗng là file tốt). Không in nội dung: có thể là khoá thử.
bad_env_lines() {
  LC_ALL=C grep -aq '^$' /dev/null 2>/dev/null
  if [ $? -ne 2 ]; then
    { LC_ALL=C grep -anvE "$env_line_re" "$1"; LC_ALL=C grep -anE "$reserved_re" "$1"; } |
      cut -d: -f1 | sort -un | tr '\n' ' '
    return 0
  fi
  {
    _bel_m=$(LC_ALL=C grep -nvE "$env_line_re" "$1" 2>/dev/null)
    _bel_rc=$?
    if [ "$_bel_rc" -eq 0 ] && [ -z "$_bel_m" ]; then
      printf '1:\n'
    elif [ -n "$_bel_m" ]; then
      printf '%s\n' "$_bel_m"
    fi
    LC_ALL=C grep -nE "$reserved_re" "$1" 2>/dev/null
  } | cut -d: -f1 | sort -un | tr '\n' ' '
}

# Kiểm dòng 1-3 là header SLOT=/SLOT_PORT=/SLOT_NAME= và dòng 4+ không ghi đè slot_reserved_re.
bad_slot_lines() {
  LC_ALL=C awk -v re="$slot_reserved_re" '
    NR == 1 && $0 !~ /^SLOT=/ { print NR }
    NR == 2 && $0 !~ /^SLOT_PORT=/ { print NR }
    NR == 3 && $0 !~ /^SLOT_NAME=/ { print NR }
    NR >= 4 && $0 ~ re { print NR }
    END { if (NR < 3) print "EOF" }
  ' "$1" | tr '\n' ' '
}

# Nạp file slot thành biến môi trường (thay cho tiền tố FOO=bar mà agent bị cấm gõ). Kiểm hết file trước,
# một dòng sai là dừng, không nạp gì. Gán từng dòng bằng export, tương đương set -a … set +a nhưng an toàn
# hơn `. file`: `. file` vẫn chạy dòng như "A=1 lệnh", export chỉ gán chữ.
load_slot_env() {
  [ -f "$slot_file" ] || return 0
  bad=$(bad_env_lines "$slot_file")
  [ -z "$bad" ] || fail "file slot có dòng sai dạng (dòng ${bad% }): $slot_file" "không sửa tay; chạy lại: sh workflow/run.sh slot $WT $UNIT <n>"
  bad_slot=$(bad_slot_lines "$slot_file")
  [ -z "$bad_slot" ] || fail "file slot bị sửa header hoặc ghi đè SLOT/SLOT_PORT/SLOT_NAME (dòng ${bad_slot% }): $slot_file" "không sửa tay; chạy lại: sh workflow/run.sh slot $WT $UNIT <n>"
  while IFS= read -r line || [ -n "$line" ]; do export "$line"; done < "$slot_file"
}

# Kiểm trước khi in dòng log, để agent thấy lỗi rõ thay vì lệnh chạy dở.
check_supported() {
  case $verb in slot|doctor|teardown) return 0 ;; esac
  has_function "stack_$verb" ||
    fail "unit $UNIT không hỗ trợ $verb" "cần thì hỏi Master thêm stack_$verb vào workflow/stack/$UNIT.sh"
  # Động từ chạm DB hoặc mở server cần slot để cô lập DB và cổng giữa các agent.
  case $verb in
    migrate|seed|e2e)
      [ -n "${SLOT_NAME:-}" ] ||
        fail "$verb cần slot, chưa có $slot_file" "sh workflow/run.sh slot $WT $UNIT <n> (n theo Ngữ cảnh từ Master)" ;;
    serve)
      [ -n "${SLOT_NAME:-}" ] && [ -n "${SLOT_PORT:-}" ] ||
        fail "serve cần slot, chưa có $slot_file" "sh workflow/run.sh slot $WT $UNIT <n> (n theo Ngữ cảnh từ Master)" ;;
  esac
}

# Khối cổng ở một chỗ cho cả repo (_slots.sh). Kiểm số trước khi tính để lỗi cấu hình hiện rõ.
load_port_config() {
  slots_file="$stack_dir/_slots.sh"
  [ -f "$slots_file" ] || fail "thiếu workflow/stack/_slots.sh" "chép lại từ kit (BASE_PORT=4000, SLOT_STRIDE=10)"
  BASE_PORT=
  SLOT_STRIDE=
  unset -f slot_port_at
  . "$slots_file"
  is_uint "$BASE_PORT" && [ "${#BASE_PORT}" -le 5 ] && [ "$BASE_PORT" -ge 1 ] && [ "$BASE_PORT" -le "$max_port" ] &&
    is_uint "$SLOT_STRIDE" && [ "$SLOT_STRIDE" != 0 ] ||
    fail "BASE_PORT=$BASE_PORT SLOT_STRIDE=$SLOT_STRIDE không hợp lệ" "sửa workflow/stack/_slots.sh: số nguyên, 1 <= BASE_PORT <= $max_port, SLOT_STRIDE > 0"
  is_uint "$PORT_OFFSET" && [ "${#PORT_OFFSET}" -le 5 ] && [ "$PORT_OFFSET" -le "$max_port" ] &&
    { [ "${#SLOT_STRIDE}" -gt 5 ] || [ "$PORT_OFFSET" -lt "$SLOT_STRIDE" ]; } ||
    fail "PORT_OFFSET=$PORT_OFFSET phải là số nguyên nhỏ hơn SLOT_STRIDE=$SLOT_STRIDE" "Master sửa workflow/stack/$UNIT.sh"
  [ $((BASE_PORT + PORT_OFFSET)) -ge 1 ] && [ $((BASE_PORT + PORT_OFFSET)) -le "$max_port" ] ||
    fail "BASE_PORT=$BASE_PORT + PORT_OFFSET=$PORT_OFFSET phải trong 1..$max_port" "điều chỉnh BASE_PORT trong workflow/stack/_slots.sh hoặc PORT_OFFSET trong workflow/stack/$UNIT.sh"
}

port_of() {
  is_uint "${1:-}" || return 1
  if [ "$1" = 0 ]; then
    echo $((BASE_PORT + PORT_OFFSET))
    return 0
  fi
  [ "${#1}" -le 5 ] && [ "${#SLOT_STRIDE}" -le 5 ] || return 1
  [ "$1" -le $(((max_port - BASE_PORT - PORT_OFFSET) / SLOT_STRIDE)) ] || return 1
  echo $((BASE_PORT + $1 * SLOT_STRIDE + PORT_OFFSET))
}

# Kiểm tra cổng TCP localhost có đang lắng nghe không. Trả: 0 = đang bận, 1 = rảnh, 2 = không kiểm được.
port_status() {
  [ $# -eq 1 ] && is_uint "$1" && [ "${#1}" -le 5 ] && [ "$1" -ge 1 ] && [ "$1" -le "$max_port" ] || return 2
  if command -v ss >/dev/null 2>&1; then
    if _ps_out=$(ss -H -ltn "sport = :$1" 2>/dev/null); then
      case $_ps_out in *[![:space:]]*) return 0 ;; esac
      return 1
    fi
  fi
  _ps_lsof_ok=0
  if command -v lsof >/dev/null 2>&1; then
    _ps_out=$(lsof -t -nP -iTCP:"$1" -sTCP:LISTEN 2>/dev/null)
    _ps_rc=$?
    if [ "$_ps_rc" -eq 0 ]; then
      case $_ps_out in *[![:space:]]*) return 0 ;; esac
      return 1
    elif [ "$_ps_rc" -eq 1 ]; then
      _ps_lsof_ok=1
    fi
  fi
  if command -v node >/dev/null 2>&1; then
    node -e '
      const net = require("net");
      const port = Number(process.argv[1]);
      const hosts = ["127.0.0.1", "::1"];
      let i = 0;
      function next() {
        if (i >= hosts.length) process.exit(10);
        const s = net.createConnection({ host: hosts[i++], port });
        s.setTimeout(300);
        s.once("connect", () => { s.destroy(); process.exit(0); });
        s.once("timeout", () => { s.destroy(); next(); });
        s.once("error", () => { s.destroy(); next(); });
      }
      next();
    ' "$1" >/dev/null 2>&1
    case $? in
      0) return 0 ;;
      10) return 1 ;;
    esac
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 -c '
import socket, sys
port = int(sys.argv[1])
for fam, host in ((socket.AF_INET, "127.0.0.1"), (socket.AF_INET6, "::1")):
    s = None
    try:
        s = socket.socket(fam, socket.SOCK_STREAM)
        s.settimeout(0.3)
        if s.connect_ex((host, port)) == 0:
            sys.exit(0)
    except OSError:
        pass
    finally:
        if s is not None:
            s.close()
sys.exit(10)
' "$1" >/dev/null 2>&1
    case $? in
      0) return 0 ;;
      10) return 1 ;;
    esac
  fi
  if command -v nc >/dev/null 2>&1; then
    _ps_nc_ok=0
    for _ps_host in 127.0.0.1 ::1; do
      _ps_nc_rc=0
      nc -z -w 1 "$_ps_host" "$1" >/dev/null 2>&1 || _ps_nc_rc=$?
      case $_ps_nc_rc in
        0) return 0 ;;
        1) _ps_nc_ok=1 ;;
      esac
    done
    [ "$_ps_nc_ok" -eq 1 ] && return 1
  fi
  [ "$_ps_lsof_ok" -eq 1 ] && return 1
  return 2
}

check_prereqs() {
  if [ "$verb" = serve ]; then
    _cp_rc=0
    port_status "$SLOT_PORT" || _cp_rc=$?
    case $_cp_rc in
      0) fail "cổng $SLOT_PORT đang có tiến trình lắng nghe" "dừng server cũ hoặc chạy sh workflow/run.sh teardown $WT $UNIT" ;;
      2) log "cảnh_báo=không kiểm được trạng thái cổng $SLOT_PORT, vẫn tiếp tục serve" ;;
    esac
  fi
  case $verb in
    test|build|serve|lint|e2e)
      if [ -f "$UNIT_DIR/package.json" ] && [ ! -d "$UNIT_DIR/node_modules" ] && [ ! -d "$WT/node_modules" ]; then
        fail "thiếu node_modules ở $UNIT_DIR (đã có package.json)" "sh workflow/run.sh setup $WT $UNIT"
      fi ;;
  esac
}

# .slot.*.env là của máy này (cổng, DB tạm): bỏ qua cục bộ để không lọt vào commit,
# không đụng .gitignore của dự án. info/exclude dùng chung cho mọi worktree.
exclude_slot_files() {
  exclude=$(git -C "$ROOT" rev-parse --git-path info/exclude) || fail "không tìm được .git/info/exclude" "xem git -C $ROOT status"
  case $exclude in /*|[A-Za-z]:*) ;; *) exclude="$ROOT/$exclude" ;; esac
  grep -qxF "$slot_pattern" "$exclude" 2>/dev/null && return 0
  mkdir -p "$(dirname "$exclude")"
  printf '\n# workflow multi-agent: file slot do run.sh sinh, không commit\n%s\n' "$slot_pattern" >> "$exclude" ||
    fail "không ghi được $exclude" "kiểm quyền ghi thư mục .git"
}

# Hai agent cùng slot sẽ tranh cổng và DB tạm. Chỉ cảnh báo: Master là người chia slot.
warn_slot_in_use() {
  list_worktrees | while IFS= read -r other; do
    [ "$other" != "$WT" ] || continue
    grep -qxF "SLOT=$SLOT" "$other/.slot.$UNIT.env" 2>/dev/null &&
      log "cảnh_báo=slot $SLOT của unit $UNIT đang có ở $other gợi_ý=báo Master nếu không cố ý"
  done
}

write_slot_lines() {
  printf 'SLOT=%s\nSLOT_PORT=%s\nSLOT_NAME=%s\n' "$SLOT" "$SLOT_PORT" "$SLOT_NAME"
  if has_function stack_slot_env; then stack_slot_env; fi
}

# Ghi ra file tạm, kiểm, rồi mới thay file cũ: lỗi giữa chừng không để lại file nửa vời cho động từ sau nạp.
run_slot() {
  # Kiểm giới hạn qua port_of để tránh tràn số 64-bit và bảo đảm cổng <= max_port.
  SLOT_PORT=$(port_of "$1") ||
    fail "slot $1 cho cổng vượt $max_port" "dùng n nhỏ hơn, hoặc giảm BASE_PORT trong workflow/stack/_slots.sh"
  SLOT=$1
  SLOT_NAME="s$1"
  exclude_slot_files
  warn_slot_in_use
  tmp="$WT/.slot.$UNIT.tmp.env"
  write_slot_lines > "$tmp" || { rm -f "$tmp"; fail "stack_slot_env lỗi" "Master xem workflow/stack/$UNIT.sh"; }
  bad=$(bad_env_lines "$tmp")
  if [ -n "$bad" ]; then
    rm -f "$tmp"
    fail "stack_slot_env in dòng sai dạng (dòng ${bad% })" "Master sửa workflow/stack/$UNIT.sh: mỗi dòng TÊN=giá_trị, không ký tự lệnh của shell"
  fi
  bad_slot=$(bad_slot_lines "$tmp")
  if [ -n "$bad_slot" ]; then
    rm -f "$tmp"
    fail "stack_slot_env không được ghi đè SLOT/SLOT_PORT/SLOT_NAME (dòng ${bad_slot% })" "Master sửa workflow/stack/$UNIT.sh: bỏ SLOT, SLOT_PORT, SLOT_NAME khỏi stack_slot_env"
  fi
  mv -f "$tmp" "$slot_file" || fail "không ghi được $slot_file" "kiểm quyền ghi worktree"
  log "slot=$SLOT slot_port=$SLOT_PORT slot_name=$SLOT_NAME file=$slot_file"
}

supported_verbs() {
  verbs='slot doctor teardown'
  for v in $stack_verbs; do
    if has_function "stack_$v"; then verbs="$verbs $v"; fi
  done
  echo "$verbs"
}

print_slot_state() {
  if [ -z "${SLOT:-}" ]; then
    printf 'slot=- cổng_nếu_slot_0=%s gợi_ý=sh workflow/run.sh slot %s %s <n>\n' "$(port_of 0)" "$WT" "$UNIT"
  else
    printf 'slot=%s slot_name=%s slot_port=%s file=%s\n' "$SLOT" "${SLOT_NAME:-}" "${SLOT_PORT:-}" "$slot_file"
    if ! _pss_port=$(port_of "$SLOT") || [ "${SLOT_PORT:-}" != "$_pss_port" ]; then
      printf 'cảnh_báo=cổng trong file slot khác cấu hình hiện tại gợi_ý=chạy lại sh workflow/run.sh slot %s %s <n>\n' "$WT" "$UNIT"
    fi
  fi
  if [ -n "${SLOT_PORT:-}" ]; then
    _pss_rc=0
    port_status "$SLOT_PORT" || _pss_rc=$?
    case $_pss_rc in
      0) printf 'cổng_trạng_thái=đang_bận cổng=%s gợi_ý=nếu không phải server của slot này thì dừng tiến trình cũ trước khi serve\n' "$SLOT_PORT" ;;
      1) printf 'cổng_trạng_thái=rảnh cổng=%s\n' "$SLOT_PORT" ;;
      *) printf 'cổng_trạng_thái=không_kiểm_được cổng=%s\n' "$SLOT_PORT" ;;
    esac
  fi
}

# Công cụ đoán từ chữ đầu của các hàm stack_* viết một dòng, bỏ exec/env/VAR=val ở đầu.
# Hàm nhiều dòng hay lệnh bắt đầu bằng biến thì khai báo thêm ở UNIT_TOOLS="...".
unit_tools() {
  sed -n '/^stack_[a-z0-9_]*()[[:space:]]*{/{
    s/^[^{]*{[[:space:]]*//
    :strip
    s/^exec[[:space:]][[:space:]]*//
    s/^env[[:space:]][[:space:]]*//
    s/^[A-Za-z_][A-Za-z0-9_]*="[^"]*"[[:space:]][[:space:]]*//
    s/^[A-Za-z_][A-Za-z0-9_]*='\''[^'\'']*'\''[[:space:]][[:space:]]*//
    s/^[A-Za-z_][A-Za-z0-9_]*=[^[:space:];]*[[:space:]][[:space:]]*//
    t strip
    s/^\([^[:space:];}"$#'\''(]\{1,\}\).*/\1/p
  }' "$unit_file" | sort -u
}

# Mã 1 khi thiếu công cụ, để Master biết máy chưa đủ trước khi giao việc.
print_tools() {
  found=
  missing=
  for tool in git ${UNIT_TOOLS:-} $(unit_tools); do
    case $tool in ''|-*|u_*|stack_*) continue ;; esac
    case " $found $missing " in *" $tool "*) continue ;; esac
    case $(command -v -- "$tool") in
      '') missing="$missing $tool" ;;
      *) found="$found $tool" ;;
    esac
  done
  found=${found# }
  missing=${missing# }
  printf 'công_cụ_có=%s công_cụ_thiếu=%s\n' "${found:--}" "${missing:--}"
  [ -z "$missing" ]
}

run_doctor() {
  _dr_rc=0
  printf 'unit=%s loại=%s unit_dir=%s port_offset=%s health_path=%s\n' \
    "$UNIT" "${UNIT_KIND:--}" "$UNIT_DIR" "$PORT_OFFSET" "${HEALTH_PATH:--}"
  printf 'động_từ=%s\n' "$(supported_verbs)"
  print_slot_state
  print_tools || _dr_rc=1
  if has_function stack_doctor; then
    stack_doctor || _dr_rc=$?
  fi
  return "$_dr_rc"
}

# Không có file slot thì không dọn gì: stack_teardown thiếu SLOT_NAME có thể xoá nhầm tài nguyên.
# Dọn lỗi thì giữ file slot để chạy lại teardown sau.
run_teardown() {
  if [ ! -f "$slot_file" ]; then
    log "teardown=bỏ_qua lý_do=không có $slot_file"
    return 0
  fi
  if has_function stack_teardown; then stack_teardown || return $?; fi
  rm -f "$slot_file" || fail "không xoá được $slot_file" "kiểm quyền ghi worktree"
  log "teardown=xong đã_xoá=$slot_file"
  if [ -n "${SLOT_PORT:-}" ] && port_status "$SLOT_PORT"; then
    log "cảnh_báo=cổng $SLOT_PORT vẫn đang có tiến trình lắng nghe gợi_ý=dừng server cũ nếu còn chạy"
  fi
  return 0
}

main() {
  [ $# -ge 3 ] || fail "thiếu đối số" "$usage"
  verb=$1
  check_verb "$verb"
  resolve_root
  resolve_worktree "$2"
  resolve_unit "$3"
  shift 3
  check_args "$@"
  slot_file="$WT/.slot.$UNIT.env"
  load_unit
  [ "$verb" = slot ] || load_slot_env
  check_supported
  load_port_config
  check_prereqs
  slot_label=${SLOT:--}
  [ "$verb" != slot ] || slot_label=$1
  log "verb=$verb unit=$UNIT slot=$slot_label wt=$WT"
  # Lệnh của unit chạy tại thư mục unit (đường dẫn tương đối như `go test ./...` cần vậy).
  cd "$UNIT_DIR" || fail "không vào được $UNIT_DIR" "kiểm quyền thư mục"
  case $verb in
    slot) run_slot "$1" ;;
    doctor) run_doctor ;;
    teardown) run_teardown ;;
    # Gọi ngay trong tiến trình này, không subshell: exec trong stack_serve thay chính run.sh,
    # nên dừng tác vụ nền là dừng server. Mã thoát của lệnh thật trả nguyên.
    *) "stack_$verb" ;;
  esac
}

main "$@"
