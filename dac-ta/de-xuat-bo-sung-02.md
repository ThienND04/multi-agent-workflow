# Đề xuất bổ sung 02: các tình huống thực tế về FE/BE và làm nhiều tính năng cùng lúc

**Trạng thái:** **Đã duyệt toàn bộ 13 điểm** ngày 16/11/2026. Đặc tả chính thức: `dac-ta/giai-doan-1b.md`, các việc T-020…T-027.

**Bốn tình huống chủ dự án đưa ra:**
1. Một đầu việc cần làm cả BE lẫn FE. Cần các vai FE và BE, mỗi vai lo phần của mình.
2. Mình chỉ làm FE, BE do một đội khác làm. Khi BE xong thì ghép nối và xử lý các vấn đề phát sinh.
3. Chỉ có FE, API đã có sẵn (như app Lịch mua bán dùng API giá chứng khoán).
4. Làm nhiều tính năng cùng lúc: đang chờ tính năng A thì làm tiếp tính năng B, nên có nhiều phiên AI chạy song song.

Các điểm cần duyệt gom ở **mục 8**.

---

## 1. Thiết kế hiện tại đã đáp ứng được đến đâu

| Tình huống | Đã có | Còn thiếu |
|---|---|---|
| 1. BE + FE cùng repo | Coder chạy song song, phạm vi file từng việc, hợp đồng API (mới có trong đề xuất 01, dùng cho hai repo) | Chưa phân biệt Coder FE với Coder BE. Chưa có cách gom các việc thuộc cùng một tính năng. Chưa có bước "ghép nối" |
| 2. BE do đội khác làm | Cổng `gate`, liên kết `links` | `links` chỉ dùng được khi repo bên kia **cũng chạy workflow này**. Đội khác thì không chạy `ag`. Chưa có chỗ ghi "đội BE báo xong", chưa có cách gửi lỗi sang đội bên ngoài |
| 3. API có sẵn | `fixture_dirs` (dữ liệu mẫu cố định) | Chưa có quy trình chụp dữ liệu thật làm mẫu. Chưa phát hiện được khi API bên ngoài đổi. Chưa có luật dùng API thật (hạn mức gọi, khoá API) |
| 4. Nhiều tính năng cùng lúc | Nhiều Coder, chống trùng file khi nhận việc, tiếp quản | Không gom được việc theo tính năng, không có độ ưu tiên. Việc của A gộp thẳng vào `main` khi A còn dở. Hai Coder BE chạy server cùng lúc sẽ tranh cổng mạng và cơ sở dữ liệu |

Bốn tình huống có chung một gốc: **chưa có khái niệm "tính năng"** để gom việc, và **chưa phân biệt các nguồn API**. Đề xuất dưới đây thêm 5 khái niệm và giải cả 4 tình huống bằng cùng một bộ.

---

## 2. Năm khái niệm mới

| # | Khái niệm | Giải tình huống |
|---|---|---|
| A | **Chuyên môn** (`area`) cho agent và việc: `fe`, `be`… | 1 |
| B | **Tính năng** `F-NNN`: gom các việc, có độ ưu tiên, nhánh riêng, chủ dự án nghiệm thu | 1, 4 |
| C | **Hợp đồng API** thành tài liệu chính thức trong `contracts/`, kèm việc **ghép nối** | 1, 2, 3 |
| D | **Phụ thuộc bên ngoài** `X-NNN`: API của đội khác hoặc API có sẵn | 2, 3 |
| E | **Chạy song song an toàn:** cài đặt riêng cho từng worktree, cổng mạng riêng, giới hạn số việc mỗi agent giữ | 4 |

### A. Chuyên môn (`area`)

**Chuyên môn là thuộc tính của Coder và Tester, không phải vai mới.** Lý do: Coder FE và Coder BE có cùng quyền (nhận việc, viết code, giao kiểm tra), chỉ khác loại việc. Tách thành vai mới thì phải nhân đôi toàn bộ bảng quyền mà không được thêm gì.

- `project.md` khai các chuyên môn và thư mục của từng chuyên môn:
  ```
  areas: [be=server/**, fe=web/**, shared=packages/types/**]
  ```
- Khi duyệt agent, chủ dự án ghi kèm chuyên môn:
  ```bash
  ag approve-agent coder-03 --role coder --area fe
  ```
  Một agent có thể có nhiều chuyên môn, ví dụ `--area fe,be` cho agent làm fullstack.
- Mỗi việc có `area:`. `ag claim` từ chối nếu chuyên môn của agent không khớp với việc.
- **Hàng rào kép:** ngoài phạm vi `files:` của việc, hook còn chặn Coder FE commit vào thư mục của `be`, và ngược lại.
- Thư mục `shared` (kiểu dữ liệu dùng chung, sinh từ hợp đồng) chỉ Master hoặc việc có `area: shared` được sửa.
- Tester cũng có chuyên môn. Tester FE chạy test giao diện, Tester BE chạy test API. Việc ghép nối (mục C) cần Tester có cả `fe` lẫn `be`, hoặc dùng Tester chuyên môn `e2e`.
- **Skill theo chuyên môn:** `skills/fe/`, `skills/be/` (mục 6).

### B. Tính năng `F-NNN`

Một tính năng là một yêu cầu của chủ dự án, ví dụ "Đặt hàng". Nó gom nhiều việc lại.

**Vòng đời:** xem mục F. Vòng đời ở mục F đã thay bản ngắn trước đây, để khớp với luồng chủ dự án mô tả.

**Mỗi tính năng có:**
- đặc tả riêng: `dac-ta/F-001-dat-hang.md`, được duyệt riêng;
- độ ưu tiên `priority: 1..5`, do chủ dự án đặt;
- **nhánh riêng** `feature/F-001`. Việc của tính năng gộp vào nhánh tính năng, **không gộp thẳng vào `main`**. Chỉ khi chủ dự án nghiệm thu cả tính năng thì Master mới gộp nhánh tính năng vào `main`.

**Lệnh mới:**

| Lệnh | Ai | Việc làm |
|---|---|---|
| `ag feature new --title "…" --priority 2` | Master | Tạo `F-NNN` và nhánh `feature/F-NNN` |
| `ag feature list` / `ag feature show F` | mọi agent | Bảng theo tính năng: bao nhiêu việc xong, việc nào đang chặn, đang chờ ai |
| `ag feature priority F <1..5>` | chủ dự án | Đổi độ ưu tiên |
| `ag feature accept F` / `ag feature reject F --bug "…"` | chủ dự án (TTY) | Nghiệm thu tính năng |
| `ag feature merge F` | Master | Gộp nhánh tính năng vào `main`, chạy lại test |

**Thay đổi so với đặc tả Giai đoạn 1:**
- `ag merge T` gộp việc vào nhánh **tính năng** của việc đó, không còn gộp vào `main`.
- `ag inbox` xếp việc theo **độ ưu tiên của tính năng** trước, rồi mới tới thứ tự cũ.
- Việc không thuộc tính năng nào (sửa lỗi nhỏ, việc lặt vặt) vẫn gộp thẳng vào `main` như cũ.

### C. Hợp đồng API và việc ghép nối

**Hợp đồng là nguồn sự thật chung giữa FE và BE**, dù BE nằm cùng repo, ở repo khác hay thuộc đội khác.

- Đặt trong `contracts/`, khai trong `project.md`: `contract_dirs: [contracts/**]`. Chỉ Master sửa được, sửa xong chủ dự án duyệt.
- FE và BE muốn đổi hợp đồng thì phải `ag ask`, không tự sửa.
- Định dạng do dự án chọn và ghi vào `project.md`, ví dụ OpenAPI. Workflow không bắt buộc định dạng nào.

**Master chia một tính năng có cả FE lẫn BE thành 4 loại việc:**

| Việc | Chuyên môn | Phụ thuộc | Nội dung |
|---|---|---|---|
| T-a: Hợp đồng | Master | — | Viết hợp đồng, chủ dự án duyệt |
| T-b: BE | `be` | T-a | Làm API đúng hợp đồng, kèm **test hợp đồng** |
| T-c: FE | `fe` | T-a | Làm giao diện với **API giả theo hợp đồng** |
| T-d: Ghép nối (`type: integration`) | `fe` (hoặc `fe,be`) | T-b, T-c | Bỏ API giả, nối API thật, test đầu-cuối |

**T-b và T-c chạy song song.** Không bên nào chờ bên nào, vì cả hai cùng bám vào hợp đồng.

**Vấn đề phát sinh khi ghép nối được phân làm 3 loại:**

| Loại | Ví dụ | Xử lý |
|---|---|---|
| Lỗi FE | FE đọc sai trường | `B-NNN` cho việc FE, như lỗi thường |
| BE làm lệch hợp đồng | API trả `price` dạng chuỗi, hợp đồng ghi là số | `B-NNN` cho việc BE nếu BE cùng repo. Nếu BE là đội ngoài thì xem mục D |
| Hợp đồng sai hoặc thiếu | Hợp đồng không nói lỗi 409 trả gì | `D-NNN` lên chủ dự án. **Không bên nào tự đoán** |

### D. Phụ thuộc bên ngoài `X-NNN`

Dùng khi API do **đội khác** làm (tình huống 2), hoặc **đã có sẵn** (tình huống 3), tức là bên cung cấp không chạy workflow này.

**Agent không bao giờ liên lạc trực tiếp với đội ngoài. Chủ dự án là cầu nối duy nhất.**

**Vòng đời:**
```
waiting ──▶ delivered ──▶ verified
(chờ đội    (chủ dự án báo:   (Tester chạy test hợp đồng
 ngoài)      "đội BE nói xong") trên API thật: đạt)
                 │
                 └── trượt ──▶ có vấn đề ──▶ (chủ dự án gửi đội ngoài, đội ngoài sửa) ──▶ delivered
```

**Lệnh mới:**

| Lệnh | Ai | Việc làm |
|---|---|---|
| `ag ext new --title "API đơn hàng (đội BE)" --contract contracts/external/orders.yaml --owner-team "Đội BE"` | Master | Tạo `X-NNN` ở trạng thái `waiting` |
| `ag ext delivered X --env staging --note "…"` | chủ dự án (TTY) | Ghi nhận đội ngoài báo xong, kèm môi trường để thử |
| `ag ext issue X "…" --evidence "…"` | Tester, Master | Ghi một chỗ lệch hợp đồng, sinh file **soạn sẵn để chủ dự án gửi đội ngoài** |
| `ag ext issues X --export` | chủ dự án | In mọi vấn đề còn mở thành một văn bản để dán vào email hay chat gửi đội ngoài |
| `ag ext fixed X <số vấn đề>` | chủ dự án (TTY) | Ghi nhận đội ngoài báo đã sửa. Tester kiểm lại |

**Tình huống 2 (đội BE khác làm):**
1. Đội BE đưa tài liệu API. Master chép vào `contracts/external/`, ghi rõ ngày và phiên bản. Chủ dự án duyệt.
2. FE làm với API giả theo hợp đồng đó.
3. Đội BE báo xong (qua chat hay email): bạn chạy `ag ext delivered X-001 --env staging`.
4. Việc ghép nối tự mở. Tester chạy test hợp đồng trên API thật.
   - Đạt: `X-001` chuyển `verified`, việc ghép nối tiếp tục.
   - Lệch: mỗi chỗ lệch là một `ag ext issue`. Bạn chạy `ag ext issues X-001 --export` rồi gửi cho đội BE. Khi họ báo đã sửa: `ag ext fixed`, Tester kiểm lại.

**Tình huống 3 (API có sẵn, ví dụ Lịch mua bán):**
1. `X-001` tạo ra ở trạng thái `delivered` ngay từ đầu.
2. **Chụp dữ liệu thật làm mẫu** (skill `ghi-du-lieu-mau`): Tester gọi API thật **một lần**, lưu response vào `fixtures/`, ghi ngày chụp. Bạn duyệt bộ dữ liệu mẫu. Đây chính là cách Lịch mua bán đã làm với `fixtures/` giá HPG, TCB.
3. Hợp đồng được viết từ tài liệu của bên cung cấp, đối chiếu với response thật đã chụp.
4. **Test thường chỉ chạy trên dữ liệu mẫu**, không gọi API thật. Như vậy kết quả cố định và không tốn hạn mức gọi.
5. **Kiểm tra API thật có đổi không:** khai `live_check_cmd` trong `project.md`, ví dụ `npm run contract:live`. Lệnh này gọi API thật một ít lần để so với hợp đồng. Chỉ chạy khi được yêu cầu, hoặc do Monitor chạy theo lịch ở Giai đoạn 2. Lệch thì sinh sự kiện `external_drift` và tạo câu hỏi cho bạn.

**Luật dùng API bên ngoài** (thêm vào `WORKFLOW.md`):
- Khoá API để trong `.env`, không commit, không in ra nhật ký hay bàn giao.
- Không gọi API thật trong test thường. Chỉ gọi qua `live_check_cmd` hoặc khi chụp dữ liệu mẫu.
- Tôn trọng hạn mức gọi và điều khoản của bên cung cấp. Không chạy vòng lặp gọi API.

**So sánh ba nguồn API:**

| Nguồn API | Dùng cơ chế | Ai báo "API sẵn sàng" |
|---|---|---|
| Cùng repo | Việc BE (T-b) và việc ghép nối (T-d) | `ag`, tự động khi T-b `done` |
| Repo khác, cùng chạy workflow | `links` + cổng `G-NNN` (đề xuất 01) | `ag`, tự động đọc trạng thái repo kia |
| Đội khác, hoặc API có sẵn | `X-NNN` | **Chủ dự án**, bằng `ag ext delivered` |

### E. Chạy song song an toàn (nhiều tính năng, nhiều phiên)

**1. Mỗi agent AI chỉ giữ 1 việc `in_progress` tại một thời điểm.**
- Muốn làm việc khác thì `ag release` hoặc giao kiểm tra trước.
- Muốn chạy song song nhiều việc thì mở thêm phiên AI với ID khác.
- Lý do: một phiên AI giữ nhiều việc thì ngữ cảnh lẫn lộn và bàn giao khó viết.
- **Người (`tool: human`) được giữ nhiều việc**, vì bạn có thể vừa chờ A vừa làm B.

**2. Cài đặt riêng cho từng worktree.**
- `project.md` khai `setup_cmd`, ví dụ `npm ci`. `ag claim` chạy lệnh này khi tạo worktree mới, để agent không phải tự đoán cách cài.
- Mỗi worktree được cấp một **số khe** `AG_SLOT` (1, 2, 3…), ghi vào `.agents-local/env`. Dự án dùng số này để tách cổng mạng và cơ sở dữ liệu. Ví dụ trong `project.md`:
  ```
  worktree_env: [PORT=3000+AG_SLOT, DB_NAME=app_dev_AG_SLOT]
  ```
  Nhờ vậy, hai Coder BE chạy server cùng lúc không tranh nhau cổng 3000 hay cùng một cơ sở dữ liệu.

**3. Hai tính năng sửa chung một vùng code.**
- `ag claim` đã chặn trùng phạm vi file giữa các việc đang làm, bất kể thuộc tính năng nào.
- Thêm: mỗi tính năng khai **vùng ảnh hưởng** `files:`. Khi tạo tính năng mới có vùng chồng lên một tính năng đang làm, `ag feature new` cảnh báo và tạo câu hỏi cho bạn: làm tuần tự, hay làm song song và chấp nhận ghép xung đột lúc gộp.
- Gộp tính năng sau vào `main` mà xung đột: việc đó trả về Coder (`reopened`) kèm danh sách file xung đột, không ai tự giải xung đột ngay trên `main`.

**4. Bạn theo dõi được nhiều tính năng cùng lúc.**
- `ag feature list` cho một bảng: tính năng, độ ưu tiên, tiến độ, đang chặn ở đâu, chờ ai.
- Câu hỏi, cổng, lỗi đều gắn mã tính năng. Telegram và trang web nhóm theo tính năng.
- Lời nhắn mở phiên có thể chỉ định tính năng: *"ID: coder-04, vai Coder, chuyên môn fe, ưu tiên việc của F-002"*.

**Ví dụ: đang chờ A thì làm B**
```
F-001 "Đặt hàng"    priority 1   FE xong, chờ X-001 (đội BE)  → đang chặn, chờ chủ dự án báo delivered
F-002 "Báo cáo"     priority 2   coder-03 (fe) đang làm T-031, coder-05 (be) đang làm T-032
```
`ag inbox` của coder-03 không còn việc nào của F-001 làm được, nên tự đưa việc của F-002 lên. Khi bạn chạy `ag ext delivered X-001`, việc ghép nối của F-001 mở ra. Vì F-001 có độ ưu tiên cao hơn, việc đó đứng đầu `inbox` của agent rảnh tiếp theo.

### F. Luồng một tính năng theo mô tả của chủ dự án

Chủ dự án mô tả luồng mong muốn như sau:
1. Trình bày yêu cầu, cùng Master phân tích.
2. Master viết tài liệu, chia việc FE, BE, Tester.
3. Bàn giao tài liệu cho các agent cấp dưới. Cấp dưới **review**, hỏi đáp. Câu nào Master không quyết được thì báo chủ dự án xác nhận.
4. **Khi đã có đủ mọi thứ**, cấp dưới mới thực thi: code, test, lặp lại nếu có lỗi.
5. Xong thì báo Master, rồi báo chủ dự án.
6. Chủ dự án xác nhận tính năng đạt hay không, và có push hay không.
7. Trong lúc chờ tính năng A, chủ dự án và Master làm tiếp tính năng B theo cùng luồng.

**Đối chiếu với thiết kế (Giai đoạn 1 + đề xuất 01 + mục A–E ở trên):**

| Bước | Đã có | Còn hở |
|---|---|---|
| 1–2 | Đặc tả, chia việc, chuyên môn, tính năng | — |
| 3 | Chuỗi hỏi, chuyển lên chủ dự án, thông báo (Telegram ở Giai đoạn 2) | **Chưa có bước review đặc tả.** Hiện tại việc được duyệt là Coder nhận làm ngay, cấp dưới không có lúc nào để đọc và hỏi trước khi bắt tay |
| 4 | Câu hỏi chặn việc (`blocked`) | **Chưa có điểm "đã đủ mọi thứ, bắt đầu làm"** ở mức tính năng. Mới chỉ chặn từng việc riêng lẻ |
| 5 | Tester, lỗi, vòng sửa | **Chưa tự nhận ra "tính năng xong"**, chưa có báo cáo tổng hợp gửi chủ dự án |
| 6 | `ag feature accept`, `ag push` | Hai bước rời nhau. Nên gộp thành một lần xác nhận |
| 7 | Nhiều tính năng, độ ưu tiên | Master một mình xử lý nhiều luồng: cần luật làm việc cho Master (F.4) |

#### F.1 Vòng đời tính năng (thay bản ở mục B)

```
analyzing ──▶ spec_draft ──▶ review ──▶ waiting_start ──▶ in_dev ──▶ waiting_acceptance ──▶ accepted ──▶ merged ──▶ pushed
(chủ dự án    (Master viết   (cấp dưới    (chủ dự án duyệt   (code, test,   (Master đã kiểm   (chủ dự án     (Master   (chủ dự án
 + Master      tài liệu,      đọc, hỏi;    đặc tả cuối và      ghép nối,      xong, báo cáo     nghiệm thu)    gộp vào   push, nếu
 phân tích)    chia việc)     Master trả   danh sách việc:     sửa lỗi)       gửi chủ dự án)                   main)     chọn push)
                              lời, chuyển  "bắt đầu làm")
                              lên khi cần)
```
- Bị từ chối ở `waiting_start`: quay về `spec_draft`.
- Bị từ chối ở `waiting_acceptance`: quay về `in_dev`, kèm lỗi.

**Chủ dự án chỉ cần vào ở 4 thời điểm.** Mỗi thời điểm đều có thông báo:

| # | Lúc nào | Bạn làm gì | Lệnh |
|---|---|---|---|
| 1 | Bất kỳ lúc nào có câu hỏi Master không quyết được | Trả lời | `ag decide` |
| 2 | Review xong, mọi câu hỏi đã trả lời | Duyệt đặc tả cuối và danh sách việc, cho **bắt đầu làm** | `ag feature start F` |
| 3 | Có cổng hay phụ thuộc bên ngoài (mục D) | Xác nhận API sẵn sàng | `ag gate pass`, `ag ext delivered` |
| 4 | Tính năng xong | Nghiệm thu, và chọn push hay chưa | `ag feature accept F [--push]` |

#### F.2 Bước review đặc tả (bổ sung mới)

Khi Master chia việc xong, `ag feature review F` tự tạo **một việc review cho mỗi chuyên môn** có trong tính năng (`fe`, `be`) và **một việc cho Tester**. Loại việc: `type: review`.

- **Coder review:** đọc đặc tả, hợp đồng và các việc của chuyên môn mình. Kết quả là một trong hai:
  - `ag ask …`: còn câu hỏi. Có thể hỏi nhiều câu.
  - `ag review ok F --area fe --note "đủ để làm; ước lượng 3 việc, rủi ro: …"`.
- **Tester review:** đọc đặc tả và **viết luôn kế hoạch kiểm thử**: các ca kiểm thử ứng với từng tiêu chí chấp nhận. Đây chính là "viết test trước khi có code". Tiêu chí nào không biến được thành ca kiểm thử chạy được thì Tester hỏi, vì như vậy là tiêu chí đang mơ hồ.
- **Câu trả lời làm đổi đặc tả:** Master sửa đặc tả, ghi lịch sử thay đổi. `ag` **tự mở lại** các việc review của những chuyên môn bị ảnh hưởng, để họ đọc lại phần đã đổi.
- **Chuyển sang `waiting_start`** khi: mọi việc review đã `ok`, và không còn câu hỏi nào đang mở của tính năng. Lúc đó `ag` báo chủ dự án (thời điểm 2).
- Người review không bắt buộc là người sẽ làm. Kết quả review gắn với **chuyên môn**, không gắn với một phiên AI cụ thể.

#### F.3 Tự nhận ra "tính năng xong" và báo cáo

- Khi mọi việc của tính năng đã `done` (đã gộp vào nhánh tính năng) và mọi cổng đã `passed`, Master chạy test toàn bộ trên nhánh tính năng, rồi chạy `ag feature ready F`. Tính năng chuyển sang `waiting_acceptance`, chủ dự án được báo (thời điểm 4).
- `ag feature report F` sinh **báo cáo nghiệm thu** gồm:
  - những gì đã làm, theo từng tiêu chí chấp nhận;
  - kết quả test;
  - các lỗi đã gặp và đã sửa;
  - các quyết định đã đưa ra (`D-NNN`);
  - **cách tự thử**: lệnh chạy, URL, tài khoản thử;
  - những gì chưa làm hoặc ngoài phạm vi.
- `ag feature accept F --push` (cần gõ xác nhận): nghiệm thu → Master được phép gộp vào `main` → `ag` push luôn `main` sau khi gộp xong và test xanh. Không có `--push` thì gộp nhưng **chưa push**. Bạn push sau bằng `ag push`.

#### F.4 Master xử lý nhiều luồng cùng lúc

Bạn đang bàn tính năng B với Master trong khi tính năng A đang chạy. Câu hỏi từ các agent của A vẫn đổ về Master.

- **Luật cho Master:**
  - đầu mỗi lượt trao đổi với chủ dự án, chạy `ag inbox` trước;
  - câu hỏi đang chặn việc (`blocked`) được trả lời trước khi bàn tiếp tính năng mới;
  - câu nào cần chủ dự án thì chuyển lên ngay, không giữ lại.
- **`ag inbox` của Master nhóm theo tính năng**, kèm độ ưu tiên. Lọc được: `ag inbox --feature F-002`.
- **Mọi thứ của Master đều gắn mã tính năng**: đặc tả `dac-ta/F-NNN-*.md`, câu hỏi, tin nhắn. Phiên Master có thể đổi bất kỳ lúc nào: phiên mới đọc file là biết từng luồng đang ở đâu.
- **Khi ngữ cảnh của Master quá nặng** (nhiều luồng, phiên dài): mở phiên Master mới. Mỗi tính năng có mục "Ghi chú của Master" trong file tính năng (bàn giao riêng theo luồng), nên phiên mới không mất gì.
- **Đã thay bằng đề xuất bổ sung 03 (Master chính và Master luồng, việc T-028).** Nội dung cũ: **Phương án cho đội lớn, để sau:** mỗi tính năng một phiên Master riêng ("Master luồng"), làm việc trên nhánh tính năng. Phương án này phức tạp hơn (cần tách quyền gộp vào `main`), nên đề xuất chưa làm ở Giai đoạn 1b.

#### F.5 Việc mới

| Việc | Nội dung | Phụ thuộc |
|---|---|---|
| T-026 | Vòng đời tính năng đầy đủ (F.1); `ag feature review/start/ready/report`; `ag review ok`; tự mở lại review khi đặc tả đổi; `accept --push` | T-021, T-009, T-014 |
| T-027 | Inbox của Master nhóm theo tính năng, `--feature`; mục "Ghi chú của Master" trong file tính năng | T-021, T-008 |

### G. Giao diện monitor cho nhiều luồng (Giai đoạn 3)

Bản phác mới: `monitor-nhieu-luong-mockup.html` (dữ liệu giả, mở bằng trình duyệt). Trang có 4 khu:

| Khu | Để làm gì |
|---|---|
| **1. "Cần bạn"** (trên cùng, luôn hiện) | Mọi việc đang chờ chủ dự án, gộp từ mọi tính năng: câu hỏi, duyệt "bắt đầu làm", cổng, nghiệm thu. Mỗi mục có màu của tính năng và nút hành động. Đây là chỗ bạn nhìn đầu tiên |
| **2. Bảng luồng** | Mỗi tính năng một hàng, các cột là các bước của vòng đời (F.1). Mỗi hàng cho biết: đang ở bước nào, tiến độ việc (ví dụ 4/7), đang chặn ở đâu, chờ ai, độ ưu tiên. Bấm một hàng để lọc mọi khu khác theo tính năng đó |
| **3. Văn phòng 2D** | Nhân vật agent như bản phác cũ. Mỗi nhân vật có **viền màu của tính năng** đang làm. Lọc theo tính năng thì agent của tính năng khác mờ đi |
| **4. Chi tiết** | Bấm tính năng: các việc theo trạng thái, câu hỏi, lỗi, dòng thời gian, và **luồng trao đổi với Master riêng cho tính năng đó** (hộp thư theo tính năng). Bấm agent: việc đang giữ, kế hoạch các bước, nhật ký |

Mỗi tính năng có một màu cố định, dùng thống nhất ở cả 4 khu.

**Cập nhật 16/11/2026:** chủ dự án chọn phong cách **văn phòng pixel-art**. Bản phác chính thức: `monitor-pixel-office.html`, gộp cả 4 khu ở trên vào một cảnh văn phòng:
- màu áo của nhân vật là màu của tính năng họ đang làm;
- bảng trắng trên tường là bảng luồng thu nhỏ;
- agent đang chờ đứng ở cây nước;
- agent mới xin vào đứng ở cửa, kèm dấu "?";
- agent ngoại tuyến để bàn trống, màn hình tắt.

Nét vẽ do Master tự vẽ bằng khối pixel, **không dùng tài sản đồ hoạ của bên thứ ba**. Nếu chủ dự án có giấy phép một bộ tài sản pixel, Giai đoạn 3 có thể thay nét vẽ bằng ảnh sprite của bộ đó. Bạn nhìn màu là biết agent, câu hỏi hay lỗi thuộc luồng nào.

---

## 3. Ánh xạ tình huống sang cơ chế

| Tình huống | Cơ chế dùng |
|---|---|
| 1. BE + FE cùng repo | Tính năng (B) + chuyên môn (A) + hợp đồng và 4 loại việc (C) |
| 2. FE, BE do đội khác làm | Tính năng (B) + hợp đồng ngoài + phụ thuộc bên ngoài `X-NNN` (D) + việc ghép nối (C) |
| 3. FE, API có sẵn | Phụ thuộc bên ngoài `X-NNN` ở trạng thái `delivered` + chụp dữ liệu mẫu + `live_check_cmd` (D) |
| 4. Nhiều tính năng cùng lúc | Tính năng có độ ưu tiên và nhánh riêng (B) + chạy song song an toàn (E) |

## 4. Ảnh hưởng tới các việc đã có

| Việc | Ảnh hưởng |
|---|---|
| T-001, T-002 | **Không ảnh hưởng.** Có thể bắt đầu ngay trong lúc đề xuất này chờ duyệt |
| T-003 (`init`) | Thêm khoá mới trong `project.md` mẫu: `areas`, `contract_dirs`, `setup_cmd`, `worktree_env`, `live_check_cmd` |
| T-005 (`checkin`, `approve-agent`) | Thêm `--area` |
| T-006 (`task`, `status`) | Thêm khoá `area`, `feature`, loại việc `integration` |
| T-007 (`claim`) | Kiểm tra chuyên môn, giới hạn 1 việc mỗi agent AI, chạy `setup_cmd`, cấp `AG_SLOT` |
| T-008 (`inbox`) | Xếp theo độ ưu tiên của tính năng |
| T-011 (`merge`) | Gộp vào nhánh tính năng thay cho `main` |
| T-012 (hook) | Chặn theo chuyên môn, chặn sửa `contract_dirs` |
| T-015 (skill) | Thêm skill FE, BE, ghép nối, chụp dữ liệu mẫu |

## 5. Việc mới

| Việc | Nội dung | Phụ thuộc |
|---|---|---|
| T-020 | Chuyên môn `area`: khoá trong `project.md`, `--area` khi duyệt agent, kiểm tra khi claim, hook chặn theo chuyên môn | T-007, T-012 |
| T-021 | Tính năng `F-NNN`: `ag feature new/list/show/priority/accept/reject/merge`, nhánh tính năng, `merge` gộp vào nhánh tính năng | T-011 |
| T-022 | Loại việc `integration`, `contract_dirs`, hook chặn sửa hợp đồng | T-006, T-012 |
| T-023 | Phụ thuộc bên ngoài `X-NNN`: `ag ext new/delivered/issue/issues/fixed`, `live_check_cmd` | T-006, T-005 |
| T-024 | Chạy song song: `setup_cmd`, `AG_SLOT` và `worktree_env`, 1 việc mỗi agent AI, cảnh báo tính năng chồng vùng | T-007, T-021 |
| T-025 | Skill FE, BE, ghép nối, chụp dữ liệu mẫu, viết hợp đồng từ API có sẵn (Master viết) | T-015 |

## 6. Skill mới

| Nhóm | Skill | Dùng khi |
|---|---|---|
| FE | `fe-dung-api-gia` | Làm giao diện với API giả sinh từ hợp đồng |
| FE | `fe-kiem-thu-giao-dien` | Viết và chạy test giao diện |
| BE | `be-lam-dung-hop-dong` | Làm API đúng hợp đồng, viết test hợp đồng |
| BE | `be-thay-doi-du-lieu` | Đổi cấu trúc cơ sở dữ liệu an toàn (migration) |
| Ghép nối | `ghep-noi` | Bỏ API giả, nối API thật, phân loại vấn đề phát sinh theo 3 loại ở mục C |
| Tester | `ghi-du-lieu-mau` | Chụp response thật làm dữ liệu mẫu, ghi ngày chụp, chờ duyệt |
| Tester | `kiem-tra-api-ngoai` | Chạy test hợp đồng trên API của đội khác, ghi vấn đề bằng `ag ext issue` |
| Master | `chia-tinh-nang` | Tách một tính năng thành hợp đồng, BE, FE, ghép nối |
| Master | `hop-dong-tu-api-co-san` | Viết hợp đồng từ tài liệu và response thật của API có sẵn |

## 7. Xếp vào lộ trình

Đề xuất tách thành **Giai đoạn 1b**, chạy ngay sau các việc lõi của Giai đoạn 1:
- **Không làm chậm việc bắt đầu.** T-001, T-002 không bị ảnh hưởng, giao được ngay.
- Các việc lõi (T-003…T-019) chỉ cần **chừa chỗ** cho các khoá mới, ví dụ `area`, `feature` được đọc và ghi đúng định dạng, chưa cần xử lý. Master sẽ cập nhật tiêu chí của các việc đó trước khi chúng được giao.
- Phần chạy theo lịch (`live_check_cmd` do Monitor chạy, nhóm Telegram theo tính năng) thuộc Giai đoạn 2.

## 8. Các điểm đã duyệt (16/11/2026)

| # | Điểm | Đã duyệt |
|---|---|---|
| 1 | FE/BE là **chuyên môn** của Coder và Tester, hay là vai riêng | Chuyên môn (mục A) |
| 2 | Có khái niệm **tính năng** `F-NNN`, mỗi tính năng có nhánh riêng, chủ dự án nghiệm thu cả tính năng rồi mới vào `main` | Có (mục B) |
| 3 | Hợp đồng API là tài liệu chính thức, chỉ Master sửa, chủ dự án duyệt. Tính năng có FE và BE được chia thành 4 loại việc | Có (mục C) |
| 4 | **Phụ thuộc bên ngoài** `X-NNN`. Agent không liên lạc đội ngoài, chủ dự án là cầu nối và gửi danh sách vấn đề | Có (mục D) |
| 5 | Test thường chỉ chạy trên dữ liệu mẫu. API thật chỉ gọi qua `live_check_cmd` hoặc khi chụp dữ liệu mẫu | Có (mục D) |
| 6 | Mỗi agent AI giữ tối đa 1 việc `in_progress`. Người giữ được nhiều việc | Có (mục E) |
| 7 | `setup_cmd`, `AG_SLOT` và `worktree_env` để nhiều phiên chạy server cùng lúc | Có (mục E) |
| 8 | Xếp vào **Giai đoạn 1b**, T-001 bắt đầu ngay | Có (mục 7) |
| 9 | Thêm bước **review đặc tả** của cấp dưới, Tester viết kế hoạch kiểm thử ngay lúc review | Có (mục F.2) |
| 10 | Vòng đời tính năng theo F.1. Chủ dự án vào ở 4 thời điểm, trong đó có "bắt đầu làm" sau review | Có (mục F.1) |
| 11 | `ag feature accept F --push`: nghiệm thu và push trong một lần xác nhận | Có (mục F.3) |
| 12 | Một phiên Master xử lý mọi luồng, theo luật ở F.4. "Master luồng" để sau | Có (mục F.4) |
| 13 | Giao diện monitor theo 4 khu ở mục G | Có (mục G) |
