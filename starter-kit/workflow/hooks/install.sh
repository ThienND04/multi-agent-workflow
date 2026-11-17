#!/usr/bin/env sh
# Cài hook pre-push chặn push khi chưa được phép (WORKFLOW_PUSH_OK=1). Có tác dụng với mọi công cụ AI, không riêng Claude Code.
# Chạy lại để cập nhật hook đã cài bản cũ.
#
# Dùng (ở thư mục dự án, Git Bash trên Windows):
#   sh workflow/hooks/install.sh           cài (chủ dự án chạy một lần)
#   sh workflow/hooks/install.sh --check   chỉ kiểm tra; mã 0 là đã cài
#
# Hook nằm trong thư mục hook chung của repo, nên mọi worktree đều bị chặn.
# - Repo thường: chép vào thư mục hook của git (tôn trọng core.hooksPath).
# - Repo dùng husky v9 (core.hooksPath = .husky/_): husky chạy .husky/pre-push, nên chép vào đó, và thêm
#   dòng /.husky/pre-push vào .git/info/exclude để hook này KHÔNG BAO GIỜ bị commit (nếu lên repo, nó
#   sẽ chặn push của cả team).
# Không ghi đè hook pre-push có sẵn của dự án: khi đó in hướng dẫn gộp tay.

set -u
root=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "Không phải repo git. Chạy git init trước."; exit 1; }
cd "$root" || exit 1
src="workflow/hooks/pre-push"
dir=$(git rev-parse --git-path hooks)   # tôn trọng core.hooksPath nếu dự án có đặt
mark="workflow-multi-agent: block-push"

husky=0
if [ "$(basename "$dir")" = "_" ] && [ -f "$dir/h" ]; then
  husky=1
  dst="$(dirname "$dir")/pre-push"     # .husky/pre-push
else
  dst="$dir/pre-push"
fi

installed() { [ -f "$dst" ] && grep -qF "$mark" "$dst"; }

# exclude_local <đường dẫn từ gốc repo>: cho git bỏ qua file này chỉ trên máy này
exclude_local() {
  ex=$(git rev-parse --git-path info/exclude)
  mkdir -p "$(dirname "$ex")"
  grep -qxF "/$1" "$ex" 2>/dev/null || printf '\n# workflow multi-agent: hook chặn push chỉ dùng trên máy này\n/%s\n' "$1" >> "$ex"
}

if [ "${1:-}" = "--check" ]; then
  if installed; then echo "Hook chặn push: đã cài ($dst)."; exit 0; fi
  echo "Hook chặn push: CHƯA cài. Chủ dự án chạy: sh workflow/hooks/install.sh"
  exit 1
fi

[ -f "$src" ] || { echo "Thiếu $src."; exit 1; }
if [ -f "$dst" ] && ! installed; then
  echo "Dự án đã có hook pre-push riêng ($dst), không ghi đè."
  echo "Gộp tay: chép nội dung của $src (bỏ dòng đầu #!) vào ngay sau dòng #! của hook đó."
  [ "$husky" = 1 ] && echo "Lưu ý: $dst của husky thường được commit cho cả team. Đừng commit phần chặn push."
  exit 1
fi
if [ "$husky" = 1 ] && git ls-files --error-unmatch "$dst" >/dev/null 2>&1; then
  echo "$dst đang được git theo dõi (của team), không chép đè. Gộp tay như trên, và đừng commit."
  exit 1
fi
mkdir -p "$(dirname "$dst")"
cp "$src" "$dst" && chmod +x "$dst" || { echo "Không chép được hook vào $dst."; exit 1; }
if [ "$husky" = 1 ]; then
  exclude_local "${dst#./}"
  echo "Dự án dùng husky: đã cài hook vào $dst và thêm vào .git/info/exclude (không bao giờ bị commit)."
else
  echo "Đã cài hook chặn push: $dst"
fi
echo "Từ giờ git push bị chặn trừ khi có WORKFLOW_PUSH_OK=1. Bạn push bằng: WORKFLOW_PUSH_OK=1 git push origin <nhánh>"
