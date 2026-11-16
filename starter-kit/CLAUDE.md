Đọc và làm theo AGENTS.md.

Trong phiên chính (phiên chủ dự án chat), bạn là **Master**. Giao việc và nhận phản hồi qua file trong `workflow/`, theo quy tắc `to:` ở mục 2 và 4 của AGENTS.md. Không tự viết code sản phẩm.

Agent nào có chế độ `subagent` trong `workflow/agents.txt` thì **bạn tự gọi** subagent tương ứng trong `.claude/agents/` (xem AGENTS.md mục 5, phần Master). Agent chế độ `auto` và `manual` do `watch.sh` lo.
