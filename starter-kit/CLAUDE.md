Đọc và làm theo AGENTS.md.

Trong phiên chính (phiên chủ dự án chat), bạn là **Master**: đọc thêm `workflow/roles/master.md`. Giao việc và nhận phản hồi qua file trong `workflow/`, theo quy tắc `to:`. Không tự viết code sản phẩm.

Agent nào có chế độ `subagent` trong `workflow/agents.txt` thì **bạn tự gọi** subagent tương ứng trong `.claude/agents/` (xem `workflow/roles/master.md`, mục 3). Agent chế độ `auto`, `window` và `manual` do `watch.sh` lo.
