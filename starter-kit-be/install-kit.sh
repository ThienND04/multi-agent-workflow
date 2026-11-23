#!/usr/bin/env sh
# install-kit.sh: chép kit vào một dự án git, không ghi đè thứ dự án đã có.
#
# Dùng (chạy từ thư mục kit):
#   sh install-kit.sh <thư mục dự án>           chép kit; workflow/ có thể commit cùng dự án
#   sh install-kit.sh <thư mục dự án> --local   chép kit và ẩn khỏi git (dự án của team), chỉ có trên máy này
#
# Chép: workflow/, .claude/, .agents/skills/mr7-review/, AGENTS.md, CLAUDE.md, GEMINI.md, .gitattributes.
# Không chép README.md của kit. File dự án đã có thì bỏ qua và báo để gộp tay; workflow/ đã có thì dừng.
# Đặt BASE_BRANCH trong workflow/project.conf theo nhánh hiện tại của dự án (đổi lại nếu sai).

set -u
KIT=$(cd "$(dirname "$0")" && pwd)
TARGET=""
LOCAL=0
usage_msg="Dùng: sh install-kit.sh <thư mục dự án> [--local]"

fail() { echo "install-kit: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --local)
      [ "$LOCAL" = 0 ] || fail "trùng cờ --local. $usage_msg"
      LOCAL=1
      ;;
    -*)
      fail "tham số không hợp lệ: $1. $usage_msg"
      ;;
    *)
      [ -z "$TARGET" ] || fail "dư tham số: $1. $usage_msg"
      TARGET="$1"
      ;;
  esac
  shift
done

[ -n "$TARGET" ] || fail "thiếu thư mục dự án. $usage_msg"
[ -d "$TARGET" ] || fail "không có thư mục $TARGET"
TARGET=$(cd "$TARGET" && pwd)
ROOT=$(git -C "$TARGET" rev-parse --show-toplevel 2>/dev/null) || fail "$TARGET không phải repo git (chạy git init trước)"
[ "$ROOT" = "$TARGET" ] || fail "hãy trỏ vào thư mục gốc repo: $ROOT"
[ "$KIT" != "$TARGET" ] || fail "thư mục dự án trùng thư mục kit"
[ ! -e "$TARGET/workflow" ] || fail "$TARGET/workflow đã có. Dừng để không ghi đè; xoá hoặc gộp tay rồi chạy lại"

# copy_if_absent <đường dẫn tương đối>: chép file hay thư mục nếu dự án chưa có
copy_if_absent() {
  if [ -e "$TARGET/$1" ]; then
    echo "bỏ qua $1 (dự án đã có, gộp tay)"
  else
    cp -R "$KIT/$1" "$TARGET/$1" || fail "không chép được $1"
    echo "đã chép $1"
  fi
}

cp -R "$KIT/workflow" "$TARGET/workflow" || fail "không chép được workflow/"
echo "đã chép workflow/"

# .claude/: dự án đã có thì chỉ thêm phần chưa có, không đụng settings.json
if [ -d "$TARGET/.claude" ]; then
  mkdir -p "$TARGET/.claude/agents" "$TARGET/.claude/skills"
  for d in agents/coder.md agents/coder-pro.md agents/tester.md skills/mr7-review; do
    if [ -e "$TARGET/.claude/$d" ]; then echo "bỏ qua .claude/$d (đã có)"; else cp -R "$KIT/.claude/$d" "$TARGET/.claude/$d" && echo "đã chép .claude/$d"; fi
  done
  if [ -e "$TARGET/.claude/settings.json" ]; then
    echo "bỏ qua .claude/settings.json (đã có): gộp tay allow và deny từ $KIT/.claude/settings.json"
  else
    cp "$KIT/.claude/settings.json" "$TARGET/.claude/settings.json" && echo "đã chép .claude/settings.json"
  fi
else
  cp -R "$KIT/.claude" "$TARGET/.claude" || fail "không chép được .claude/"
  echo "đã chép .claude/"
fi

# .agents/skills/mr7-review/: hỗ trợ Antigravity; không ghi đè .agents/ hoặc skill đã có của dự án
had_dot_agents=0
[ -e "$TARGET/.agents" ] && had_dot_agents=1
if [ -e "$TARGET/.agents/skills/mr7-review" ]; then
  echo "bỏ qua .agents/skills/mr7-review (đã có)"
else
  mkdir -p "$TARGET/.agents/skills" || fail "không tạo được .agents/skills/"
  cp -R "$KIT/.agents/skills/mr7-review" "$TARGET/.agents/skills/mr7-review" || fail "không chép được .agents/skills/mr7-review/"
  echo "đã chép .agents/skills/mr7-review/"
fi

# Dự án của team (--local): không chép .gitattributes vì file workflow không lên git
if [ "$LOCAL" = 1 ]; then files="AGENTS.md CLAUDE.md GEMINI.md"; else files="AGENTS.md CLAUDE.md GEMINI.md .gitattributes"; fi
had_agents=0
[ -e "$TARGET/AGENTS.md" ] && had_agents=1
for f in $files; do copy_if_absent "$f"; done

# Dự án đã có AGENTS.md riêng: kit vào AGENTS-WORKFLOW.md để CLAUDE.md, GEMINI.md của kit nạp đúng luật của kit
if [ "$had_agents" = 1 ]; then
  cp "$KIT/AGENTS.md" "$TARGET/AGENTS-WORKFLOW.md" || fail "không chép được AGENTS-WORKFLOW.md"
  for f in CLAUDE.md GEMINI.md; do
    # chỉ sửa bản vừa chép từ kit (dòng bắt đầu bằng @), không đụng file dự án đã có
    if grep -q '^@\(\./\)\{0,1\}AGENTS.md$' "$TARGET/$f" 2>/dev/null && cmp -s "$KIT/$f" "$TARGET/$f"; then
      awk '/^@(\.\/)?AGENTS\.md$/ { sub(/AGENTS\.md/, "AGENTS-WORKFLOW.md") } { print }' "$TARGET/$f" > "$TARGET/$f.tmp" && mv "$TARGET/$f.tmp" "$TARGET/$f"
    fi
  done
  echo "đã chép AGENTS.md của kit thành AGENTS-WORKFLOW.md. Thêm vào cuối AGENTS.md của dự án dòng: Đọc và làm theo AGENTS-WORKFLOW.md."
fi

# set_conf <khoá> <giá trị>: sửa một dòng KHOÁ=giá trị trong project.conf (awk + mv, chạy được trên Linux, macOS, Git Bash)
set_conf() {
  conf="$TARGET/workflow/project.conf"
  awk -v k="$1" -v v="$2" 'index($0, k "=") == 1 { print k "=" v; next } { print }' "$conf" > "$conf.tmp" && mv "$conf.tmp" "$conf"
}

branch=$(git -C "$TARGET" symbolic-ref --short HEAD 2>/dev/null)
if [ -n "$branch" ]; then
  set_conf BASE_BRANCH "$branch"
  case "$branch" in
    main|master|develop|trunk) echo "BASE_BRANCH=$branch (nhánh hiện tại)" ;;
    *) echo "BASE_BRANCH=$branch (nhánh hiện tại) có vẻ là nhánh tính năng: đặt BASE_BRANCH là nhánh đích của MR (ví dụ develop) và WORK_BRANCH=$branch trong workflow/project.conf" ;;
  esac
fi

exclude=$(git -C "$TARGET" rev-parse --git-path info/exclude)
case "$exclude" in /*) ;; *) exclude="$TARGET/$exclude" ;; esac
mkdir -p "$(dirname "$exclude")"

# append_excludes <file> <header> <entry...>: thêm từng dòng chưa có (không lặp tiêu đề hay dòng cũ)
append_excludes() {
  excl_file="$1"
  excl_header="$2"
  shift 2
  need_header=0
  for entry in "$@"; do
    if ! grep -qxF "$entry" "$excl_file" 2>/dev/null; then
      need_header=1
      break
    fi
  done
  [ "$need_header" = 1 ] || return 0
  if [ -s "$excl_file" ] && [ "$(tail -c 1 "$excl_file" 2>/dev/null | wc -l)" -eq 0 ]; then
    printf '\n' >> "$excl_file"
  fi
  if ! grep -qxF "$excl_header" "$excl_file" 2>/dev/null; then
    [ -s "$excl_file" ] && printf '\n' >> "$excl_file"
    printf '%s\n' "$excl_header" >> "$excl_file"
  fi
  for entry in "$@"; do
    grep -qxF "$entry" "$excl_file" 2>/dev/null || printf '%s\n' "$entry" >> "$excl_file"
  done
}

if [ "$LOCAL" = 1 ]; then
  set_conf WORKFLOW_IN_GIT no
  # AGENTS.md của kit chỉ ẩn khi dự án không có AGENTS.md riêng (có thì nó là file của dự án, đừng ẩn)
  # .agents/: ẩn cả thư mục nếu dự án chưa có .agents/ trước đó; đã có thì chỉ ẩn skill mr7-review
  dot_agents_excl='/.agents/'
  [ "$had_dot_agents" = 1 ] && dot_agents_excl='/.agents/skills/mr7-review/'
  set -- '/workflow/' '/AGENTS-WORKFLOW.md' '/CLAUDE.md' '/GEMINI.md' '/.claude/' '/.worktrees/' '.mr-review/' '.slot.*.env'
  [ "$had_agents" = 1 ] || set -- "$@" '/AGENTS.md'
  set -- "$@" "$dot_agents_excl"
  append_excludes "$exclude" '# multi-agent workflow: chỉ trên máy này' "$@"
  echo "đã ẩn kit khỏi git qua $exclude, WORKFLOW_IN_GIT=no"
else
  # Kit kèm theo vẫn cần bỏ qua worktree và báo cáo review, vì chúng không bao giờ được commit
  append_excludes "$exclude" '# multi-agent workflow' '/.worktrees/' '.mr-review/' '.slot.*.env'
fi

echo
echo "Xong. Bước tiếp theo (chi tiết: README.md của kit):"
echo "  1. Sửa workflow/project.conf (DELIVERY) và workflow/OWNER-RULES.md nếu cần."
echo "  2. Mở claude TRONG $TARGET, bấm tin cậy, dán lời nhắn lần đầu cho Master (README.md, mục Chép vào dự án, bước 4)."
echo "  3. Cài thư viện của dự án TRƯỚC, rồi mới: sh workflow/hooks/install.sh"
