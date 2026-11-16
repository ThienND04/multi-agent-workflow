#!/usr/bin/env sh
# watch.sh: theo dõi các file trao đổi trong workflow/, đánh thức agent có việc, sinh STATUS.md.
#
# Dùng:
#   sh workflow/watch.sh                 chạy liên tục, quét 30 giây một lần (Ctrl+C để dừng)
#   sh workflow/watch.sh --interval 60   đổi chu kỳ quét
#   sh workflow/watch.sh --once          quét một lần rồi thoát
#
# Quy tắc: file nào có dòng `to: <ID>` ở đầu là đang chờ agent đó.
#   - Agent "auto" trong agents.txt: chạy lệnh đánh thức (một phiên mới, không tương tác).
#   - Agent "manual": chỉ báo ra màn hình và qua Telegram (nếu đã cấu hình).
#   - Agent "subagent": không làm gì; Master tự gọi subagent đó trong phiên chat của nó.
#   - `to: owner`: báo chủ dự án.
# Script không tốn token khi không có việc: chỉ đọc file và so sánh.
# Một agent chỉ được đánh thức lại khi các file chờ nó THAY ĐỔI, để tránh vòng lặp.

set -u
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
W="$ROOT/workflow"
RUN="$W/.run"
LOGS="$W/logs"
AGENTS="$W/agents.txt"
INTERVAL=30
ONCE=0

while [ $# -gt 0 ]; do
  case "$1" in
    --once) ONCE=1 ;;
    --interval) shift; INTERVAL="$1" ;;
    *) echo "Tham số không hiểu: $1"; exit 1 ;;
  esac
  shift
done

[ -f "$AGENTS" ] || { echo "Thiếu $AGENTS. Xem SETUP.md."; exit 1; }
mkdir -p "$RUN" "$LOGS"

say() { echo "[$(date '+%H:%M:%S')] $*"; }

# running <id>: agent đang chạy thật (tiến trình ghi trong file .pid còn sống)
running() { [ -f "$RUN/$1.pid" ] && kill -0 "$(cat "$RUN/$1.pid" 2>/dev/null)" 2>/dev/null; }

notify() {
  if [ -f "$W/notify.sh" ]; then sh "$W/notify.sh" "$1" >/dev/null 2>&1; fi
  say "THÔNG BÁO: $1"
}

# fm <file> <khoá>: đọc một khoá trong phần đầu file (giữa hai dòng ---), bỏ chú thích sau dấu #
fm() {
  awk -v k="$2" '
    NR==1 && $0 !~ /^---/ { exit }
    /^---/ { c++; if (c==2) exit; next }
    c==1 && index($0, k ":")==1 {
      v = substr($0, length(k)+2); sub(/#.*/, "", v); gsub(/^[ \t]+|[ \t\r]+$/, "", v); print v; exit
    }' "$1"
}

# owner_lines <dòng scan có to: owner>: mỗi dòng nói rõ chủ dự án cần làm gì
owner_lines() {
  echo "$1" | awk -F'|' '{
    f = $3; if (match(f, /^F-[0-9]+/)) f = substr(f, 1, RLENGTH)
    if ($3 ~ /\/SPEC\.md$/ && $2 == "acceptance") a = "Xong, chờ bạn nghiệm thu (thử rồi nói \"đạt\" với Master)"
    else if ($3 ~ /\/SPEC\.md$/) a = "Tài liệu chờ bạn duyệt (đọc rồi nói \"duyệt\" với Master)"
    else if ($3 ~ /\/questions\//) a = "Câu hỏi chờ bạn trả lời (Master sẽ hỏi trong phiên chat)"
    else a = "Cần bạn xem"
    printf "- [%s] %s: %s (`%s`)\n", f, a, $4, $3
  }'
}

# Liệt kê mọi file trao đổi: <to>|<status>|<đường dẫn tương đối>|<tiêu đề>
scan() {
  for f in "$W"/F-*/SPEC.md "$W"/F-*/tasks/*.md "$W"/F-*/questions/*.md "$W"/F-*/bugs/*.md; do
    [ -f "$f" ] || continue
    to=$(fm "$f" to); st=$(fm "$f" status); ti=$(fm "$f" title)
    [ -n "$to" ] || to="none"
    echo "$to|$st|${f#$W/}|$ti"
  done
}

# Chữ ký nội dung của một danh sách file (để biết có gì thay đổi)
sig_of() {
  [ -n "$1" ] || { echo "empty"; return; }
  # shellcheck disable=SC2086
  (cd "$W" && echo "$1" && cat $1) | cksum | awk '{print $1}'
}

wake() { # wake <id> <vai> <lệnh> <danh sách file>
  id="$1"; role="$2"; cmd="$3"; files="$4"
  prompt="Đọc AGENTS.md và làm theo. ID của bạn: $id. Vai: $role. Bạn được watch.sh đánh thức tự động vì các file sau đang chờ bạn (to: $id): $(echo $files | tr '\n' ' '). Chỉ xử lý những file đó, theo AGENTS.md mục 4 và 5. Xong phần của mình thì đổi to: sang người kế tiếp. Trả lời ngắn."
  log="$LOGS/$(date '+%Y%m%d-%H%M%S')-$id.log"
  (
    cd "$ROOT" || exit 1
    # shellcheck disable=SC2086
    $cmd "$prompt" > "$log" 2>&1 < /dev/null
    echo "[kết thúc, mã $?]" >> "$log"
  ) &
  echo $! > "$RUN/$id.pid"
  say "Đánh thức $id ($role). Log: ${log#$ROOT/}"
}

write_status() { # write_status <kết quả scan>
  data="$1"; out="$W/STATUS.md"; tmp="$RUN/STATUS.tmp"
  {
    echo "# Trạng thái"
    echo
    echo "_Do watch.sh tự sinh lúc $(date '+%d/%m/%Y %H:%M'). Đừng sửa tay._"
    echo
    echo "## Chờ bạn"
    echo
    owner=$(echo "$data" | awk -F'|' '$1=="owner"')
    if [ -n "$owner" ]; then owner_lines "$owner"; else echo "Không có."; fi
    echo
    echo "## Agent"
    echo
    echo "| Agent | Vai | Đánh thức | Đang chạy | File đang chờ |"
    echo "|---|---|---|---|---|"
    grep -v '^[[:space:]]*#' "$AGENTS" | grep -v '^[[:space:]]*$' | while read -r id role mode rest; do
      n=$(echo "$data" | awk -F'|' -v a="$id" '$1==a' | grep -c . )
      running="không"; running "$id" && running="**đang chạy**"
      list=$(echo "$data" | awk -F'|' -v a="$id" '$1==a {printf "%s ", $3}')
      warn=""
      if [ "$n" -gt 0 ] && ! running "$id" && [ -f "$RUN/$id.sig" ] && [ "$mode" = "auto" ]; then
        files=$(echo "$data" | awk -F'|' -v a="$id" '$1==a {print $3}')
        [ "$(sig_of "$files")" = "$(cat "$RUN/$id.sig")" ] && warn=" ⚠ đã đánh thức nhưng chưa xử lý xong, xem log"
      fi
      echo "| $id | $role | $mode | $running | ${list:-–}$warn |"
    done
    echo
    echo "## Tính năng"
    for d in "$W"/F-*/; do
      [ -d "$d" ] || continue
      name=$(basename "$d")
      echo
      echo "### $name"
      echo
      echo "| File | Tiêu đề | Trạng thái | Đang chờ |"
      echo "|---|---|---|---|"
      echo "$data" | awk -F'|' -v p="$name/" 'index($3,p)==1 {printf "| `%s` | %s | %s | %s |\n", substr($3, length(p)+1), $4, $2, $1}'
    done
  } > "$tmp"
  # Chỉ ghi khi nội dung (bỏ dòng giờ) thay đổi, để file không đổi liên tục
  if [ ! -f "$out" ] || [ "$(grep -v '^_Do watch.sh' "$tmp")" != "$(grep -v '^_Do watch.sh' "$out")" ]; then
    mv "$tmp" "$out"
  else
    rm -f "$tmp"
  fi
}

tick() {
  data=$(scan)
  # Agent trong agents.txt
  grep -v '^[[:space:]]*#' "$AGENTS" | grep -v '^[[:space:]]*$' | while read -r id role mode cmd; do
    # subagent: Master tự gọi trong phiên chat của nó, watch.sh không đánh thức và không báo
    [ "$mode" = "subagent" ] && continue
    files=$(echo "$data" | awk -F'|' -v a="$id" '$1==a {print $3}')
    [ -n "$files" ] || { rm -f "$RUN/$id.sig"; continue; }
    running "$id" && continue
    s=$(sig_of "$files")
    [ -f "$RUN/$id.sig" ] && [ "$s" = "$(cat "$RUN/$id.sig")" ] && continue
    echo "$s" > "$RUN/$id.sig"
    if [ "$mode" = "auto" ]; then
      wake "$id" "$role" "$cmd" "$files"
    else
      notify "Có việc cho $id ($role): $(echo $files | tr '\n' ' ')"
    fi
  done
  # Việc chờ chủ dự án
  ofiles=$(echo "$data" | awk -F'|' '$1=="owner" {print $3}')
  if [ -n "$ofiles" ]; then
    s=$(sig_of "$ofiles")
    if [ ! -f "$RUN/owner.sig" ] || [ "$s" != "$(cat "$RUN/owner.sig")" ]; then
      echo "$s" > "$RUN/owner.sig"
      notify "Cần bạn:
$(owner_lines "$(echo "$data" | awk -F'|' '$1=="owner"')" | tr -d '`')"
    fi
  else
    rm -f "$RUN/owner.sig"
  fi
  write_status "$data"
}

# Khi khởi động: chỉ dọn dấu "đang chạy" của tiến trình đã chết
for p in "$RUN"/*.pid; do
  [ -f "$p" ] || continue
  a=$(basename "$p" .pid)
  running "$a" || rm -f "$p"
done

if [ "$ONCE" = "1" ]; then tick; exit 0; fi
say "Bắt đầu theo dõi $W, quét mỗi $INTERVAL giây. Ctrl+C để dừng."
while true; do
  tick
  sleep "$INTERVAL"
done
