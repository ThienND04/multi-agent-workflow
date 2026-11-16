#!/usr/bin/env sh
# Gửi một tin Telegram cho chủ dự án. Chỉ gửi đi, không nhận lệnh.
# Dùng:   sh workflow/notify.sh "[F-001] Cần bạn trả lời 2 câu hỏi"
# Cấu hình trong file .env ở gốc dự án (không đưa lên git):
#   TELEGRAM_BOT_TOKEN=...
#   TELEGRAM_CHAT_ID=...
# Không cấu hình thì chỉ in ra màn hình rồi thoát, không báo lỗi.
# Không bao giờ in token ra màn hình.

msg="$1"
[ -n "$msg" ] || { echo "Cách dùng: sh workflow/notify.sh \"nội dung\""; exit 1; }

root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
env_file="$root/.env"
if [ ! -f "$env_file" ]; then
  echo "Chưa có .env, không gửi Telegram. Nội dung: $msg"
  exit 0
fi

token=$(grep -E '^TELEGRAM_BOT_TOKEN=' "$env_file" | head -n 1 | cut -d= -f2- | tr -d '\r"')
chat=$(grep -E '^TELEGRAM_CHAT_ID=' "$env_file" | head -n 1 | cut -d= -f2- | tr -d '\r"')
if [ -z "$token" ] || [ -z "$chat" ]; then
  echo "Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID trong .env, không gửi. Nội dung: $msg"
  exit 0
fi

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  "https://api.telegram.org/bot${token}/sendMessage" \
  --data-urlencode "chat_id=${chat}" \
  --data-urlencode "text=${msg}")

if [ "$code" = "200" ]; then
  echo "Đã gửi thông báo Telegram."
else
  echo "Gửi Telegram thất bại (mã HTTP $code). Kiểm tra token và chat ID trong .env."
fi
