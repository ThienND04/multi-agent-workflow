# Khối cổng của slot, chung cho cả repo. workflow/run.sh nạp file này (động từ slot, doctor).
#
# Cổng của unit ở slot n = BASE_PORT + n * SLOT_STRIDE + PORT_OFFSET
#   - PORT_OFFSET khai trong workflow/stack/<unit>.sh: mỗi unit một số khác nhau, nhỏ hơn SLOT_STRIDE.
#   - Slot 0 dành cho Master; Coder, Tester dùng slot Master ghi trong "Ngữ cảnh từ Master".
# Vì sao chia khối: nhiều agent chạy server cùng lúc trên một máy; mỗi slot một khối SLOT_STRIDE cổng
# liền nhau nên slot không giẫm cổng nhau, và các unit trong cùng slot cũng không đụng nhau.
#
# Ví dụ (mặc định): slot 2, unit có PORT_OFFSET=1 chạy ở cổng 4000 + 2*10 + 1 = 4021.
# Đổi BASE_PORT khi dải cổng này đã có dịch vụ khác trên máy. Tăng SLOT_STRIDE khi repo có hơn 10 unit.
# Đổi một trong hai số thì chạy lại `sh workflow/run.sh slot …` cho mọi slot đang dùng.

BASE_PORT=4000
SLOT_STRIDE=10

# Tính cổng thứ <offset> (0..SLOT_STRIDE-1) trong khối cổng của SLOT hiện tại.
# Tự chứa và an toàn với `set -u` để unit hoặc bài kiểm thử có thể gọi trực tiếp.
slot_port_at() {
  if [ $# -ne 1 ]; then
    printf '[slots] lỗi=slot_port_at cần đúng 1 đối số <offset>\n' >&2
    return 1
  fi
  _spa_off=$1
  _spa_slot=${SLOT:-}
  _spa_base=${BASE_PORT:-}
  _spa_stride=${SLOT_STRIDE:-}

  case $_spa_slot in ''|*[!0-9]*|0?*)
    printf '[slots] lỗi=SLOT chưa đặt hoặc không hợp lệ: %s\n' "${_spa_slot:-<rỗng>}" >&2
    return 1 ;;
  esac
  case $_spa_off in ''|*[!0-9]*|0?*)
    printf '[slots] lỗi=offset không hợp lệ: %s\n' "${_spa_off:-<rỗng>}" >&2
    return 1 ;;
  esac
  case $_spa_base in ''|*[!0-9]*|0?*|0)
    printf '[slots] lỗi=BASE_PORT phải là số nguyên >= 1: %s\n' "${_spa_base:-<rỗng>}" >&2
    return 1 ;;
  esac
  case $_spa_stride in ''|*[!0-9]*|0?*|0)
    printf '[slots] lỗi=SLOT_STRIDE phải là số nguyên > 0: %s\n' "${_spa_stride:-<rỗng>}" >&2
    return 1 ;;
  esac

  if [ "${#_spa_base}" -gt 5 ] || [ "$_spa_base" -gt 65535 ]; then
    printf '[slots] lỗi=BASE_PORT vượt quá 65535: %s\n' "$_spa_base" >&2
    return 1
  fi
  if [ "${#_spa_off}" -gt 5 ] || [ "$_spa_off" -gt 65535 ]; then
    printf '[slots] lỗi=offset %s vượt quá giới hạn cổng 65535\n' "$_spa_off" >&2
    return 1
  fi
  if [ "${#_spa_stride}" -le 5 ] && [ "$_spa_off" -ge "$_spa_stride" ]; then
    printf '[slots] lỗi=offset=%s phải nhỏ hơn SLOT_STRIDE=%s\n' "$_spa_off" "$_spa_stride" >&2
    return 1
  fi
  if [ "$((_spa_base + _spa_off))" -gt 65535 ]; then
    printf '[slots] lỗi=cổng tính ra %s vượt quá 65535\n' "$((_spa_base + _spa_off))" >&2
    return 1
  fi

  if [ "$_spa_slot" = 0 ]; then
    _spa_port=$((_spa_base + _spa_off))
  else
    if [ "${#_spa_stride}" -gt 5 ] || [ "$_spa_stride" -gt 65535 ]; then
      printf '[slots] lỗi=cổng tính ra vượt quá 65535 (SLOT=%s SLOT_STRIDE=%s)\n' "$_spa_slot" "$_spa_stride" >&2
      return 1
    fi
    _spa_rem=$((65535 - _spa_base - _spa_off))
    _spa_max_slot=$((_spa_rem / _spa_stride))
    if [ "${#_spa_slot}" -gt 5 ] || [ "$_spa_slot" -gt "$_spa_max_slot" ]; then
      printf '[slots] lỗi=cổng tính ra vượt quá 65535 (SLOT=%s SLOT_STRIDE=%s)\n' "$_spa_slot" "$_spa_stride" >&2
      return 1
    fi
    _spa_port=$((_spa_base + _spa_slot * _spa_stride + _spa_off))
  fi

  printf '%s\n' "$_spa_port"
}
