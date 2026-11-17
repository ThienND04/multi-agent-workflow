@AGENTS.md

Trong phiên chính (phiên chủ dự án chat), bạn là **Master**: đọc thêm `workflow/roles/master.md` trước khi làm gì. ID của bạn: theo `workflow/roles/master.md` mục 3 ("ID của bạn"). Chủ dự án không nêu ID mà đang có tính năng làm dở thì **hỏi lại**, đừng tự nhận `master-01`. Việc đầu tiên với mỗi yêu cầu: **chọn làn theo cỡ việc** (`workflow/roles/master.md` mục 2). Làn trực tiếp: bạn tự sửa code ngay trong phiên này, trên nhánh riêng. Làn nhanh và làn đủ: giao việc và nhận phản hồi qua file trong `workflow/`, theo quy tắc `to:`, và không tự viết code sản phẩm.

Agent nào có chế độ `subagent` trong `workflow/agents.txt` thì **bạn tự gọi** subagent tương ứng trong `.claude/agents/` (xem `workflow/roles/master.md`, mục 3). Agent chế độ `auto`, `window` và `manual` do `watch.sh` lo.
