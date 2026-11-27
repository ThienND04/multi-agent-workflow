#!/usr/bin/env sh
# update-kit.sh: cập nhật nhanh file core của starter-kit-be vào dự án đã cài (giữ nguyên cấu hình & dữ liệu dự án).
#
# Dùng:
#   sh update-kit.sh <thư mục dự án>
#   sh update-kit.sh <thư mục dự án> --dry-run

set -u
KIT=$(cd "$(dirname "$0")" && pwd)
exec sh "$KIT/install-kit.sh" --update "$@"
