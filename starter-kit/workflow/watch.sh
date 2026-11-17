#!/usr/bin/env sh
# watch.sh: theo dõi các file trao đổi trong workflow/, đánh thức agent có việc, sinh STATUS.md.
#
# Dùng:
#   sh workflow/watch.sh                 chạy liên tục, quét 30 giây một lần (Ctrl+C để dừng)
#   sh workflow/watch.sh --interval 60   đổi chu kỳ quét
#   sh workflow/watch.sh --once          quét một lần rồi thoát
#   sh workflow/watch.sh --lint          chỉ in các trạng thái bất thường (mã 1 nếu có), không đánh thức ai
#   sh workflow/watch.sh --resume <ID>   cho agent đang bị tạm dừng (vì đánh thức quá nhiều lần) chạy lại
# Tuỳ chọn thêm:
#   --max-wakes 6    số lần đánh thức tối đa cho MỘT agent trong 1 giờ (auto, window); vượt thì tạm dừng
#                    agent đó và báo bạn, để agent bị kẹt không đốt token mãi. 0 = không giới hạn
#   --timeout 60     số phút tối đa cho một lần chạy agent auto; quá thì dừng nó và báo. 0 = không giới hạn
#   --stale 24       số giờ một file chờ agent mà không đổi thì báo là bất thường. 0 = không kiểm
#
# Quy tắc: file nào có dòng `to: <ID>` ở đầu là đang chờ agent đó.
#   - Agent "auto" trong agents.txt: chạy lệnh đánh thức (một phiên mới, không tương tác, chạy ngầm).
#   - Agent "window": mở một cửa sổ terminal mới, chạy công cụ ở dạng tương tác với lời nhắn gửi sẵn.
#     Cửa sổ còn mở mà có việc mới thì không mở thêm, chỉ báo.
#   - Agent "manual": báo ra màn hình và qua Telegram (nếu đã cấu hình), chép sẵn lời nhắn vào clipboard.
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
LINT=0
RESUME=""
MAXWAKES=6
TIMEOUT=60
STALE=24

need_num() { case "${2:-}" in ''|*[!0-9]*) echo "$1 cần một số nguyên"; exit 1 ;; esac; }
while [ $# -gt 0 ]; do
  case "$1" in
    --once) ONCE=1 ;;
    --lint) LINT=1 ;;
    --interval) need_num "$1" "${2:-}"; shift; INTERVAL="$1" ;;
    --max-wakes) need_num "$1" "${2:-}"; shift; MAXWAKES="$1" ;;
    --timeout) need_num "$1" "${2:-}"; shift; TIMEOUT="$1" ;;
    --stale) need_num "$1" "${2:-}"; shift; STALE="$1" ;;
    --resume) [ -n "${2:-}" ] || { echo "--resume cần ID agent"; exit 1; }; shift; RESUME="$1" ;;
    *) echo "Tham số không hiểu: $1"; exit 1 ;;
  esac
  shift
done

[ -f "$AGENTS" ] || { echo "Thiếu $AGENTS. Xem SETUP.md."; exit 1; }
mkdir -p "$RUN" "$LOGS"

if [ -n "$RESUME" ]; then
  rm -f "$RUN/$RESUME.paused" "$RUN/$RESUME.wakes" "$RUN/$RESUME.sig"
  echo "Đã cho $RESUME chạy lại. watch.sh sẽ đánh thức nó ở lần quét tới nếu còn việc chờ."
  exit 0
fi

# Lệnh timeout kiểu GNU (Git Bash, Linux có sẵn; macOS cần coreutils). Trên Windows, timeout.exe của
# hệ thống có cú pháp khác nên thử chạy một lần để chắc đúng loại.
HAS_TIMEOUT=0
timeout 5 true >/dev/null 2>&1 && HAS_TIMEOUT=1

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

# wake_count <id>: số lần agent được đánh thức trong 1 giờ qua (bỏ các mốc cũ hơn)
wake_count() {
  f="$RUN/$1.wakes"
  [ -f "$f" ] || { echo 0; return; }
  awk -v n="$(date +%s)" '$1 > n - 3600' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  grep -c . "$f"
}

# has_open_question <thư mục tính năng> <giá trị blocked_by>: còn câu hỏi nào chưa closed không
has_open_question() {
  for d in $(echo "$2" | tr -d '[]"' | tr ',' ' '); do
    for q in "$1/questions/$d.md" "$1/questions/$d"-*.md; do
      [ -f "$q" ] || continue
      [ "$(fm "$q" status)" != "closed" ] && return 0
    done
  done
  return 1
}

# lint: in các trạng thái bất thường, mỗi dòng một chỗ (không in gì là ổn).
# Cách chuyền lượt bằng to: hỏng nhất ở chỗ một việc không còn ai cầm; hàm này tìm những chỗ đó.
lint() {
  ids=" owner none $(grep -v '^[[:space:]]*#' "$AGENTS" | awk 'NF {printf "%s ", $1}')"
  for fd in "$W"/F-*/; do
    [ -d "$fd" ] || continue
    fd=${fd%/}
    sst=""; [ -f "$fd/SPEC.md" ] && sst=$(fm "$fd/SPEC.md" status)
    for f in "$fd/SPEC.md" "$fd"/tasks/*.md "$fd"/questions/*.md "$fd"/bugs/*.md; do
      [ -f "$f" ] || continue
      rel=${f#$W/}
      to=$(fm "$f" to); [ -n "$to" ] || to="none"
      st=$(fm "$f" status)
      case "$ids" in
        *" $to "*) ;;
        *) echo "\`$rel\`: to: $to không có trong agents.txt"; continue ;;
      esac
      # Tính năng đang viết tài liệu hoặc đã xong: chỉ kiểm ID
      case "$sst" in draft|done) continue ;; esac
      case "$rel" in
        */tasks/*)
          if [ "$to" = "none" ]; then
            case "$st" in
              review|reviewed|ready|in_progress|in_test|reopened)
                # Việc "Kế hoạch kiểm thử" chờ nhánh tích hợp: bình thường
                if [ "$st" = "reviewed" ] && [ "$(fm "$f" kind)" = "test-plan" ]; then :
                elif ! has_open_question "$fd" "$(fm "$f" blocked_by)"; then
                  echo "\`$rel\`: không ai cầm (status: $st, to: none, không còn câu hỏi nào đang mở)"
                fi ;;
            esac
          else
            want=""
            case "$st" in
              in_test) want=$(fm "$f" tester) ;;
              ready|in_progress|reopened) want=$(fm "$f" assignee) ;;
            esac
            [ -n "$want" ] && [ "$to" != "$want" ] && echo "\`$rel\`: status: $st nhưng to: $to (lẽ ra là $want)"
          fi ;;
        */questions/*)
          case "$st" in open|answered) [ "$to" = "none" ] && echo "\`$rel\`: câu hỏi $st mà to: none, không ai cầm" ;; esac
          case "$st" in
            answered|closed)
              grep -qE '^[-*> ]*[*_]*(Nguồn|NGUỒN|nguồn)[*_]*[[:space:]]*:' "$f" || echo "\`$rel\`: câu trả lời chưa có dòng \"Nguồn:\"" ;;
          esac ;;
        */bugs/*)
          case "$st" in open|fixed) [ "$to" = "none" ] && echo "\`$rel\`: lỗi $st mà to: none, không ai cầm" ;; esac ;;
      esac
      if [ "$STALE" -gt 0 ] && [ "$to" != "none" ] && [ "$to" != "owner" ] && [ -n "$(find "$f" -mmin +$((STALE * 60)) 2>/dev/null)" ]; then
        echo "\`$rel\`: chờ $to đã hơn $STALE giờ mà không đổi"
      fi
    done
  done
}

# Chữ ký nội dung của một danh sách file (để biết có gì thay đổi)
sig_of() {
  [ -n "$1" ] || { echo "empty"; return; }
  # shellcheck disable=SC2086
  (cd "$W" && echo "$1" && cat $1) | cksum | awk '{print $1}'
}

# make_prompt <id> <vai> <danh sách file>: lời nhắn cho agent, chỉ trỏ tới đúng file cần đọc
make_prompt() {
  list=$(echo $3)   # gộp các dòng thành một dòng, cách nhau một khoảng trắng
  if [ "$2" = "master" ]; then
    echo "Xử lý việc đang chờ (to: $1): $list"
  else
    echo "Đọc AGENTS.md và workflow/roles/$2.md rồi làm theo. ID của bạn: $1. Vai: $2. Các file đang chờ bạn (to: $1): $list. Chỉ xử lý những file đó. File trong workflow/ luôn sửa ở thư mục bạn đang được mở (thư mục gốc dự án), không sửa bản trong worktree. Xong phần của mình thì đổi to: sang người kế tiếp. Trả lời ngắn."
  fi
}

# to_clipboard: chép stdin vào clipboard nếu máy có công cụ phù hợp (Windows, macOS, Linux)
to_clipboard() {
  if command -v clip.exe >/dev/null 2>&1 && command -v iconv >/dev/null 2>&1; then
    # clip.exe chỉ hiểu đúng tiếng Việt khi nhận UTF-16LE
    iconv -f UTF-8 -t UTF-16LE | clip.exe
  elif command -v pbcopy >/dev/null 2>&1; then pbcopy
  elif command -v wl-copy >/dev/null 2>&1; then wl-copy
  elif command -v xclip >/dev/null 2>&1; then xclip -selection clipboard
  else cat >/dev/null; return 1
  fi
}

# open_window <id> <vai> <lệnh> <danh sách file>: mở cửa sổ terminal mới chạy công cụ ở dạng tương tác
open_window() {
  id="$1"; role="$2"; cmd="$3"; files="$4"
  make_prompt "$id" "$role" "$files" > "$RUN/$id.prompt"
  log="$LOGS/$(date '+%Y%m%d-%H%M%S')-$id.log"
  launcher="$RUN/$id.window.sh"
  cat > "$launcher" <<EOF
#!/usr/bin/env sh
# Do watch.sh sinh để mở cửa sổ cho $id. Đừng sửa tay.
cd "$ROOT" || exit 1
echo \$\$ > "$RUN/$id.pid"
echo "[mở cửa sổ \$(date '+%H:%M:%S'), lệnh: $cmd]" > "$log"
printf '\033]0;%s\007' "$id ($role)"
echo "== $id ($role) == Cửa sổ do watch.sh mở. Lời nhắn đã gửi sẵn cho công cụ."
$cmd "\$(cat "$RUN/$id.prompt")"
code=\$?
echo "[kết thúc, mã \$code]" >> "$log"
rm -f "$RUN/$id.pid"
echo
echo "Công cụ đã thoát (mã \$code). Bấm Enter để đóng cửa sổ."
read -r _
EOF
  if command -v wt.exe >/dev/null 2>&1 && command -v cygpath >/dev/null 2>&1; then
    # Windows Terminal: chạy Git Bash trong một cửa sổ mới
    wt.exe -w new nt --title "$id" "$(cygpath -w /)\\bin\\bash.exe" --login "$(cygpath -w "$launcher")" >/dev/null 2>&1 &
  elif command -v mintty >/dev/null 2>&1; then
    mintty -t "$id" /bin/sh "$launcher" >/dev/null 2>&1 &
  elif command -v osascript >/dev/null 2>&1; then
    osascript -e "tell application \"Terminal\" to do script \"sh '$launcher'\"" >/dev/null 2>&1
  elif command -v x-terminal-emulator >/dev/null 2>&1; then
    x-terminal-emulator -e sh "$launcher" >/dev/null 2>&1 &
  else
    notify "Không mở được cửa sổ cho $id: máy không có Windows Terminal, mintty, Terminal (macOS) hay x-terminal-emulator. Chạy tay: sh $launcher"
    return
  fi
  say "Mở cửa sổ cho $id ($role)."
}

wake() { # wake <id> <vai> <lệnh> <danh sách file>
  id="$1"; role="$2"; cmd="$3"; files="$4"
  prompt=$(make_prompt "$id" "$role" "$files")
  log="$LOGS/$(date '+%Y%m%d-%H%M%S')-$id.log"
  tcmd=""
  [ "$TIMEOUT" -gt 0 ] && [ "$HAS_TIMEOUT" = 1 ] && tcmd="timeout ${TIMEOUT}m"
  (
    cd "$ROOT" || exit 1
    # shellcheck disable=SC2086
    $tcmd $cmd "$prompt" > "$log" 2>&1 < /dev/null
    code=$?
    echo "[kết thúc, mã $code]" >> "$log"
    if [ -n "$tcmd" ] && [ "$code" = 124 ]; then
      echo "[hết giờ: chạy quá $TIMEOUT phút nên bị dừng]" >> "$log"
      notify "$id ($role) chạy quá $TIMEOUT phút nên bị dừng. Xem log ${log#$ROOT/}"
    elif [ "$code" != 0 ]; then
      notify "$id ($role) kết thúc với lỗi (mã $code). Xem log ${log#$ROOT/}"
    fi
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
    echo "## Bất thường"
    echo
    if [ -s "$RUN/lint.txt" ]; then sed 's/^/- /' "$RUN/lint.txt"; else echo "Không có."; fi
    echo
    echo "## Agent"
    echo
    echo "| Agent | Vai | Đánh thức | Đang chạy | File đang chờ |"
    echo "|---|---|---|---|---|"
    grep -v '^[[:space:]]*#' "$AGENTS" | grep -v '^[[:space:]]*$' | while read -r id role mode rest; do
      n=$(echo "$data" | awk -F'|' -v a="$id" '$1==a' | grep -c . )
      running="không"; running "$id" && running="**đang chạy**"
      [ -f "$RUN/$id.paused" ] && running="⏸ **tạm dừng** từ $(cat "$RUN/$id.paused"), chạy lại: \`sh workflow/watch.sh --resume $id\`"
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
    # Dọn dấu "đang chạy" của tiến trình đã chết (ví dụ cửa sổ bị đóng bằng nút X)
    [ -f "$RUN/$id.pid" ] && ! running "$id" && rm -f "$RUN/$id.pid"
    files=$(echo "$data" | awk -F'|' -v a="$id" '$1==a {print $3}')
    [ -n "$files" ] || { rm -f "$RUN/$id.sig"; continue; }
    [ "$mode" = "auto" ] && running "$id" && continue
    if [ "$mode" = "window" ] && running "$id"; then
      # Cửa sổ đang mở: agent tự sửa file của nó là bình thường; chỉ báo khi có FILE MỚI chờ nó
      new=$(echo "$files" | while read -r f; do grep -qxF "$f" "$RUN/$id.list" 2>/dev/null || echo "$f"; done)
      if [ -n "$new" ]; then
        echo "$files" > "$RUN/$id.list"
        notify "Có việc mới cho $id ($role), cửa sổ của nó đang mở: gõ vào đó \"Xử lý việc đang chờ\". File mới: $(echo $new)"
      fi
      continue
    fi
    s=$(sig_of "$files")
    [ -f "$RUN/$id.sig" ] && [ "$s" = "$(cat "$RUN/$id.sig")" ] && continue
    if [ "$mode" = "auto" ] || [ "$mode" = "window" ]; then
      # Đang tạm dừng: chờ chủ dự án xem rồi chạy --resume
      [ -f "$RUN/$id.paused" ] && continue
      if [ "$MAXWAKES" -gt 0 ] && [ "$(wake_count "$id")" -ge "$MAXWAKES" ]; then
        date '+%d/%m %H:%M' > "$RUN/$id.paused"
        notify "Tạm dừng $id ($role): đã đánh thức $MAXWAKES lần trong 1 giờ mà vẫn còn việc chờ nó, có thể đang lặp. Xem log trong workflow/logs/ và các file: $(echo $files). Xong thì chạy: sh workflow/watch.sh --resume $id"
        continue
      fi
      date +%s >> "$RUN/$id.wakes"
    fi
    echo "$s" > "$RUN/$id.sig"
    case "$mode" in
      auto) wake "$id" "$role" "$cmd" "$files" ;;
      window) echo "$files" > "$RUN/$id.list"; open_window "$id" "$role" "$cmd" "$files" ;;
      *)
        make_prompt "$id" "$role" "$files" > "$RUN/$id.prompt"
        if to_clipboard < "$RUN/$id.prompt"; then where="đã chép vào clipboard, mở công cụ rồi dán"; else where="xem workflow/.run/$id.prompt"; fi
        notify "Có việc cho $id ($role): $(echo $files). Lời nhắn $where." ;;
    esac
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
  # Trạng thái bất thường: ghi cho STATUS.md và monitor, báo khi danh sách thay đổi
  lint > "$RUN/lint.txt"
  if [ -s "$RUN/lint.txt" ]; then
    s=$(cksum < "$RUN/lint.txt" | awk '{print $1}')
    if [ ! -f "$RUN/lint.sig" ] || [ "$s" != "$(cat "$RUN/lint.sig")" ]; then
      echo "$s" > "$RUN/lint.sig"
      notify "Bất thường trong workflow (xem STATUS.md hoặc monitor; nói với Master \"Xử lý việc đang chờ\"):
$(sed 's/^/- /' "$RUN/lint.txt" | tr -d '`')"
    fi
  else
    rm -f "$RUN/lint.sig"
  fi
  write_status "$data"
}

# Khi khởi động: chỉ dọn dấu "đang chạy" của tiến trình đã chết
for p in "$RUN"/*.pid; do
  [ -f "$p" ] || continue
  a=$(basename "$p" .pid)
  running "$a" || rm -f "$p"
done

if [ "$LINT" = "1" ]; then
  out=$(lint)
  if [ -n "$out" ]; then echo "Bất thường:"; echo "$out" | sed 's/^/- /'; exit 1; fi
  echo "Không có gì bất thường."; exit 0
fi
if [ "$ONCE" = "1" ]; then tick; exit 0; fi
say "Bắt đầu theo dõi $W, quét mỗi $INTERVAL giây. Ctrl+C để dừng."
while true; do
  tick
  sleep "$INTERVAL"
done
