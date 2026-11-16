# Đề xuất bổ sung 01

**Trạng thái:** **Đã duyệt toàn bộ** ngày 16/11/2026. Đã đưa vào `specs/phase-1.md` mục 5.14–5.19, các việc T-015…T-019, và mở rộng T-003, T-011, T-013.
**Từ câu hỏi của chủ dự án:**
1. Áp dụng cho dự án có sẵn thế nào?
2. Chỉ có 1 đầu việc, 1 agent code thì workflow chạy thế nào?
3. Cấm tự push. **Đã đưa vào đặc tả** (mục 5.13a, việc T-014), vì đây là yêu cầu trực tiếp.
4. Chủ dự án làm FE, cần biết khi nào BE xong để xác nhận API rồi làm tiếp.
5. Mỗi vai có những skill nào?
6. Lưu trạng thái thế nào để agent hết token thì agent khác làm tiếp được?

Duyệt xong, Master đưa các mục đã duyệt vào `specs/phase-1.md` (ghi lịch sử thay đổi) và tạo việc mới. Các điểm cần duyệt gom ở **mục G**.

---

## A. Áp dụng cho dự án có sẵn

Workflow không đòi viết lại dự án. Nó chỉ thêm `.agents/` và nhánh `agents-state`, còn code cũ giữ nguyên.

### Các bước

| # | Ai | Làm gì |
|---|---|---|
| 1 | Chủ dự án | Commit hoặc stash hết thay đổi đang dở. Chạy `ag init` trong repo |
| 2 | Master | **Khảo sát dự án** (skill `khao-sat-du-an`, mục E): đọc cấu trúc thư mục, file build, CI, test hiện có. Điền `project.md`: `test_cmd`, `build_cmd`, `source_dirs`, quy ước code rút ra từ code hiện tại |
| 3 | Master | Chạy `test_cmd` để lấy **mốc ban đầu**: bao nhiêu test xanh, bao nhiêu đỏ. Ghi vào `project.md`, mục "Hiện trạng" |
| 4 | Chủ dự án | Duyệt `project.md`. Từ đây, quy ước trong file này là "nguồn" để Coder không phải hỏi những việc nhỏ |
| 5 | Master | **Chỉ viết đặc tả cho phần sẽ làm mới hoặc sửa**, không cần đặc tả lại code cũ. Phần code cũ liên quan được ghi là "hành vi hiện tại, phải giữ nguyên" |

### Những chỗ `ag init` phải xử lý thêm so với repo mới

- **Nhánh chính không tên `main`** (ví dụ `master`, `develop`): thêm khoá `main_branch` vào `project.md`. `ag` và hook dùng khoá này.
- **Đã có `AGENTS.md`, `CLAUDE.md`…**: không ghi đè. Thêm một mục "Workflow multi-agent: đọc `.agents/WORKFLOW.md`" vào cuối file cũ, và hỏi chủ dự án trước khi thêm.
- **Đã có git hook hoặc `core.hooksPath`** (ví dụ husky): không đè. Hook của `ag` gọi tiếp hook cũ, hoặc dừng lại và hỏi chủ dự án.
- **Test cũ đang đỏ**: `test_cmd` đỏ sẵn thì mọi việc đều bị chặn ở `in_test`. Thêm khoá `known_failing` (danh sách test đỏ có sẵn, chủ dự án duyệt). `ag` chỉ coi là đỏ khi có test **mới** hỏng.
- **Có remote, CI, nhiều người cùng làm**: workflow chỉ chạy trên máy này. Đẩy lên remote vẫn theo luật 5.13a, tức là chủ dự án push.

### Việc mới cần thêm

`ag init --existing`: chạy được khi repo đã có `AGENTS.md` hoặc hook, hỗ trợ `main_branch` và `known_failing`. Tiêu chí chấp nhận A-INIT-5 … A-INIT-8.

---

## B. Chỉ một đầu việc, một agent code

Workflow thu nhỏ được, nhưng **giữ nguyên nguyên tắc "người làm không tự nghiệm thu"**. Không có bước nào bị bỏ, chỉ có người làm thay đổi.

### Chế độ gọn (`team_mode: solo` trong `project.md`)

| Vai | Ai làm |
|---|---|
| Chủ dự án | Bạn |
| Master | 1 phiên AI (có thể dùng mô hình rẻ hơn) |
| Coder | 1 phiên AI |
| Tester | **Master kiêm.** Được phép, vì Master không phải người code |

Luồng:
1. Master tạo **1 việc duy nhất**, không bắt buộc chia nhỏ.
2. Coder nhận việc. Việc đầu tiên của Coder là ghi **kế hoạch các bước** vào file việc (mục F.2), chẳng hạn 1. tạo model, 2. API, 3. test.
3. Coder làm theo từng bước. Xong bước nào thì đánh dấu bước đó và ghi bàn giao.
4. `in_test` → Master kiểm tra như một Tester → `verified` → Master gộp.

Kế hoạch các bước thay cho việc chia việc nhỏ. Agent sau nhìn vào là biết đang ở bước mấy, không cần tách thành nhiều file việc.

### Có cần Master khi chỉ có 1 Coder không?

- **Phương án 1 (Master đề xuất):** có. Cần ít nhất 2 phiên AI: Master và Coder. Ai kiểm tra lại và ai trả lời câu hỏi đều đã rõ.
- **Phương án 2:** bạn kiêm Master, chỉ có 1 phiên AI làm Coder. Đỡ tốn hơn, nhưng mọi câu hỏi đến thẳng bạn, và bạn phải tự kiểm tra kết quả.

---

## C. Cổng xác nhận (ví dụ: chủ dự án làm FE, cần biết BE xong)

### Ý tưởng: thêm loại việc `gate`, và cho người tham gia như một agent

**1. Hợp đồng API là điểm gặp nhau, không phải code.**
- Trước khi FE và BE bắt đầu, Master viết **hợp đồng API**: file OpenAPI hoặc bảng endpoint, request, response, mã lỗi. Chủ dự án duyệt hợp đồng.
- FE và BE cùng làm theo hợp đồng này. FE dùng dữ liệu giả theo hợp đồng nên không phải ngồi chờ.

**2. Cổng là một việc loại `gate`, chỉ chủ dự án đóng được.**
```
T-020 (BE: API đơn hàng)  ──done──▶  G-001 (gate: "API đơn hàng sẵn sàng")  ──chủ dự án xác nhận──▶  T-021 (FE: nối API thật)
```
- `G-001` có `depends_on: [T-020]`, còn `T-021` có `depends_on: [G-001]`.
- **BE báo xong ở đâu:** khi `T-020` `done`, `ag` tự chuyển `G-001` sang `waiting_owner` và ghi sự kiện `gate_ready` (`urgent`). Tin này hiện trên Telegram (Giai đoạn 2), trong `ag inbox` của bạn, và trên web (Giai đoạn 3). Kèm theo là bằng chứng do Tester ghi: URL, lệnh `curl` mẫu, kết quả **test hợp đồng** (test so response thật với hợp đồng).
- **Bạn xác nhận:** gọi thử API, rồi chạy:
  - đạt: `ag gate pass G-001 --note "…"` (cần gõ xác nhận trong terminal, như `decide`). `T-021` mở ra để làm tiếp;
  - không đạt: `ag gate fail G-001 --bug "…"`. `ag` tạo `B-NNN`, `T-020` chuyển `reopened`, BE sửa, rồi cổng mở lại.

**3. Người tham gia như một agent.** Bạn tự làm FE, nên cũng cần nhận việc FE như một Coder:
- Thêm `tool: human` khi check-in, ví dụ `ag checkin --id owner-fe --tool human`. Vai Coder, chỉ giữ các việc FE.
- Agent người được miễn `heartbeat` (không bị mất việc vì quá hạn), nhưng vẫn ghi bàn giao như mọi agent.
- Hook vẫn áp dụng: commit FE của bạn chỉ được sửa thư mục FE của việc bạn đang giữ.

### C.1 FE và BE ở hai repo (chủ dự án chốt ngày 16/11/2026)

Nguyên tắc: **mỗi repo tự giữ trạng thái của mình, chỉ ĐỌC trạng thái của repo kia, không bao giờ ghi sang.** Không có trạng thái chung nào bị hai bên cùng ghi, nên không có xung đột.

**Khai báo liên kết** trong `project.md` của repo FE:
```
links: [be=../be-repo]
```
`be` là tên ngắn, `../be-repo` là đường dẫn tới repo BE trên cùng máy.

**Cổng nằm ở repo FE**, nơi bạn làm việc, và trỏ sang việc của repo BE bằng tiền tố:
```
G-001 (repo FE)   depends_on: [be:T-020]
T-021 (repo FE)   depends_on: [G-001]
```

**Luồng:**
1. **Hợp đồng API nằm ở repo BE** (`contracts/orders.yaml`), vì BE là bên cung cấp API. Master-BE viết, bạn duyệt.
2. Đặc tả FE trỏ tới hợp đồng kèm mã commit đã duyệt, ví dụ `be:contracts/orders.yaml@a1b2c3`. FE làm với dữ liệu giả theo đúng bản đó.
3. BE làm `T-020` → Tester-BE chạy test hợp đồng → Master-BE gộp → `T-020` `done`.
4. `ag` ở repo FE đọc trạng thái của BE: thấy `be:T-020` `done` thì chuyển `G-001` sang `waiting_owner` và báo bạn. Việc đọc này diễn ra mỗi lần chạy `ag inbox` hoặc `ag gate check`; từ Giai đoạn 2 thì Monitor theo dõi liên tục.
5. Bạn kiểm tra API thật → `ag gate pass G-001` → `T-021` mở ra.
   - Không đạt: `ag gate fail G-001 --bug "…"` tạo lỗi **ở repo FE**, kèm câu hỏi chuyển sang Master-BE. Bạn mang lỗi sang repo BE bằng `ag bug` ở bên đó. `ag` không tự ghi sang repo BE.
6. **Hợp đồng bị đổi sau khi FE đã dùng:** nếu file hợp đồng ở BE có commit mới hơn bản FE đang trỏ, `ag` ở repo FE báo `contract_changed` và tạo câu hỏi cho bạn. FE không tự chuyển sang bản mới.

**Master:** mỗi repo có Master riêng (Master-BE, Master-FE), vì mỗi repo phải tự đủ. Cả hai cùng hỏi lên một người là bạn. Nếu repo FE chỉ có mình bạn làm, repo FE dùng chế độ gọn (mục B): bạn kiêm Master, cùng `tool: human`.

**Hai repo không ở cùng máy** (ví dụ BE do người khác làm trên máy khác): repo BE phải push nhánh `agents-state` lên remote, rồi repo FE `git fetch` để đọc. Việc này đụng tới luật cấm tự push (mục 5.13a), nên để sang **Giai đoạn 2**. Giai đoạn 1 chỉ hỗ trợ hai repo trên **cùng máy**.

### Việc mới cần thêm

| Việc | Nội dung |
|---|---|
| T-018 | Loại việc `gate`, các lệnh `ag gate pass`, `ag gate fail`, `ag gate check`, `tool: human` |
| T-019 | Khoá `links` và `depends_on` có tiền tố repo, đọc trạng thái repo khác ở chế độ chỉ đọc, phát hiện `contract_changed` |

---

## D. (Đã xong) Cấm tự push

Xem `specs/phase-1.md` mục 5.13a. Tóm tắt:
- Hook `pre-push` chặn mọi lần push.
- Chỉ `ag push` đi qua được. Lệnh này chỉ chủ dự án chạy, phải gõ xác nhận tên nhánh.
- Agent cần push thì hỏi qua chuỗi hỏi.

---

## E. Skill của từng vai

Để AI nào cũng dùng được, skill là **file hướng dẫn từng bước dạng markdown** trong `.agents/skills/<vai>/<tên>.md`. Mỗi file có 4 phần: khi nào dùng, các bước, đầu ra, kiểm tra cuối.
- File vai trò (`roles/*.md`) liệt kê các skill của vai đó.
- Với Claude Code, `ag init` có thể sinh thêm bản `.claude/skills/` từ cùng nội dung. Đây chỉ là tiện ích, không bắt buộc.

### Chung cho mọi vai

| Skill | Dùng khi |
|---|---|
| `khoi-dong` | Đầu mỗi phiên: checkin → đọc vai → inbox |
| `ban-giao` | Sau mỗi bước lớn, trước khi dừng: viết bàn giao 3 ý đủ cụ thể |
| `lam-tiep` | Nhận việc người khác đang làm dở: đọc bàn giao, nhật ký, `git log` của nhánh, chạy test để thấy hiện trạng trước khi sửa |
| `dat-cau-hoi` | Gặp điều phải hỏi: viết câu hỏi một dòng, kèm ngữ cảnh và phương án |
| `sap-het-ngu-canh` | Phiên sắp hết token hoặc ngữ cảnh: commit tạm, đánh dấu bước, bàn giao ngay (mục F) |

### Master

| Skill | Dùng khi |
|---|---|
| `lam-ro-yeu-cau` | Nhận yêu cầu mới: hỏi lại tới khi đủ đầu vào, đầu ra, trường hợp lỗi, ngoài phạm vi |
| `viet-dac-ta` | Viết đặc tả có tiêu chí chấp nhận chạy được |
| `viet-hop-dong-api` | Có phần FE/BE tách nhau (mục C) |
| `chia-viec` | Chia việc: kích thước, phạm vi file không chồng nhau, phụ thuộc, cổng |
| `tra-loi-co-nguon` | Trả lời câu hỏi: tìm nguồn; không có nguồn thì chuyển lên chủ dự án kèm phương án |
| `duyet-truoc-khi-gop` | Đọc diff, đối chiếu phạm vi và tiêu chí, xem bằng chứng của Tester |
| `gop-nhanh` | Gộp nhánh, xử lý khi gộp lỗi |
| `khao-sat-du-an` | Áp dụng workflow vào dự án có sẵn (mục A) |
| `bao-cao-moc` | Báo chủ dự án khi xong một mốc, chỉ báo điều đã tự kiểm chứng |

### Coder

| Skill | Dùng khi |
|---|---|
| `doc-viec` | Đọc việc, đặc tả, các `D-NNN` liên quan; ghi kế hoạch các bước |
| `test-truoc` | Viết test trước, rồi code cho test xanh |
| `sua-loi` | Có `B-NNN`: tái hiện lỗi, viết test chống tái phát, sửa |
| `tu-kiem-truoc-khi-giao` | Trước khi `in_test`: build, test, chạy thử thật, kiểm lại phạm vi file |
| `commit-chuan` | Commit nhỏ, một ý, có `Agent-Id` và `Task` |

### Tester

| Skill | Dùng khi |
|---|---|
| `viet-ca-kiem-thu` | Viết ca kiểm thử từ tiêu chí, trước khi có code |
| `kiem-thu-thuc-te` | Chạy sản phẩm như người dùng thật: mở app, gọi API, dùng dữ liệu thật |
| `kiem-thu-hop-dong` | Kiểm response của API so với hợp đồng (cho cổng ở mục C) |
| `bao-loi` | Báo lỗi có cách tái hiện và bằng chứng |
| `kiem-lai-sau-sua` | Kiểm tra lại lỗi đã sửa, và kiểm tra hồi quy |

### Việc mới cần thêm

**T-015 (Master viết):** bộ skill ở trên, đặt trong `templates/skills/`. Không cần code, chạy song song được với các việc khác.

---

## F. Lưu trạng thái để agent khác làm tiếp khi hết token

Agent hết token thường **dừng đột ngột, không kịp bàn giao**. Vì vậy thiết kế không thể chỉ dựa vào việc agent tự giác ghi lại lúc dừng.

### F.1 Những gì đã có trong thiết kế (Giai đoạn 1)

| Lớp | Lưu gì | Ở đâu |
|---|---|---|
| File việc | Trạng thái, ai giữ, hạn giữ, nhánh, các bàn giao | `.agents-state/board/T-NNN.md` |
| Nhật ký | Mọi `ag log` | `.agents-state/journal/` |
| Sự kiện | Mọi lệnh `ag` đã chạy | `.agents-state/events.jsonl` |
| Code | Các commit trên nhánh riêng | `agent/<ID>/<T-NNN>` |
| Lịch sử trạng thái | Mỗi thay đổi là một commit | nhánh `agents-state` |

### F.2 Đề xuất bổ sung

**1. Kế hoạch các bước trong file việc.** Đây là cách làm chính, thay cho việc chỉ dựa vào bàn giao lúc dừng.
- Ngay sau khi nhận việc, agent ghi kế hoạch:
  ```bash
  ag plan T-012 "Tạo model" "Viết API" "Viết test" "Chạy thử thật"
  ```
- Xong bước nào thì đánh dấu bước đó:
  ```bash
  ag step T-012 2 --note "API xong, commit a1b2c3"
  ```
- Lệnh `ag step` tự ghi thêm một bàn giao ngắn. Nhờ vậy, dù agent chết bất ngờ, file việc vẫn cho biết đã xong tới bước mấy.

**2. Tự lưu phần chưa commit khi tiếp quản.**
- Khi agent mới nhận lại một việc quá hạn, nếu worktree của agent cũ còn thay đổi chưa commit, `ag claim` tự commit phần đó lên nhánh với thông điệp `WIP: tự lưu khi tiếp quản từ <ID cũ>`, rồi mới giao cho agent mới.
- Không mất dòng code nào.

**3. Làm tiếp ngay, không chờ quá hạn.**
- **Cùng ID:** mở phiên AI mới **trong đúng worktree cũ** và dán lại lời nhắn cũ. Danh tính vẫn nằm trong worktree, việc vẫn đang giữ, nên agent mới chỉ cần `ag inbox` là thấy việc và bàn giao. Cách này nhanh nhất.
- **Đổi ID:** chủ dự án chạy `ag reassign T-012 --to coder-02` để chuyển việc ngay. Không phải chờ hết 30 phút.

**4. Skill `sap-het-ngu-canh` (mục E).** Rule cho mọi vai: khi công cụ báo sắp hết ngữ cảnh, hoặc sau mỗi khoảng 30–45 phút làm việc liên tục, agent phải làm 3 việc trước khi làm tiếp:
- commit tạm,
- chạy `ag step` hoặc `ag handoff`,
- chạy `ag heartbeat`.

**5. Lời nhắn "làm tiếp" chuẩn**, ghi trong `internal/OWNER-GUIDE.md`:
```text
Đọc AGENTS.md và làm theo. ID của bạn: coder-01 (làm tiếp phiên trước bị dừng).
Chạy ag whoami và ag inbox, đọc bàn giao và kế hoạch các bước của việc đang giữ, chạy test để thấy hiện trạng, rồi làm tiếp từ bước chưa xong.
```

### Việc mới cần thêm

| Việc | Nội dung |
|---|---|
| T-016 | `ag plan`, `ag step` |
| T-017 | Tự lưu khi tiếp quản (A-CLM-10), `ag reassign` (chủ dự án, cần gõ xác nhận) |

---

## G. Các điểm đã duyệt (16/11/2026)

| # | Điểm | Đã duyệt |
|---|---|---|
| 1 | Áp dụng cho dự án có sẵn (mục A): `ag init --existing`, `main_branch`, `known_failing` | Duyệt, đưa vào Giai đoạn 1 |
| 2 | Chế độ gọn (mục B): Master kiêm Tester khi `team_mode: solo` | Duyệt |
| 3 | Chỉ có 1 Coder thì có cần Master không (mục B) | Phương án 1: vẫn cần Master (2 phiên AI) |
| 4 | Cổng `gate` và người tham gia như agent (mục C) | Duyệt, đưa vào Giai đoạn 1 |
| 5 | FE và BE cùng repo hay hai repo (mục C) | **Đã chốt: hai repo.** Duyệt thiết kế mục C.1: chỉ đọc chéo, cổng nằm ở repo FE, mỗi repo một Master. Giai đoạn 1 chỉ hỗ trợ hai repo cùng máy, việc T-018 và T-019 |
| 5b | Hai repo khác máy (cần push nhánh `agents-state`) | Để Giai đoạn 2, bàn riêng vì liên quan luật cấm tự push |
| 6 | Bộ skill (mục E), việc T-015 | Duyệt |
| 7 | `ag plan`/`ag step`, tự lưu khi tiếp quản, `ag reassign` (mục F), việc T-016, T-017 | Duyệt |
