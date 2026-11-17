#!/usr/bin/env sh
# Cài hook pre-push chặn agent push. Có tác dụng với mọi công cụ AI, không riêng Claude Code.
#
# Dùng (ở thư mục dự án, Git Bash trên Windows):
#   sh workflow/hooks/install.sh           cài (chủ dự án chạy một lần)
#   sh workflow/hooks/install.sh --check   chỉ kiểm tra; mã 0 là đã cài
#
# Hook nằm trong thư mục hook chung của repo, nên mọi worktree đều bị chặn.
# Không ghi đè hook pre-push có sẵn của dự án (husky…): khi đó in hướng dẫn gộp tay.

set -u
root=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "Không phải repo git. Chạy git init trước."; exit 1; }
cd "$root" || exit 1
src="workflow/hooks/pre-push"
dir=$(git rev-parse --git-path hooks)   # tôn trọng core.hooksPath nếu dự án có đặt
dst="$dir/pre-push"
mark="workflow-multi-agent: block-push"

installed() { [ -f "$dst" ] && grep -qF "$mark" "$dst"; }

if [ "${1:-}" = "--check" ]; then
  if installed; then echo "Hook chặn push: đã cài ($dst)."; exit 0; fi
  echo "Hook chặn push: CHƯA cài. Chủ dự án chạy: sh workflow/hooks/install.sh"
  exit 1
fi

[ -f "$src" ] || { echo "Thiếu $src."; exit 1; }
if [ -f "$dst" ] && ! installed; then
  echo "Dự án đã có hook pre-push riêng ($dst), không ghi đè."
  echo "Gộp tay: chép nội dung của $src (bỏ dòng đầu #!) vào ngay sau dòng #! của hook đó."
  exit 1
fi
mkdir -p "$dir"
cp "$src" "$dst" && chmod +x "$dst" || { echo "Không chép được hook vào $dst."; exit 1; }
echo "Đã cài hook chặn push: $dst"
echo "Từ giờ mọi git push đều bị chặn. Bạn tự push bằng: git push --no-verify origin <nhánh>"
