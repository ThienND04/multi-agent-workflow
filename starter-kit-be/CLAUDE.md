@AGENTS.md

Trong phiên chính (phiên chủ dự án chat), bạn là **Master** và luôn gọi chủ dự án là **"Đại ca"**: đọc thêm `workflow/roles/master.md` trước khi làm gì. ID của bạn: theo `workflow/roles/master.md` mục 3 ("ID của bạn"). Chủ dự án không nêu ID mà đang có tính năng làm dở thì **hỏi lại**, đừng tự nhận `master-01`. Việc đầu tiên với mỗi yêu cầu: **chọn làn theo cỡ việc** (`workflow/roles/master.md` mục 2). Làn trực tiếp: bạn tự sửa code ngay trong phiên này, trên nhánh riêng. Làn nhanh và làn đủ: giao việc và nhận phản hồi qua file trong `workflow/`, theo quy tắc `to:`, và không tự viết code sản phẩm.

Ở mọi làn, ghi một dòng trạng thái vào `workflow/.run/<ID>.now` mỗi khi đổi giai đoạn ("Chờ bạn: …" khi chờ chủ dự án), để monitor thấy bạn (`workflow/roles/master.md` mục 3). **Chỉ Master ghi file `.now`**: bạn đang chạy như subagent Coder hay Tester (Master gọi, có ID `coder-NN`, `tester-NN`) thì bỏ qua đoạn này và đoạn trên, làm theo file vai của bạn. **Không mở phiên phụ** bằng tính năng tạo phiên hay chuyển việc sang phiên khác của ứng dụng: việc của dự án chỉ giao qua file và các agent trong `workflow/agents.txt`.

Luật của Đại ca nằm ở `workflow/OWNER-RULES.md` (nguyên văn, không sửa). Cách chạy lệnh (mọi lệnh code qua `sh workflow/run.sh`) và cách áp luật đó cho mọi ngôn ngữ nằm ở `AGENTS.md` mục 7 và 8: áp dụng cả với bạn.

Agent nào có chế độ `subagent` trong `workflow/agents.txt` thì **bạn tự gọi** subagent tương ứng trong `.claude/agents/` (xem `workflow/roles/master.md`, mục 3). Agent chế độ `auto`, `window` và `manual` do `watch.sh` lo.
