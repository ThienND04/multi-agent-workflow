#!/usr/bin/env sh
# install-kit.sh: cài đặt hoặc cập nhật kit vào một dự án git.
#
# Dùng (chạy từ thư mục kit):
#   sh install-kit.sh <thư mục dự án>              cài mới kit; workflow/ có thể commit cùng dự án
#   sh install-kit.sh <thư mục dự án> --local      cài mới kit và ẩn khỏi git (dự án của team)
#   sh install-kit.sh <thư mục dự án> --update     cập nhật các file core của kit vào dự án đã cài
#   sh install-kit.sh <thư mục dự án> --update --dry-run   xem trước những gì sẽ được cập nhật
#
# Chế độ --update ghi đè file core của kit (agent.js, agent.sh, watch.sh, monitor.js, run.sh, notify.sh,
# roles/*, hooks/*, stack/README.md, stack/examples/*, .claude/agents/*, skills/mr7-review/*, AGENTS.md),
# gộp thêm rule mới vào .claude/settings.json (không xoá rule riêng của dự án), và GIỮ NGUYÊN toàn bộ
# cấu hình/dữ liệu dự án (project.conf, agents.txt, OWNER-RULES.md, DECISIONS.md, stack/<unit>.*, F-*, .run/, logs/, .env).

set -u
KIT=$(cd "$(dirname "$0")" && pwd)
TARGET=""
LOCAL=0
UPDATE=0
DRY_RUN=0
usage_msg="Dùng: sh install-kit.sh <thư mục dự án> [--local] [--update] [--dry-run]"

fail() { echo "install-kit: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --local)
      [ "$LOCAL" = 0 ] || fail "trùng cờ --local. $usage_msg"
      LOCAL=1
      ;;
    --update)
      [ "$UPDATE" = 0 ] || fail "trùng cờ --update. $usage_msg"
      UPDATE=1
      ;;
    --dry-run)
      [ "$DRY_RUN" = 0 ] || fail "trùng cờ --dry-run. $usage_msg"
      DRY_RUN=1
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
[ "$DRY_RUN" = 0 ] || [ "$UPDATE" = 1 ] || fail "--dry-run chỉ dùng cùng --update. $usage_msg"

TARGET=$(cd "$TARGET" && pwd)
ROOT=$(git -C "$TARGET" rev-parse --show-toplevel 2>/dev/null) || fail "$TARGET không phải repo git (chạy git init trước)"
[ "$ROOT" = "$TARGET" ] || fail "hãy trỏ vào thư mục gốc repo: $ROOT"
[ "$KIT" != "$TARGET" ] || fail "thư mục dự án trùng thư mục kit"

exclude=$(git -C "$TARGET" rev-parse --git-path info/exclude)
case "$exclude" in /*) ;; *) exclude="$TARGET/$exclude" ;; esac

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

# copy_core <rel>: ghi đè 1 file core từ kit sang dự án đích (chỉ ghi khi khác nội dung).
copy_core() {
  src="$KIT/$1"
  dst="${2:-$TARGET/$1}"
  [ -f "$src" ] || return 0
  if [ -f "$dst" ] && cmp -s "$src" "$dst"; then
    return 0
  fi
  if [ -f "$dst" ]; then label="cập nhật"; else label="thêm mới"; fi
  if [ "$DRY_RUN" = 1 ]; then
    echo "[$label] ${dst#"$TARGET/"}"
    return 0
  fi
  mkdir -p "$(dirname "$dst")" || fail "không tạo được thư mục cho $dst"
  cp "$src" "$dst" || fail "không chép được $1"
  [ -x "$src" ] && chmod +x "$dst" 2>/dev/null || true
  echo "đã $label ${dst#"$TARGET/"}"
}

# copy_core_dir <rel_dir>: đồng bộ toàn bộ file trong thư mục core của kit sang dự án đích.
copy_core_dir() {
  src_dir="$KIT/$1"
  [ -d "$src_dir" ] || return 0
  for item in "$src_dir"/*; do
    [ -e "$item" ] || continue
    rel="${item#"$KIT/"}"
    if [ -d "$item" ]; then
      copy_core_dir "$rel"
    elif [ -f "$item" ]; then
      copy_core "$rel"
    fi
  done
}

# merge_claude_settings: thêm các rule allow/deny mới của kit vào .claude/settings.json mà không xoá rule riêng.
merge_claude_settings() {
  src="$KIT/.claude/settings.json"
  dst="$TARGET/.claude/settings.json"
  [ -f "$src" ] || return 0
  if [ ! -f "$dst" ]; then
    copy_core ".claude/settings.json"
    return 0
  fi
  if cmp -s "$src" "$dst"; then
    return 0
  fi
  if ! command -v node >/dev/null 2>&1; then
    echo "giữ nguyên .claude/settings.json (thiếu node để tự gộp; đối chiếu thêm từ $src)"
    return 0
  fi
  res=$(node -e '
    const fs = require("fs");
    const src = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const dst = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
    const dry = process.argv[3] === "1";
    dst.permissions = dst.permissions || {};
    let added = 0;
    for (const key of ["allow", "deny"]) {
      const sArr = Array.isArray(src.permissions && src.permissions[key]) ? src.permissions[key] : [];
      const dArr = Array.isArray(dst.permissions[key]) ? dst.permissions[key] : [];
      const set = new Set(dArr);
      for (const item of sArr) {
        if (!set.has(item)) { dArr.push(item); set.add(item); added++; }
      }
      if (dArr.length) dst.permissions[key] = dArr;
    }
    if (added > 0 && !dry) {
      fs.writeFileSync(process.argv[2], JSON.stringify(dst, null, 2) + "\n", "utf8");
    }
    console.log(added);
  ' "$src" "$dst" "$DRY_RUN" 2>/dev/null) || {
    echo "giữ nguyên .claude/settings.json (không parse được JSON; gộp tay từ $src)"
    return 0
  }
  if [ "${res:-0}" -gt 0 ]; then
    if [ "$DRY_RUN" = 1 ]; then
      echo "[gộp +$res rule] .claude/settings.json"
    else
      echo "đã gộp thêm $res rule mới vào .claude/settings.json"
    fi
  fi
}

# ---------- Chế độ --update ----------
if [ "$UPDATE" = 1 ]; then
  [ -d "$TARGET/workflow" ] || fail "$TARGET chưa có thư mục workflow/. Hãy chạy cài mới (bỏ --update)."
  [ "$DRY_RUN" = 1 ] && echo "=== XEM TRƯỚC CẬP NHẬT (--dry-run): $TARGET ==="

  # 1. File core trong workflow/
  for f in workflow/agent.js workflow/agent.sh workflow/watch.sh workflow/monitor.js workflow/run.sh workflow/notify.sh workflow/.gitignore workflow/stack/README.md; do
    copy_core "$f"
  done
  copy_core_dir "workflow/roles"
  copy_core_dir "workflow/hooks"
  copy_core_dir "workflow/stack/examples"
  if [ ! -f "$TARGET/workflow/stack/_slots.sh" ]; then
    copy_core "workflow/stack/_slots.sh"
  fi

  # 2. Subagent và skill của Claude Code + Antigravity
  for f in .claude/agents/coder.md .claude/agents/coder-pro.md .claude/agents/tester.md; do
    copy_core "$f"
  done
  copy_core_dir ".claude/skills/mr7-review"
  copy_core_dir ".agents/skills/mr7-review"
  merge_claude_settings

  # 3. Tài liệu gốc AGENTS.md (hoặc AGENTS-WORKFLOW.md nếu dự án giữ AGENTS.md riêng)
  if [ -f "$TARGET/AGENTS-WORKFLOW.md" ]; then
    copy_core "AGENTS.md" "$TARGET/AGENTS-WORKFLOW.md"
  else
    copy_core "AGENTS.md"
  fi

  for f in CLAUDE.md GEMINI.md; do
    if [ ! -e "$TARGET/$f" ]; then
      copy_core "$f"
    elif ! cmp -s "$KIT/$f" "$TARGET/$f"; then
      echo "giữ nguyên $f (có thể đối chiếu điểm mới từ $KIT/$f nếu cần)"
    fi
  done

  echo "giữ nguyên cấu hình/dữ liệu dự án: workflow/project.conf, agents.txt, OWNER-RULES.md, DECISIONS.md, stack/<unit>.*, F-*, .run/, logs/, .env"

  # 4. Đồng bộ exclude & git hook nếu không phải --dry-run
  in_git=$(sed -n 's/^WORKFLOW_IN_GIT=//p' "$TARGET/workflow/project.conf" 2>/dev/null | tail -n 1 | tr -d '\r" ')
  [ "$LOCAL" = 1 ] && in_git="no"
  if [ "$DRY_RUN" = 0 ]; then
    mkdir -p "$(dirname "$exclude")"
    if [ "$in_git" = "no" ]; then
      dot_agents_excl='/.agents/skills/mr7-review/'
      grep -qxF '/.agents/' "$exclude" 2>/dev/null && dot_agents_excl='/.agents/'
      set -- '/workflow/' '/AGENTS-WORKFLOW.md' '/CLAUDE.md' '/GEMINI.md' '/.claude/' '/.worktrees/' '.mr-review/' '.slot.*.env' "$dot_agents_excl"
      [ -f "$TARGET/AGENTS-WORKFLOW.md" ] || set -- "$@" '/AGENTS.md'
      append_excludes "$exclude" '# multi-agent workflow: chỉ trên máy này' "$@"
    else
      append_excludes "$exclude" '# multi-agent workflow' '/.worktrees/' '.mr-review/' '.slot.*.env'
    fi

    # Nếu trước đó dự án đã cài git hook của workflow thì làm mới hook luôn.
    hook_path=$(git -C "$TARGET" config --get core.hooksPath 2>/dev/null || true)
    if [ "$hook_path" = "workflow/hooks" ] || [ "$hook_path" = ".husky/_" ] || [ -f "$TARGET/.husky/pre-push" ]; then
      sh "$TARGET/workflow/hooks/install.sh" || echo "cảnh báo: không tự cài lại được hook; chạy tay: sh workflow/hooks/install.sh"
    fi
  fi

  echo
  if [ "$DRY_RUN" = 1 ]; then
    echo "Xong xem trước. Chạy lại không có --dry-run để áp dụng cập nhật."
  else
    echo "Cập nhật hoàn tất. Nếu watch.sh/monitor.js đang chạy, chúng sẽ tự nạp bản mới."
  fi
  exit 0
fi

# ---------- Chế độ cài mới ----------
[ ! -e "$TARGET/workflow" ] || fail "$TARGET/workflow đã có. Dùng --update để cập nhật, hoặc xoá tay trước khi cài lại"

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
    echo "bỏ qua .claude/settings.json (đã có): gộp tay allow và deny từ $KIT/.claude/settings.json (hoặc chạy --update)"
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

mkdir -p "$(dirname "$exclude")"

if [ "$LOCAL" = 1 ]; then
  set_conf WORKFLOW_IN_GIT no
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
echo "  2. Mở claude hoặc agy TRONG $TARGET, dán lời nhắn lần đầu cho Master (README.md, mục Chép vào dự án, bước 4)."
echo "  3. Cài thư viện của dự án TRƯỚC, rồi mới: sh workflow/hooks/install.sh"
