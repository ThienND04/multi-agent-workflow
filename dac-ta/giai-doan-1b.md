# Đặc tả Giai đoạn 1b: tính năng, chuyên môn FE/BE, hợp đồng API, phụ thuộc bên ngoài, chạy nhiều luồng

**Trạng thái:** **Đã duyệt** ngày 16/11/2026 (chủ dự án duyệt toàn bộ 13 điểm của đề xuất bổ sung 02). Viết bởi vai Master.
**Nguồn:** `dac-ta/de-xuat-bo-sung-02.md` (lý do, ví dụ, so sánh phương án). File này chỉ ghi **cái phải làm** và **tiêu chí chấp nhận**.
**Nền:** mọi quy ước của `dac-ta/giai-doan-1.md` (mục 2: môi trường, mã thoát; mục 3: dữ liệu; mục 7: định nghĩa "xong") áp dụng nguyên cho file này.
**Các việc:** T-020 … T-028 trong `dac-ta/viec-gd1/`. T-028 thêm theo đề xuất bổ sung 03.

---

## 1. Phạm vi

**Có:**
- chuyên môn `area`;
- tính năng `F-NNN` với vòng đời đầy đủ, gồm bước review đặc tả;
- hợp đồng API và việc ghép nối;
- phụ thuộc bên ngoài `X-NNN`;
- chạy nhiều phiên song song an toàn;
- hộp thư Master nhóm theo tính năng;
- skill FE/BE.

**Không có:**
- Monitor chạy `live_check_cmd` theo lịch, Telegram nhóm theo tính năng (Giai đoạn 2);
- giao diện monitor nhiều luồng (Giai đoạn 3; bản phác `monitor-nhieu-luong-mockup.html`);
- Trò chuyện với Master trên web qua bộ nối công cụ, hội thoại `C-NNN`, đăng nhập và mã dùng một lần (Giai đoạn 3, đề xuất bổ sung 03);
- tự mở phiên Coder và Tester (Giai đoạn 4).

## 2. Dữ liệu mới

### 2.1 Khoá mới trong `project.md`

| Khoá | Mặc định | Ý nghĩa |
|---|---|---|
| `areas` | `[]` | Chuyên môn và thư mục, ví dụ `[be=server/**, fe=web/**, shared=packages/types/**]` |
| `contract_dirs` | `[]` | Thư mục hợp đồng API. Chỉ Master sửa |
| `setup_cmd` | trống | Lệnh cài đặt khi tạo worktree mới, ví dụ `npm ci` |
| `worktree_env` | `[]` | Biến môi trường theo khe, ví dụ `[PORT=3000+AG_SLOT, DB_NAME=app_dev_AG_SLOT]` |
| `live_check_cmd` | trống | Lệnh kiểm tra API thật so với hợp đồng |

### 2.2 Khoá mới trong file việc

- `area`: một chuyên môn trong `areas`, hoặc `master`.
- `feature`: `F-NNN`, hoặc trống.
- `type` thêm 2 giá trị: `review` và `integration`.

### 2.3 File tính năng `.agents-state/features/F-NNN.md`

```
id, title, status, priority (1..5), branch (feature/F-NNN), spec (đường dẫn đặc tả của tính năng),
files (vùng ảnh hưởng), areas (chuyên môn có trong tính năng), created_at, accepted_at
```

Phần thân gồm các mục:
- `## Ghi chú của Master`: bàn giao theo luồng của Master;
- `## Báo cáo nghiệm thu`: do `ag feature report` sinh ra;
- `## Lịch sử`.

### 2.4 File phụ thuộc bên ngoài `.agents-state/externals/X-NNN.md`

```
id, title, status (waiting | delivered | verified), contract, owner_team, env, feature
```

Phần thân có mục `## Vấn đề`. Mỗi vấn đề là một khối `### X-NNN-k` gồm: mô tả, bằng chứng, trạng thái (`open | sent | fixed | verified`).

### 2.5 Sự kiện mới

`feature_created`, `feature_status`, `review_ok`, `review_reopened`, `feature_ready_to_start` (`urgent`), `feature_waiting_acceptance` (`urgent`), `feature_accepted`, `feature_rejected`, `ext_created`, `ext_delivered`, `ext_issue` , `ext_fixed`, `ext_verified`, `external_drift` (`urgent`), `setup_done`, `setup_failed`.

## 3. Chuyên môn (`area`), việc T-020

- `ag approve-agent <ID> --role coder|tester --area fe[,be]`. Master không có chuyên môn.
- `--area` không có trong `areas`: mã 1.

| Tiêu chí | Nội dung |
|---|---|
| **A-AREA-1** | `ag claim` việc có `area: be` bởi agent chỉ có `fe`: mã 2, báo rõ chuyên môn của agent và của việc |
| **A-AREA-2** | Agent có `fe,be` nhận được việc `fe`, việc `be`, và việc `integration` có `area: fe,be` |
| **A-AREA-3** | Hook: Coder `fe` commit file khớp thư mục của `be` thì bị từ chối, kể cả khi file đó nằm trong `files:` của việc. Đây là hàng rào kép |
| **A-AREA-4** | Hook: thư mục `shared` chỉ commit được từ việc có `area: shared`, hoặc từ Master |
| **A-AREA-5** | `areas` rỗng (dự án không chia chuyên môn): mọi kiểm tra chuyên môn đều bỏ qua, hành vi giống Giai đoạn 1 |

## 4. Tính năng `F-NNN` và vòng đời, việc T-021 và T-026

### 4.1 Vòng đời

```
analyzing → spec_draft → review → waiting_start → in_dev → waiting_acceptance → accepted → merged → pushed
```

| Chuyển | Ai | Lệnh | Điều kiện |
|---|---|---|---|
| (mới) → `analyzing` | Master | `ag feature new --title --priority [--files]` | Tạo nhánh `feature/F-NNN` từ `main_branch` |
| `analyzing` → `spec_draft` | Master | `ag feature status F spec_draft --spec <file>` | File đặc tả tồn tại |
| `spec_draft` → `review` | Master | `ag feature review F` | Có ít nhất 1 việc thuộc tính năng. Tự tạo việc review (mục 4.2) |
| `review` → `waiting_start` | tự động | — | Mọi việc review `done`, không còn `D-NNN` mở của tính năng. Sinh `feature_ready_to_start` |
| `waiting_start` → `in_dev` | chủ dự án (TTY) | `ag feature start F` | Mọi việc không phải review chuyển `draft` → `approved` |
| `waiting_start` → `spec_draft` | chủ dự án (TTY) | `ag feature reject F --note` | — |
| `in_dev` → `waiting_acceptance` | Master | `ag feature ready F` | Mọi việc `done`, mọi cổng `passed`, mọi `X-NNN` của tính năng `verified`. `test_cmd` xanh trên nhánh tính năng. Tự sinh báo cáo (mục 4.3) |
| `waiting_acceptance` → `accepted` | chủ dự án (TTY) | `ag feature accept F [--push]` | — |
| `waiting_acceptance` → `in_dev` | chủ dự án (TTY) | `ag feature reject F --bug "…"` | Tạo `B-NNN` gắn với tính năng |
| `accepted` → `merged` | Master | `ag feature merge F` | Gộp vào `main_branch`, chạy lại test. Có `--push` lúc accept thì `ag` push luôn `main_branch` (dùng mã dùng một lần của mục 5.13a Giai đoạn 1, do lần xác nhận lúc accept cấp) |
| `merged` → `pushed` | chủ dự án hoặc tự động | `ag push` | — |

| Tiêu chí | Nội dung |
|---|---|
| **A-FEAT-1** | Mọi ô trong bảng: đúng vai thì đổi được, sai vai thì mã 2, sai thứ tự thì mã 3. Test viết dạng bảng |
| **A-FEAT-2** | `ag task new --feature F` khi tính năng đã qua `in_dev`: mã 3. Muốn thêm việc thì chủ dự án phải `reject` về `spec_draft` |
| **A-FEAT-3** | Việc thuộc tính năng có trạng thái khởi đầu là `draft`. Không ai `claim` được trước khi tính năng `in_dev`, trừ việc `type: review` |
| **A-FEAT-4** | `ag merge T` (Master) với việc có `feature`: gộp vào `feature/F-NNN`, **không** gộp vào `main_branch`. Việc không có `feature`: gộp vào `main_branch` như Giai đoạn 1 |
| **A-FEAT-5** | `ag feature list`: mỗi tính năng một dòng, gồm mã, tên, ưu tiên, trạng thái, tiến độ (việc `done`/tổng), đang chờ gì (câu hỏi, cổng, `X-NNN`, chủ dự án) |
| **A-FEAT-6** | `ag feature priority F <1..5>` chỉ chủ dự án (TTY) |
| **A-FEAT-7** | `ag feature new --files` có vùng chồng lên một tính năng đang ở `review`, `waiting_start` hay `in_dev`: tính năng vẫn được tạo, nhưng có cảnh báo, và tự tạo `D-NNN` gửi chủ dự án: làm tuần tự hay song song |
| **A-FEAT-8** | `ag feature merge F` bị xung đột với `main_branch`: `git merge --abort`, `main_branch` giữ nguyên, tạo `B-NNN` liệt kê file xung đột, tính năng về `in_dev` |
| **A-FEAT-9** | `accept --push` thành công: `main_branch` trên remote trùng commit gộp. `accept` không có `--push`: không push gì cả |

### 4.2 Bước review đặc tả

- `ag feature review F` tạo, cho **mỗi chuyên môn** trong `areas` của tính năng, một việc `type: review, area: <cm>`, và **một việc** `type: review, area: tester`.
- Người nhận việc review dùng một trong hai:
  - `ag ask …` (có thể hỏi nhiều câu);
  - `ag review ok F --area <cm> --note "…"`.
- Tester review: `ag review ok` **bắt buộc** có `--test-plan <file>`. File này nằm trong `acceptance_dirs` và liệt kê, cho mỗi tiêu chí chấp nhận của tính năng, ít nhất một ca kiểm thử.

| Tiêu chí | Nội dung |
|---|---|
| **A-REV-1** | `review ok` khi việc review của mình còn câu hỏi mở: mã 3 |
| **A-REV-2** | Tester `review ok` không có `--test-plan`, hoặc file thiếu ca kiểm thử cho một tiêu chí nào đó (đối chiếu mã tiêu chí `A-…` trong đặc tả tính năng): mã 3, in các tiêu chí còn thiếu |
| **A-REV-3** | Master sửa file đặc tả của tính năng khi tính năng đang ở `review` hoặc `waiting_start` (phát hiện bằng commit mới chạm vào file `spec`): việc review của **mọi chuyên môn** đã `ok` bị mở lại, sinh `review_reopened`, và tính năng về `review` nếu đang `waiting_start` |
| **A-REV-4** | Việc review cuối cùng `ok` và không còn câu hỏi mở: tính năng tự sang `waiting_start`, sinh `feature_ready_to_start` |

### 4.3 Báo cáo nghiệm thu, `ag feature report F`

Sinh mục `## Báo cáo nghiệm thu` trong file tính năng, và in ra màn hình. Báo cáo gồm:
1. **Tiêu chí chấp nhận:** mỗi tiêu chí kèm việc đã làm và bằng chứng `verify` của Tester.
2. **Test:** lệnh và kết quả chạy `test_cmd` trên nhánh tính năng.
3. **Lỗi:** mọi `B-NNN` của tính năng, kèm trạng thái.
4. **Quyết định:** mọi `D-NNN` của tính năng, kèm câu trả lời và người trả lời.
5. **Phụ thuộc bên ngoài:** `X-NNN` và các vấn đề đã xử lý.
6. **Cách tự thử:** lấy từ mục `## Cách thử` trong đặc tả tính năng. Master bắt buộc viết mục này.
7. **Chưa làm, hoặc ngoài phạm vi.**

| Tiêu chí | Nội dung |
|---|---|
| **A-RPT-1** | Báo cáo có đủ 7 phần. Phần không có dữ liệu thì ghi "Không có" |
| **A-RPT-2** | Đặc tả tính năng thiếu mục `## Cách thử`: `feature ready` trả mã 3 |

## 5. Hợp đồng API và việc ghép nối, việc T-022

| Tiêu chí | Nội dung |
|---|---|
| **A-CON-1** | Hook: commit file trong `contract_dirs` từ worktree không phải Master: bị từ chối |
| **A-CON-2** | `ag task new --type integration` bắt buộc có `--depends` gồm ít nhất một việc khác chuyên môn, hoặc một `X-NNN`, hoặc một cổng `G-NNN`. Thiếu thì mã 1 |
| **A-CON-3** | Việc `integration` chỉ claim được khi mọi phụ thuộc đã xong (`done`, `passed`, `X-NNN` ở `delivered` hoặc `verified`) |
| **A-CON-4** | `ag bug` có thêm `--kind fe|be|contract`. `contract` không tạo lỗi cho việc nào, mà tạo `D-NNN` gửi Master (Master chuyển lên nếu không có nguồn) |

## 6. Phụ thuộc bên ngoài `X-NNN`, việc T-023

| Lệnh | Ai | Việc làm |
|---|---|---|
| `ag ext new --title --contract <file> --owner-team "…" [--feature F] [--delivered --env <url>]` | Master | Tạo `X-NNN`. Có `--delivered` (API có sẵn) thì tạo luôn ở trạng thái `delivered` |
| `ag ext delivered X --env <url> --note "…"` | chủ dự án (TTY) | `waiting` → `delivered` |
| `ag ext issue X "…" --evidence "…"` | Tester, Master | Thêm vấn đề `open` |
| `ag ext issues X --export` | mọi người | In các vấn đề `open` thành văn bản thuần, đủ để gửi đội ngoài: tên API, môi trường, từng vấn đề kèm bằng chứng. Các vấn đề đã in chuyển `sent` |
| `ag ext fixed X <k>[,<k>…]` | chủ dự án (TTY) | `sent` → `fixed`. Mở lại việc kiểm tra cho Tester |
| `ag ext verify X` | Tester | Mọi vấn đề `verified` hoặc không có vấn đề, test hợp đồng trên `env` đạt: `X` → `verified` |
| `ag ext check X` | Tester, Master | Chạy `live_check_cmd`. Lệch thì sinh `external_drift` và tạo một `D-NNN` gửi chủ dự án (không tạo trùng) |

| Tiêu chí | Nội dung |
|---|---|
| **A-EXT-1** | `delivered`, `fixed` không có TTY: mã 2 |
| **A-EXT-2** | `--export` không in biến nào lấy từ `.env`. Test cài một giá trị bí mật vào `.env` rồi kiểm tra rằng giá trị đó không xuất hiện trong kết quả |
| **A-EXT-3** | Việc phụ thuộc `X-NNN` chỉ claim được khi `X` ở `delivered` hoặc `verified` |
| **A-EXT-4** | `ag ext verify` còn vấn đề chưa `verified`: mã 3 |
| **A-EXT-5** | `live_check_cmd` trống: `ag ext check` báo cần khai, mã 4 |

**Luật đưa vào `templates/WORKFLOW.md` (việc T-025):**
- Không gọi API thật trong `test_cmd`.
- Khoá API chỉ nằm trong `.env`, không in vào nhật ký hay bàn giao.
- Tôn trọng hạn mức gọi của bên cung cấp.
- Agent không liên lạc với đội ngoài; chủ dự án là cầu nối.

## 7. Chạy song song an toàn, việc T-024

| Tiêu chí | Nội dung |
|---|---|
| **A-PAR-1** | Agent AI đang giữ một việc `in_progress` mà `claim` thêm việc khác: mã 3. Agent `tool: human` thì được |
| **A-PAR-2** | `claim` tạo worktree mới: chạy `setup_cmd` trong worktree đó. Thất bại thì giữ nguyên worktree, việc vẫn được nhận, sinh `setup_failed` kèm 20 dòng cuối, mã 4 |
| **A-PAR-3** | Mỗi worktree được cấp `AG_SLOT` nhỏ nhất chưa dùng (bắt đầu từ 1). `.agents-local/env` chứa `AG_SLOT` và các biến trong `worktree_env` đã tính sẵn (ví dụ `PORT=3002`). Worktree bị xoá thì khe được trả lại |
| **A-PAR-4** | `ag env` in nội dung `.agents-local/env` dạng `KEY=VALUE`, để agent nạp vào shell của mình |
| **A-PAR-5** | Hai worktree không bao giờ cùng `AG_SLOT`, kể cả khi claim đồng thời (kiểm tra khoá) |

## 8. Hộp thư Master theo tính năng, việc T-027

| Tiêu chí | Nội dung |
|---|---|
| **A-MIB-1** | `ag inbox` của Master nhóm theo tính năng (xếp theo ưu tiên), rồi mới tới mục "không thuộc tính năng". Trong mỗi nhóm, câu hỏi đang chặn việc đứng đầu |
| **A-MIB-2** | `ag inbox --feature F` chỉ in nhóm của `F` |
| **A-MIB-3** | `ag feature note F "…"` (Master) ghi thêm vào mục "Ghi chú của Master" kèm giờ, không ghi đè ghi chú cũ |
| **A-MIB-4** | `ag inbox` của Coder và Tester: việc có thể nhận được xếp theo ưu tiên của tính năng trước (1 cao nhất), rồi tới thứ tự cũ |

## 8a. Master chính và Master luồng, việc T-028

Thêm theo đề xuất bổ sung 03 (thay quyết định 22).

- **Master chính:** ID `master`, làm ở worktree chính, phạm vi toàn dự án. Chỉ có 1.
- **Master luồng:** ID `master-F-NNN`, mỗi tính năng tối đa 1. Duyệt bằng `ag approve-agent master-F-005 --role master --feature F-005` (chủ dự án, TTY).
- Khi check-in, Master luồng được cấp worktree `<repo>-wt/master-F-NNN/` trên nhánh `feature/F-NNN`.
- Câu hỏi của Coder và Tester thuộc tính năng có Master luồng thì gửi `to: master-F-NNN`. Tính năng không có Master luồng thì gửi Master chính. Master luồng không có nguồn để trả lời thì `escalate` thẳng lên chủ dự án.
- Đặc tả của tính năng (`dac-ta/F-NNN-*.md`) nằm trên nhánh tính năng cho tới khi tính năng được gộp vào `main_branch`.

| Tiêu chí | Nội dung |
|---|---|
| **A-MFL-1** | Duyệt Master luồng cho tính năng không tồn tại, đã `merged`, hoặc đã có Master luồng: mã 3 |
| **A-MFL-2** | Master luồng gọi lệnh trên đối tượng (việc, câu hỏi, lỗi, tính năng) **không thuộc** tính năng của mình: mã 2. Test dạng bảng phủ các lệnh `task new`, `status`, `answer`, `escalate`, `merge`, `feature review/ready/note`, `ext new`, `gate new` |
| **A-MFL-3** | Master luồng gọi `feature merge`, `feature priority`, `approve-agent`: mã 2. Đây là việc của Master chính hoặc chủ dự án |
| **A-MFL-4** | Hook: Master luồng chỉ commit được trên nhánh `feature/F-NNN` của mình, và chỉ file đặc tả khớp `dac-ta/F-NNN-*`. Commit lên `main_branch` hoặc sửa mã nguồn: bị từ chối |
| **A-MFL-5** | `ag ask` của Coder hoặc Tester trên việc thuộc tính năng có Master luồng: câu hỏi có `to: master-F-NNN` và hiện trong `ag inbox` của Master luồng, không hiện trong inbox của Master chính |
| **A-MFL-6** | Tính năng chuyển `merged`: Master luồng tự chuyển `status: retired` trong registry, worktree được dọn nếu không còn thay đổi chưa commit, sinh sự kiện `agent_retired` |
| **A-MFL-7** | Master chính vẫn làm được mọi lệnh trên mọi tính năng, kể cả tính năng đang có Master luồng |

## 9. Skill mới, việc T-025

Thêm vào `templates/skills/`, mỗi file đủ 4 mục như A-SKL-1:
- `fe/fe-dung-api-gia`, `fe/fe-kiem-thu-giao-dien`,
- `be/be-lam-dung-hop-dong`, `be/be-thay-doi-du-lieu`,
- `chung/ghep-noi`, `chung/review-dac-ta`,
- `tester/ghi-du-lieu-mau`, `tester/kiem-tra-api-ngoai`, `tester/ke-hoach-kiem-thu`,
- `master/chia-tinh-nang`, `master/hop-dong-tu-api-co-san`, `master/bao-cao-nghiem-thu`, `master/xu-ly-nhieu-luong`.

`roles/*.md` liệt kê thêm các skill này. `templates/WORKFLOW.md` thêm 3 mục: vòng đời tính năng, bước review, luật dùng API bên ngoài.

## 10. Kiểm chứng đầu-cuối bổ sung (thêm vào T-013)

**A-E2E-1b** Trên repo mẫu có `server/` và `web/`:
1. Hai tính năng F-A (P1) và F-B (P2) chạy cùng lúc.
2. F-A có cả FE lẫn BE, đi đủ vòng đời từ `analyzing` tới `pushed` (push vào một repo bare cục bộ).
3. Trong bước review của F-A có một câu hỏi lên tới chủ dự án.
4. F-B phụ thuộc một `X-NNN` (giả lập "đội ngoài" bằng một server cục bộ). Lần đầu lệch hợp đồng, `--export` ra văn bản, "đội ngoài" sửa, rồi `verified`.
5. Hai Coder BE chạy server cùng lúc trên hai cổng khác nhau nhờ `AG_SLOT`.
6. F-A có một Master luồng `master-F-A`: câu hỏi của Coder F-A đi tới Master luồng; Master luồng thử gộp vào `main` thì bị từ chối; Master chính gộp tính năng sau khi chủ dự án nghiệm thu.
7. **Đạt khi:** cả hai tính năng `merged`; báo cáo nghiệm thu của F-A đủ 7 phần; không có commit nào vi phạm hook chuyên môn hay hợp đồng.

## 11. Lịch sử thay đổi

| Ngày | Thay đổi | Ai duyệt |
|---|---|---|
| 16/11/2026 | Bản đầu tiên, từ đề xuất bổ sung 02 | Chủ dự án |
| 16/11/2026 | Thêm mục 8a (Master chính và Master luồng, việc T-028), bước 6 của A-E2E-1b. Từ đề xuất bổ sung 03 | Chủ dự án |
