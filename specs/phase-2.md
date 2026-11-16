# Đặc tả Giai đoạn 2: Monitor, STATUS.md và thông báo Telegram

**Trạng thái:** **Đã duyệt** ngày 16/11/2026 (chủ dự án duyệt toàn bộ 8 điểm ở mục 11). Viết bởi vai Master.
**Nguồn:** internal/DESIGN.md mục 5.6 và các quyết định 4, 13, 16, 20 (Telegram chỉ thông báo, không giờ yên lặng, liên kết hai repo khác máy để Giai đoạn 2), đề xuất bổ sung 02 mục D (kiểm tra API ngoài theo lịch).
**Nền:** mọi quy ước của `specs/phase-1.md` (mục 2: môi trường, mã thoát, không thư viện ngoài; mục 3: dữ liệu; mục 7: định nghĩa "xong") áp dụng nguyên cho file này.
**Các việc:** T-029 … T-036 trong `specs/tasks/`, đã chuyển sang `approved`.

Chỗ ghi là điểm Master chưa có nguồn để quyết. Các điểm này gom ở mục 11.

---

## 1. Phạm vi

**Có:**
- tiến trình **Monitor** chạy nền, theo dõi trạng thái;
- `STATUS.md` tự cập nhật;
- các luật phát hiện: việc quá hạn, agent im lặng, việc bị chặn lâu, câu hỏi chờ lâu;
- **Telegram một chiều**, gom tin, bản tóm tắt;
- chạy `live_check_cmd` theo lịch;
- liên kết hai repo ở **hai máy khác nhau**.

**Không có:**
- Telegram nhận lệnh hoặc nút bấm (đã chốt: chỉ thông báo);
- giờ yên lặng (đã chốt: không có);
- trang web (Giai đoạn 3).

**Monitor là chương trình, không phải AI.** Nó không ra quyết định, không sửa việc, câu hỏi hay lỗi.

## 2. Tiến trình Monitor, việc T-029

| Lệnh | Việc làm |
|---|---|
| `ag monitor start` | Chạy Monitor nền cho repo hiện tại. Đã chạy rồi thì báo pid, mã 3 |
| `ag monitor stop` | Dừng |
| `ag monitor status` | Đang chạy hay không, pid, thời điểm đọc sự kiện gần nhất, số tin đang chờ gửi |
| `ag monitor run` | Chạy ở tiền cảnh, in log ra màn hình. Dùng để thử |

- **Một repo, một Monitor.** File khoá `.agents-local/monitor.pid`. Nhiều repo (ví dụ FE và BE) thì mỗi repo một Monitor, dùng chung một bot. Mỗi tin có tiền tố `[tên dự án]` lấy từ `name` trong `project.md`.
- **Đọc sự kiện** bằng cách quét `events.jsonl` mỗi `monitor_poll_seconds` giây (mặc định 2). Dùng quét định kỳ thay cho theo dõi thay đổi file, vì cách sau không ổn định trên Windows.
- **Con trỏ đọc** (vị trí đã đọc tới trong `events.jsonl`) lưu ở `.agents-local/monitor.json`. Monitor khởi động lại thì đọc tiếp từ con trỏ, không gửi lại tin cũ.
- **Monitor không ghi gì vào `.agents-state/`**, trừ `STATUS.md` (mục 3). Trạng thái riêng của Monitor (con trỏ, các cảnh báo đã gửi, hàng đợi tin) nằm trong `.agents-local/`, không đưa lên git.
- Chạy tự động khi mở máy: hướng dẫn trong tài liệu (Task Scheduler trên Windows, `systemd --user` hoặc `launchd` trên Linux/macOS). Không làm lệnh cài tự động.

| Tiêu chí | Nội dung |
|---|---|
| **A-MON-1** | `start` hai lần: lần hai mã 3, không có tiến trình thứ hai |
| **A-MON-2** | Dừng Monitor, thêm 5 sự kiện, khởi động lại: đúng 5 sự kiện đó được xử lý, không sự kiện nào bị xử lý hai lần |
| **A-MON-3** | `events.jsonl` có một dòng hỏng (JSON sai): Monitor bỏ qua dòng đó, ghi cảnh báo vào log, đọc tiếp các dòng sau |
| **A-MON-4** | Sau khi Monitor chạy 10 phút có sự kiện, `git status` trong `.agents-state/` chỉ có thể thay đổi `STATUS.md` (file bị bỏ qua bởi git), không có gì khác |
| **A-MON-5** | Tắt Monitor bằng `stop` khi đang gửi dở: tin trong hàng đợi không mất, gửi tiếp ở lần chạy sau |

## 3. `STATUS.md` và các luật phát hiện, việc T-030

### 3.1 `STATUS.md`

- Đặt ở `.agents-state/STATUS.md`, có trong `.agents-state/.gitignore`. File này sinh lại liên tục nên không commit.
- Chỉ ghi lại khi nội dung đổi.

Nội dung theo thứ tự:
1. **Chờ bạn:** câu hỏi đã chuyển lên, tính năng chờ bắt đầu hoặc chờ nghiệm thu, cổng, `X-NNN` có vấn đề, agent xin vào.
2. **Cảnh báo:** việc quá hạn, agent im lặng, việc bị chặn lâu.
3. **Tính năng:** mỗi tính năng một dòng (như `ag feature list`).
4. **Agent:** đang làm gì, lần hoạt động cuối.
5. **Hoạt động gần đây:** 20 sự kiện cuối.

### 3.2 Các luật phát hiện

| Luật | Điều kiện | Khoá trong `project.md` (mặc định) |
|---|---|---|
| **Agent im lặng khi giữ việc** | Việc `in_progress` của agent AI có `lease_until` đã qua, và `last_seen` cũ hơn ngưỡng | `notify_silent_minutes: 30` |
| **Việc bị chặn lâu** | Việc `blocked` lâu hơn ngưỡng | `notify_blocked_hours: 4` |
| **Câu hỏi chờ bạn lâu** | `D-NNN` ở `escalated` lâu hơn ngưỡng. Nhắc lại mỗi chu kỳ bằng ngưỡng | `notify_question_remind_hours: 12` |
| **Cổng / tính năng chờ bạn lâu** | `waiting_start`, `waiting_acceptance`, `waiting_owner` lâu hơn ngưỡng | dùng chung `notify_question_remind_hours` |

- Mỗi cảnh báo chỉ gửi **một lần** cho mỗi lần xảy ra. Hết điều kiện (ví dụ agent hoạt động lại) rồi xảy ra lại thì mới gửi tiếp.
- Riêng luật "chờ bạn lâu" nhắc lại theo chu kỳ cho tới khi bạn xử lý.
- Việc do người giữ (`tool: human`) không bao giờ bị coi là im lặng.

| Tiêu chí | Nội dung |
|---|---|
| **A-STA-1** | `STATUS.md` có đủ 5 phần. Phần không có dữ liệu ghi "Không có" |
| **A-STA-2** | Sau khi một lệnh `ag` đổi trạng thái, `STATUS.md` phản ánh thay đổi trong vòng `2 × monitor_poll_seconds` giây |
| **A-RULE-1** | Mỗi luật ở bảng 3.2: test giả lập thời gian (đồng hồ giả) cho thấy cảnh báo phát đúng lúc vượt ngưỡng, không sớm hơn |
| **A-RULE-2** | Cảnh báo đã gửi không gửi lại khi Monitor khởi động lại |
| **A-RULE-3** | Việc của agent `tool: human` quá hạn: không có cảnh báo im lặng |
| **A-RULE-4** | Câu hỏi chờ bạn quá 12 giờ: nhắc lần 1; quá 24 giờ: nhắc lần 2; bạn `decide` rồi thì thôi nhắc |

## 4. Gửi Telegram, việc T-031

### 4.1 Cấu hình

`.env` ở gốc repo (đã nằm trong `.gitignore`):
```
TELEGRAM_BOT_TOKEN=…
TELEGRAM_CHAT_ID=…
```

`project.md`:

| Khoá | Mặc định | Ý nghĩa |
|---|---|---|
| `notify_channel` | `telegram` nếu có token, ngược lại `none` | `none` thì tắt gửi tin, mọi thứ khác vẫn chạy |
| `notify_batch_seconds` | `120` | Gom các tin trong khoảng này thành 1 tin |
| `notify_detail` | `title` | `title`: gửi mã kèm tiêu đề. `code-only`: chỉ gửi mã (`D-014`, `F-003`), không gửi tiêu đề, dành cho dự án nhạy cảm |
| `monitor_url` | trống | Có giá trị thì mỗi tin kèm link mở trang web (Giai đoạn 3) |

### 4.2 Sự kiện nào gửi đi

| Gửi ngay (gom trong 2 phút) | Vào bản tóm tắt | Không gửi |
|---|---|---|
| `decision_needed`, `feature_ready_to_start`, `feature_waiting_acceptance`, `gate_ready`, `checkin_pending`, `external_drift`, `bug_opened` mức `nghiem-trong`, `task_merged` thất bại (A-MRG-2), cảnh báo của mục 3.2 | `task_merged`, `task_status` → `done` và `verified`, `bug_opened` mức `vua`/`nho`, `review_ok`, `feature_accepted`, `pushed` | `heartbeat`, `log`, `task_claimed`, `handoff`, các câu hỏi Master tự trả lời được (`question_asked` → `question_answered`), `lock_stale` |

### 4.3 Nội dung tin

- Văn bản thuần, tiếng Việt, không dùng định dạng để khỏi phải xử lý ký tự đặc biệt.
- Mỗi tin gồm:
  - tiền tố `[tên dự án]`;
  - các mục **nhóm theo tính năng**, mỗi tính năng một ô màu (🟦 🟩 🟧 🟪 🟥 theo thứ tự tạo);
  - mỗi mục một dòng: mã, tiêu đề (theo `notify_detail`), và **lệnh gợi ý** để xử lý (ví dụ `ag decide D-014 "…"`);
  - cuối tin: link `monitor_url` nếu có.
- Tiêu đề dài quá 120 ký tự thì cắt. **Không bao giờ** gửi nội dung file, đoạn code, bằng chứng, nhật ký, hay biến lấy từ `.env`.

Ví dụ:
```
[lich-mua-ban] 3 việc cần bạn
🟧 F-003 Thông báo đẩy
  • Câu hỏi D-014: Gửi thông báo trong 22:00–7:00 không?  → ag decide D-014 "…"
🟪 F-004 Xuất Excel
  • Chờ nghiệm thu, 4/4 việc, 18 test đạt  → ag feature report F-004
⚠ coder-fe-02 im lặng 35 phút khi đang giữ T-030
```

### 4.4 Gửi tin

- Gọi API `sendMessage` của Telegram qua `https` của Node (không thư viện ngoài).
- **Lỗi mạng hoặc lỗi máy chủ:** thử lại sau 5 giây, 30 giây, 2 phút, 10 phút, rồi giữ trong hàng đợi và thử lại mỗi 10 phút.
- **Bị giới hạn tốc độ (429):** chờ đúng số giây Telegram trả về.
- **Sai token hoặc sai chat ID (401, 400, 403):** dừng gửi, ghi vào `STATUS.md` mục Cảnh báo, không thử lại cho tới khi cấu hình đổi.
- **Token không bao giờ xuất hiện** trong log, `STATUS.md`, sự kiện hay thông báo lỗi.
- Địa chỉ API đọc từ biến `TELEGRAM_API_BASE`, mặc định `https://api.telegram.org`, để test dùng máy chủ giả.

### 4.5 Lệnh

| Lệnh | Việc làm |
|---|---|
| `ag notify test` | Gửi một tin thử. In kết quả: gửi được, hoặc lý do lỗi (không in token) |
| `ag notify status` | Kênh, lần gửi cuối, số tin chờ, lỗi gần nhất |

| Tiêu chí | Nội dung |
|---|---|
| **A-NTF-1** | Không có token: `notify_channel` coi như `none`. Monitor vẫn chạy, `STATUS.md` vẫn cập nhật, `notify test` báo "chưa cấu hình", mã 4 |
| **A-NTF-2** | 5 sự kiện "gửi ngay" trong 30 giây: máy chủ giả nhận **đúng 1** tin, có đủ 5 mục, nhóm theo tính năng |
| **A-NTF-3** | Sự kiện thuộc cột "Không gửi": máy chủ giả không nhận gì |
| **A-NTF-4** | Máy chủ giả trả 500 hai lần rồi 200: tin được gửi đúng 1 lần |
| **A-NTF-5** | Máy chủ giả trả 429 kèm `retry_after: 3`: lần thử sau cách ít nhất 3 giây |
| **A-NTF-6** | Máy chủ giả trả 401: ngừng thử, có cảnh báo trong `STATUS.md`, token không có trong bất kỳ file log nào (test quét log) |
| **A-NTF-7** | `notify_detail: code-only`: tin không chứa tiêu đề nào |
| **A-NTF-8** | Tin không bao giờ chứa giá trị lấy từ `.env` (test cài một chuỗi bí mật vào `.env` rồi quét mọi tin đã gửi) |

## 5. Bản tóm tắt, việc T-032

- Gửi vào các giờ trong `notify_digest_times` `[08:00, 17:00]`, theo giờ máy.
- Nội dung, nhóm theo tính năng:
  - việc đã xong và đã kiểm tra từ bản tóm tắt trước;
  - lỗi mở và lỗi đã sửa;
  - tính năng đã nghiệm thu, đã push;
  - **số việc đang chờ bạn**, kèm mã.
- Không có gì mới từ bản tóm tắt trước thì không gửi.
- Máy tắt đúng giờ gửi: khi Monitor chạy lại, gửi **một** bản tóm tắt bù cho khoảng bị lỡ.

| Tiêu chí | Nội dung |
|---|---|
| **A-DIG-1** | Đồng hồ giả qua 08:00: đúng 1 bản tóm tắt, chỉ có sự kiện từ bản trước |
| **A-DIG-2** | Không có sự kiện mới: không gửi |
| **A-DIG-3** | Monitor tắt từ 07:00 đến 18:00 (lỡ cả 08:00 và 17:00): khi chạy lại, gửi đúng 1 bản tóm tắt bù |

## 6. Kiểm tra API ngoài theo lịch, việc T-033

- `project.md`: `live_check_times: [09:00]` (mặc định rỗng, tức là không tự chạy).
- Đến giờ, Monitor chạy `ag ext check X` cho mọi `X-NNN` ở `delivered` hoặc `verified`, **lần lượt**, cách nhau ít nhất 10 giây (tôn trọng hạn mức gọi của bên cung cấp).
- Lệch hợp đồng thì `ag ext check` tự tạo `D-NNN` và sinh `external_drift`. Monitor chỉ việc gửi tin theo mục 4.2.
- Monitor gọi `ag` như một người dùng bình thường, với danh tính riêng `monitor`, được ghi vào `assignments.md` lúc `ag init`. `monitor` chỉ được chạy `ext check`; các lệnh khác trả mã 2.

| Tiêu chí | Nội dung |
|---|---|
| **A-LIVE-1** | Đến giờ: mỗi `X-NNN` hợp lệ được kiểm đúng 1 lần, theo thứ tự, cách nhau ≥ 10 giây |
| **A-LIVE-2** | `live_check_cmd` trống: không chạy gì, không có lỗi |
| **A-LIVE-3** | Danh tính `monitor` gọi lệnh khác ngoài `ext check`: mã 2 |

## 7. Liên kết hai repo ở hai máy khác nhau, việc T-034

Giai đoạn 1b chỉ cho repo FE **đọc** trạng thái của repo BE trên **cùng máy**. Khác máy thì trạng thái của repo BE phải đi qua remote, tức là phải push nhánh `agents-state`. Việc này đụng luật **"không tự push"** (quyết định 10).

Ngoại lệ có kiểm soát (đã duyệt, quyết định 29 trong internal/DESIGN.md), **tắt mặc định**:
- Bạn bật `state_push: true` trong `project.md` của repo BE, và **gõ xác nhận một lần** (`ag state-push enable`, cần TTY). Lần bật được ghi vào sự kiện `state_push_enabled`.
- Khi bật, Monitor của repo BE tự push **duy nhất nhánh `agents-state`** lên remote sau mỗi thay đổi (gom 2 phút một lần). Nhánh này chỉ có trạng thái: việc, câu hỏi, lỗi, sự kiện, nhật ký. **Không có mã nguồn.**
- Hook `pre-push` cho phép đúng trường hợp này: nhánh `agents-state`, do Monitor push, kèm mã dùng một lần của Monitor. Mọi nhánh khác vẫn bị chặn như cũ.
- Repo FE khai liên kết bằng địa chỉ remote, ví dụ `links: [be=git@github.com:org/be.git]`. `ag` của repo FE `git fetch` nhánh `agents-state` của BE vào một thư mục đệm `.agents-local/links/be/`, **chỉ đọc**, mỗi lần `ag inbox`, `ag gate check`, hoặc mỗi `monitor_poll_seconds × 30` giây khi Monitor chạy.

**Lưu ý:** trạng thái có tiêu đề việc, câu hỏi, nhật ký. Nếu remote là công khai, mọi người đọc được. Khuyên dùng remote riêng tư.

| Tiêu chí | Nội dung |
|---|---|
| **A-XM-1** | `state_push` tắt: Monitor không push gì. `git push` nhánh `agents-state` bằng tay vẫn bị hook chặn như mọi nhánh khác |
| **A-XM-2** | `state_push` bật: sau một thay đổi trạng thái, remote (repo bare cục bộ trong test) có commit mới trên `agents-state` trong vòng 3 phút. Không nhánh nào khác bị push |
| **A-XM-3** | Agent gọi `git push origin agents-state` khi `state_push` đang bật: vẫn bị chặn, vì thiếu mã của Monitor |
| **A-XM-4** | Repo FE với `links` dạng địa chỉ remote: `be:T-020` `done` trên remote thì cổng phụ thuộc chuyển `waiting_owner` sau `ag gate check`. Repo FE không ghi gì lên remote của BE |
| **A-XM-5** | Remote không truy cập được: `ag gate check` báo lỗi mạng kèm tên liên kết, mã 4; dùng bản đệm gần nhất nếu có, và ghi rõ "dữ liệu cũ từ <giờ>" |

## 8. Tài liệu, việc T-035 (Master)

- `templates/WORKFLOW.md`: mục Monitor và thông báo; luật "không in biến từ `.env`" nhắc lại cho mọi vai.
- `internal/OWNER-GUIDE.md` và `internal/WORKFLOW-GUIDE.md`: hướng dẫn tạo bot, lấy chat ID, điền `.env`, `ag notify test`, chạy Monitor tự động khi mở máy trên Windows, macOS, Linux.
- `templates/project.md`: thêm các khoá `notify_*`, `monitor_*`, `live_check_times`, `state_push` kèm giải thích.

## 9. Kiểm chứng đầu-cuối, việc T-036 (Tester)

**A-E2E-2** Trên repo mẫu của T-013, với **máy chủ Telegram giả** (không gửi tin thật):
1. Chạy Monitor. Một Coder hỏi một câu Master không có nguồn: máy chủ giả nhận 1 tin trong vòng `notify_batch_seconds + 10` giây, có lệnh gợi ý `ag decide`.
2. Tắt phiên Coder đang giữ việc. Sau ngưỡng im lặng (rút ngắn còn 1 phút trong test): có đúng 1 cảnh báo.
3. Tắt Monitor 5 phút, trong lúc đó tạo 3 sự kiện "gửi ngay", rồi bật lại: 3 sự kiện đó có trong tin, không có tin trùng.
4. Đến giờ tóm tắt (đồng hồ giả): có 1 bản tóm tắt đúng nội dung.
5. Hai repo trên hai thư mục, liên kết qua một remote bare cục bộ với `state_push` bật: cổng của repo FE mở đúng khi việc của repo BE `done`.
6. **Thêm một lần thử thật** do chủ dự án làm: `ag notify test` với bot thật, nhận được tin trên điện thoại.

## 10. Thứ tự

| Đợt | Việc | Phụ thuộc chính |
|---|---|---|
| 11 | T-029 (Monitor) | Giai đoạn 1 và 1b xong |
| 12 | T-030 (STATUS.md, luật), T-031 (Telegram), T-033 (kiểm tra API theo lịch) | T-029 |
| 13 | T-032 (tóm tắt), T-034 (hai máy) | T-031 |
| bất kỳ | T-035 (tài liệu, Master) | — |
| 14 | T-036 (kiểm chứng) | Tất cả ở trên |

## 11. Các điểm đã duyệt (16/11/2026)

| # | Điểm | Đã duyệt |
|---|---|---|
| 1 | Mỗi repo một Monitor, dùng chung một bot, tin có tiền tố tên dự án | Có |
| 2 | `STATUS.md` nằm trong `.agents-state/`, không commit | Có |
| 3 | Các ngưỡng mặc định: im lặng 30 phút, bị chặn 4 giờ, nhắc câu hỏi sau 12 giờ, gom tin 2 phút, tóm tắt 08:00 và 17:00 | Có |
| 4 | Tin gồm mã, tiêu đề và lệnh gợi ý. Có tuỳ chọn `code-only` chỉ gửi mã | Có |
| 5 | Kiểm tra API ngoài theo lịch, mặc định tắt | Có |
| 6 | **Hai repo khác máy:** cho phép Monitor tự push **riêng nhánh `agents-state`** khi bạn bật `state_push` và gõ xác nhận một lần. Đây là ngoại lệ có kiểm soát của luật cấm push | Có (không chọn phương án tự push bằng tay) |
| 7 | Danh tính `monitor` chỉ được chạy `ext check` | Có |
| 8 | Giai đoạn 2 gồm 8 việc T-029 … T-036, Đợt 11 đến 14, bắt đầu sau khi Giai đoạn 1 và 1b xong | Có |

## 12. Lịch sử thay đổi

| Ngày | Thay đổi | Ai duyệt |
|---|---|---|
| 16/11/2026 | Bản đầu tiên, duyệt toàn bộ | Chủ dự án |
