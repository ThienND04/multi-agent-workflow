#!/usr/bin/env sh
# agent.sh: vỏ gọi node workflow/agent.js (tạo/resume/đánh thức phiên chạy ngầm cho claude và agy).
#
# Dùng:
#   sh workflow/agent.sh wake <id> [--new] [--msg "..."] [--files "a,b"] [--timeout <phút>]
#   sh workflow/agent.sh run  <id> [--new] [--msg "..."] [--files "a,b"] [--timeout <phút>]
#   sh workflow/agent.sh new  <id>
#   sh workflow/agent.sh wait <id...> [--timeout <phút>]
#   sh workflow/agent.sh status [id] [--json]
#   sh workflow/agent.sh logs <id> [--lines <n>]
#   sh workflow/agent.sh stop <id>

set -u
DIR=$(cd "$(dirname "$0")" && pwd)
command -v node >/dev/null 2>&1 || { echo "Thiếu node (cần Node.js >= 18) để chạy workflow/agent.js" >&2; exit 4; }
exec node "$DIR/agent.js" "$@"
