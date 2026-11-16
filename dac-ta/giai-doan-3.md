# Đặc tả Giai đoạn 3: trang web văn phòng và Phòng họp với Master

**Trạng thái:** **Đã duyệt** ngày 16/11/2026 (chủ dự án duyệt toàn bộ 10 điểm ở mục 12). Viết bởi vai Master.
**Nguồn:**
- THIET-KE.md mục 5.6c và các quyết định 16, 23–26;
- đề xuất bổ sung 02 mục G (4 khu của giao diện), đề xuất bổ sung 03 (chat qua bộ nối, Master luồng, hành động của chủ dự án trên web);
- bản phác `monitor-pixel-office.html` (hướng giao diện chính).

**Nền:** mọi quy ước của `dac-ta/giai-doan-1.md` (mục 2, 3, 7) áp dụng nguyên cho file này, kể cả **không dùng thư viện ngoài**.
**Các việc:** T-037 … T-045 trong `dac-ta/viec-gd1/`, đã chuyển sang `approved`.

Chỗ ghi là điểm Master chưa có nguồn để quyết. Các điểm này gom ở mục 12.

---

## 1. Phạm vi

**Có:**
- máy chủ web chạy trong Monitor, chỉ mở trên máy (`localhost`) theo mặc định;
- đăng nhập;
- giao diện văn phòng pixel cùng các khu "Cần bạn", Bảng luồng, Chi tiết, Hoạt động;
- **hành động của chủ dự án trên web** (thay cho gõ lệnh trong terminal);
- **Phòng họp**: chat với Master chính và Master luồng qua bộ nối công cụ; hộp thư làm dự phòng.

**Không có:**
- tự mở phiên Coder và Tester (Giai đoạn 4);
- bộ nối cho công cụ khác ngoài Claude Code (để sau, giao diện bộ nối đã sẵn);
- nhiều người dùng: chỉ một chủ dự án đăng nhập.

## 2. Máy chủ web, việc T-037

- Máy chủ web chạy **trong cùng tiến trình Monitor**. `ag monitor start` mở luôn trang web. Không cần chạy thêm tiến trình nào.
- Viết bằng `http` của Node. Trang web là HTML, CSS, JS thuần, không có bước build, không framework.

Khoá trong `project.md`:

| Khoá | Mặc định | Ý nghĩa |
|---|---|---|
| `web_host` | `127.0.0.1` | Địa chỉ lắng nghe. Đổi sang địa chỉ khác thì `ag monitor start` in cảnh báo và đòi gõ xác nhận |
| `web_port` | `4300` | Cổng |
| `web_enabled` | `true` | `false` thì Monitor chỉ chạy phần Giai đoạn 2 |

**Dữ liệu cho trang** (chỉ trả JSON, chỉ sau khi đăng nhập):

| Đường dẫn | Trả về |
|---|---|
| `GET /api/state` | Ảnh chụp toàn bộ trạng thái: tính năng, việc, agent, câu hỏi, lỗi, cổng, phụ thuộc ngoài, danh sách "Cần bạn" |
| `GET /api/events?since=<vị trí>` | Các sự kiện mới từ một vị trí |
| `GET /api/stream` | Luồng cập nhật trực tiếp (Server-Sent Events): sự kiện mới, trạng thái đổi, tin chat |
| `GET /api/threads`, `GET /api/threads/:id` | Hội thoại (mục 7) |
| `POST /api/threads`, `POST /api/threads/:id/messages`, `POST /api/threads/:id/cancel` | Tạo hội thoại, gửi tin, dừng câu trả lời đang chạy |
| `POST /api/actions` | Hành động của chủ dự án (mục 4) |
| `POST /api/login`, `POST /api/logout` | Đăng nhập, đăng xuất |

| Tiêu chí | Nội dung |
|---|---|
| **A-WEB-1** | Mặc định chỉ lắng nghe `127.0.0.1`. Gọi từ địa chỉ khác của máy (IP mạng nội bộ) thì không kết nối được |
| **A-WEB-2** | Mọi `/api/*` trừ `login` trả 401 khi chưa đăng nhập |
| **A-WEB-3** | `/api/state` khớp với trạng thái mà `ag task list`, `ag feature list` in ra (test so sánh) |
| **A-WEB-4** | Một lệnh `ag` đổi trạng thái: trình duyệt đang mở `/api/stream` nhận cập nhật trong vòng `2 × monitor_poll_seconds` giây |
| **A-WEB-5** | Không trả về bất kỳ giá trị nào từ `.env` ở mọi đường dẫn (test cài chuỗi bí mật rồi quét mọi phản hồi) |
| **A-WEB-6** | Trang tĩnh trả đúng loại nội dung. Đường dẫn có `..` hay đường dẫn tuyệt đối bị từ chối (không đọc được file ngoài thư mục web) |

## 3. Đăng nhập, việc T-037

- **Đặt mật khẩu:** `ag web set-password` (cần TTY). Mật khẩu được băm bằng `scrypt` (có sẵn trong Node), lưu **ngoài repo**, ở thư mục cấu hình của người dùng:
  - Windows: `%APPDATA%\ag\web.json`;
  - macOS và Linux: `~/.config/ag/web.json`.
- **Phiên đăng nhập:** cookie `HttpOnly`, `SameSite=Strict`, hết hạn sau `web_session_hours` (mặc định 12).
- **Chống giả mạo yêu cầu:** mọi `POST` phải kèm mã chống giả mạo (CSRF) lấy lúc đăng nhập.
- **Chống dò mật khẩu:** sai 5 lần liên tiếp thì khoá đăng nhập 5 phút.

| Tiêu chí | Nội dung |
|---|---|
| **A-AUTH-1** | Chưa đặt mật khẩu: `ag monitor start` vẫn chạy phần Giai đoạn 2, trang web báo "chưa đặt mật khẩu, chạy `ag web set-password`" |
| **A-AUTH-2** | File mật khẩu không nằm trong repo. Nội dung là mã băm, không có mật khẩu gốc |
| **A-AUTH-3** | `POST` thiếu hoặc sai mã chống giả mạo: 403 |
| **A-AUTH-4** | Sai mật khẩu 5 lần: lần thứ 6 bị từ chối dù đúng mật khẩu, cho tới khi hết 5 phút |
| **A-AUTH-5** | `set-password` không có TTY: mã 2 |

## 4. Hành động của chủ dự án trên web, việc T-038

**Mã chủ dự án dùng một lần:**
- Lúc đặt mật khẩu, `ag` tạo thêm một **khoá bí mật** lưu cùng chỗ với file mật khẩu (ngoài repo).
- Khi bạn xác nhận một hành động trên web, Monitor tạo một mã ký bằng khoá đó. Mã chứa: hành động, mã đối tượng (ví dụ `F-005`), thời điểm.
- Monitor gọi `ag <lệnh> --owner-token <mã>`.
- `ag` chấp nhận lệnh của chủ dự án khi có TTY **hoặc** có mã hợp lệ: đúng chữ ký, đúng hành động, đúng đối tượng, chưa quá 60 giây, chưa dùng lần nào.

**Xác nhận trên web:** hộp thoại hiện rõ việc sắp làm. Bạn **gõ lại mã đối tượng** (ví dụ `F-005`) mới bấm được nút xác nhận.

**Các hành động có trên web:**

| Hành động | Lệnh `ag` tương ứng |
|---|---|
| Trả lời câu hỏi | `decide` |
| Cho bắt đầu làm, từ chối đặc tả | `feature start`, `feature reject` |
| Nghiệm thu (Đạt + push, Đạt chưa push, Chưa đạt) | `feature accept [--push]`, `feature reject --bug` |
| Đổi độ ưu tiên | `feature priority` |
| Xác nhận cổng | `gate pass`, `gate fail` |
| Đội ngoài đã giao, đã sửa | `ext delivered`, `ext fixed` |
| Duyệt, từ chối agent mới (kể cả Master luồng) | `approve-agent` |
| Chuyển việc | `reassign` |
| Push một nhánh | `push` |

| Tiêu chí | Nội dung |
|---|---|
| **A-OWN-1** | Lệnh chủ dự án không có TTY và không có mã: mã 2 (như Giai đoạn 1) |
| **A-OWN-2** | Mã đúng: lệnh chạy. Dùng lại đúng mã đó lần hai: mã 2 |
| **A-OWN-3** | Mã cho `feature accept F-005` mà dùng cho `F-006` hoặc cho `feature start F-005`: mã 2 |
| **A-OWN-4** | Mã quá 60 giây: mã 2 |
| **A-OWN-5** | Mã ký bằng khoá khác: mã 2 |
| **A-OWN-6** | `POST /api/actions` mà mã đối tượng gõ lại không khớp: 400, không gọi `ag` |
| **A-OWN-7** | Mỗi hành động trên web sinh sự kiện có ghi `via: web` |

## 5. Văn phòng pixel, việc T-039

Theo bản phác `monitor-pixel-office.html`. Nét vẽ bằng khối pixel trong mã, **không dùng tài sản đồ hoạ của bên thứ ba**.
- Khoá tuỳ chọn `ui_sprites_dir`: chủ dự án có giấy phép một bộ sprite thì trỏ tới đó để thay nét vẽ. Mặc định dùng nét vẽ có sẵn.

**Bố trí tự động theo dữ liệu thật:**

| Ai | Ở đâu |
|---|---|
| Master chính | Bàn lớn bên phải |
| Master luồng | Quanh bàn họp |
| Chủ dự án và người khác (`tool: human`) | Bàn chữ L góc trái |
| Coder, Tester đang làm hoặc có lỗi | Lưới bàn, mỗi agent một bàn cố định (giữ nguyên chỗ giữa các lần tải trang) |
| Agent đang chờ (việc bị chặn, review xong chờ bắt đầu) | Đứng ở cây nước |
| Agent `pending` | Đứng ở cửa (cửa mở) |
| Agent ngoại tuyến | Bàn trống, màn hình tắt |
| Agent `retired` | Không hiện |

- Tối đa 16 agent một phòng. Nhiều hơn thì có nút chuyển "Phòng 2".
- Màu áo bằng màu của tính năng agent đang làm. Màu của mỗi tính năng cố định theo thứ tự tạo.
- **Bong bóng:** mã việc = đang làm · `…` = chờ · `!` = lỗi · `?` = cần duyệt · `z z` = ngoại tuyến.
- **Bảng trắng trên tường:** bảng luồng thu nhỏ. Bấm vào để bỏ lọc.
- **Bấm nhân vật:** khu Chi tiết hiện vai, công cụ, việc đang giữ, kế hoạch các bước, nhật ký gần nhất, nút "Mở hội thoại" (với Master).

## 6. Các khu còn lại, việc T-040

| Khu | Nội dung |
|---|---|
| **Thanh trên** | Số luồng đang chạy, số agent đang hoạt động, số việc chờ bạn, giờ, trạng thái kết nối luồng cập nhật |
| **Cần bạn** | Mọi việc chờ bạn, nhóm theo tính năng, mỗi mục có nút hành động (mục 4) |
| **Bảng luồng** | Mỗi tính năng một hàng, các cột là các bước của vòng đời, kèm tiến độ và "đang chờ gì". Bấm một hàng để lọc cả trang theo tính năng đó |
| **Chi tiết** | Tính năng: các việc, câu hỏi, lỗi, phụ thuộc, nút mở hội thoại. Agent: như mục 5 |
| **Hoạt động** | Dòng sự kiện gần đây, lọc được theo tính năng hoặc agent |
| **Báo cáo nghiệm thu** | Hiện đầy đủ báo cáo của `ag feature report`, kèm nút nghiệm thu |

- Giao diện sáng và tối theo cài đặt máy. Dùng được trên điện thoại (không cuộn ngang).
- Mất kết nối luồng cập nhật: hiện "Đang kết nối lại…" và tự kết nối lại. Không mất dữ liệu.

## 7. Phòng họp: hội thoại và bộ nối, việc T-041 và T-042

### 7.1 Hội thoại `C-NNN`

File `.agents-state/threads/C-NNN.md`:
```
id, feature (F-NNN hoặc trống = "Chung"), agent (master | master-F-NNN), status (idle | running | queued | error), created_at
```
- Phần thân là các tin theo thứ tự. Mỗi tin có: người gửi, giờ, nội dung.
- Lúc `ag init`, tạo sẵn hội thoại `C-001` "Chung", gắn với Master chính.
- Mã phiên của công cụ AI lưu ở `.agents-local/threads/C-NNN.json`, **không đưa lên git**.

### 7.2 Gửi một tin

1. Trang gửi tin. Máy chủ ghi tin vào file hội thoại.
2. Hội thoại đang `running` thì tin xếp hàng (`queued`). Mỗi hội thoại chỉ một câu trả lời chạy tại một thời điểm.
3. Bộ nối chạy công cụ AI trong đúng thư mục:
   - Master chính: repo chính;
   - Master luồng: worktree của nhánh tính năng.
4. Câu trả lời trả về từng phần, máy chủ đẩy lên trang qua `/api/stream`. Xong thì ghi câu trả lời đầy đủ vào file.
5. Lệnh `ag` mà Master chạy trong lúc trả lời sinh sự kiện. Sự kiện nào cần bạn (câu hỏi, chờ bắt đầu, chờ nghiệm thu…) hiện thành **thẻ có nút** ngay trong hội thoại của tính năng đó, đồng thời ở khu "Cần bạn".

**Giới hạn**:

| Khoá | Mặc định | Ý nghĩa |
|---|---|---|
| `chat_max_parallel` | `3` | Số câu trả lời chạy đồng thời trên mọi hội thoại. Quá thì xếp hàng |
| `chat_timeout_minutes` | `15` | Một câu trả lời chạy quá lâu thì dừng, hội thoại về `error`, hiện thẻ "Master không trả lời kịp" kèm nút gửi lại |

Nút **Dừng** dừng câu trả lời đang chạy. Phần đã trả về được giữ lại, có ghi "(đã dừng)".

### 7.3 Bộ nối

`project.md`:
```
master_adapter: claude-code      # hoặc mailbox
master_adapter_args: []          # cờ thêm, ví dụ giới hạn công cụ được dùng
```

Giao diện chung của mọi bộ nối:
- `start(thư mục, lời nhắn mở đầu)` → mã phiên;
- `send(mã phiên, tin)` → các phần câu trả lời;
- `stop(mã phiên)`.

**Bộ nối `claude-code`:**
- Chạy Claude Code ở chế độ không tương tác, đầu ra dạng luồng, nối tiếp phiên theo mã phiên. Cờ dòng lệnh cụ thể nằm trong mã của bộ nối và ghi rõ trong tài liệu.
- **Lời nhắn mở đầu chuẩn:**
  ```text
  Đọc AGENTS.md và làm theo. ID của bạn: <master hoặc master-F-NNN>.
  Đây là hội thoại <C-NNN> trên trang web của chủ dự án. Đọc toàn bộ file .agents-state/threads/<C-NNN>.md
  và mục "Ghi chú của Master" của tính năng (nếu có), rồi trả lời tin mới nhất.
  Đầu mỗi lượt, chạy ag inbox. Không tự quyết; câu nào cần chủ dự án thì dùng ag escalate.
  ```
- **Phiên bị mất** (công cụ báo không tìm thấy phiên): mở phiên mới với lời nhắn mở đầu, rồi gửi lại tin mới nhất. Ghi dòng hệ thống "Đã mở phiên mới, Master đã đọc lại hội thoại".

**Bộ nối `mailbox`:** không chạy công cụ nào. Tin nằm chờ trong file hội thoại. Master trả lời bằng `ag reply C-NNN "…"` khi có phiên Master đang mở. `ag inbox` của Master liệt kê hội thoại có tin chưa trả lời.

**Bộ nối giả, chỉ dùng cho test:** một script trả lời theo kịch bản, có thể giả chậm, giả lỗi, giả mất phiên. Mọi test tự động dùng bộ nối này, **không gọi công cụ AI thật**.

### 7.4 Tạo tính năng mới từ web

Giữ đúng vai: **tạo tính năng là việc của Master**.
1. Bạn bấm "+ Tính năng mới", nhập tên và độ ưu tiên.
2. Máy chủ tạo hội thoại mới gắn với **Master chính**. Tin đầu tiên là: *"Chủ dự án muốn tạo tính năng mới: <tên>, ưu tiên <P>."*
3. Master chính chạy `ag feature new`. Nếu nên có Master luồng thì Master chính đề nghị, và thẻ "Duyệt Master luồng" hiện ra.
4. Bạn duyệt thì hội thoại **chuyển sang Master luồng**. Có dòng hệ thống ghi lại lúc chuyển. Master luồng đọc lại toàn bộ hội thoại, bàn tiếp với bạn.

| Tiêu chí | Nội dung |
|---|---|
| **A-CHAT-1** | Gửi tin: file hội thoại có tin; bộ nối giả được gọi đúng thư mục (repo chính cho `master`, worktree tính năng cho `master-F-NNN`) |
| **A-CHAT-2** | Câu trả lời 5 phần từ bộ nối giả: trang nhận đủ 5 phần theo thứ tự qua `/api/stream`. File hội thoại có câu trả lời đầy đủ |
| **A-CHAT-3** | Gửi 2 tin liên tiếp vào cùng hội thoại: tin thứ hai chờ tin thứ nhất trả lời xong mới chạy |
| **A-CHAT-4** | 5 hội thoại cùng gửi tin khi `chat_max_parallel: 3`: không bao giờ quá 3 lần chạy đồng thời |
| **A-CHAT-5** | Bộ nối giả chạy quá `chat_timeout_minutes` (rút ngắn trong test): bị dừng, hội thoại `error`, có thẻ "không trả lời kịp" |
| **A-CHAT-6** | Bộ nối giả báo mất phiên: phiên mới được mở bằng lời nhắn mở đầu, tin được gửi lại, có dòng hệ thống |
| **A-CHAT-7** | Nút Dừng: lần chạy bị dừng, phần đã trả về được giữ, có ghi "(đã dừng)" |
| **A-CHAT-8** | Master (bộ nối giả) chạy `ag escalate` trong lúc trả lời: thẻ câu hỏi hiện trong hội thoại của tính năng đó và ở khu "Cần bạn" |
| **A-CHAT-9** | Luồng tạo tính năng mới (mục 7.4) chạy đủ 4 bước với bộ nối giả |
| **A-MBX-1** | `master_adapter: mailbox`: gửi tin không chạy công cụ nào. `ag reply` của Master làm tin trả lời hiện trên trang |
| **A-ADP-1** | (chạy tay, chủ dự án) Bộ nối `claude-code` với Claude Code thật: một hội thoại 3 lượt, trả lời hiện dần, tắt Monitor rồi bật lại vẫn nối tiếp được |

## 8. Truy cập từ xa (tài liệu, không phải tính năng)

Mặc định chỉ dùng trên máy. Muốn xem từ điện thoại khi ra ngoài:
- dùng **Tailscale** (mạng riêng giữa các thiết bị của bạn), hoặc **Cloudflare Tunnel** có bật xác thực;
- **không** mở cổng thẳng ra Internet;
- vẫn phải đăng nhập trang web như bình thường.

Việc T-044 viết hướng dẫn này.

## 9. Tài liệu, việc T-044 (Master)

- `BAT-DAU.md`, `HUONG-DAN-WORKFLOW.md`: đặt mật khẩu, mở trang, dùng Phòng họp, truy cập từ xa.
- `templates/roles/master.md`: luật khi trả lời qua Phòng họp:
  - đầu mỗi lượt chạy `ag inbox`;
  - giữ câu trả lời ngắn, việc dài thì ghi vào file rồi báo;
  - không dán nội dung `.env`.
- `templates/project.md`: các khoá `web_*`, `master_adapter*`, `chat_*`, `ui_sprites_dir`.

## 10. Kiểm chứng đầu-cuối, việc T-045 (Tester)

**A-E2E-3a, tự động, với bộ nối giả:** tạo tính năng mới từ web → Master luồng được duyệt qua thẻ → review → "Bắt đầu làm" qua thẻ → việc chạy → nghiệm thu "Đạt, chưa push" qua thẻ. Toàn bộ không gõ lệnh chủ dự án nào trong terminal.

**A-E2E-3b, chạy tay theo danh sách kiểm, có ảnh chụp màn hình**, trên trình duyệt thật, máy tính và điện thoại:
1. đăng nhập, sai mật khẩu 5 lần;
2. văn phòng hiện đúng vị trí theo trạng thái (đang làm, chờ, lỗi, xin vào, ngoại tuyến);
3. lọc theo tính năng;
4. mọi nút trong "Cần bạn" mở đúng hộp xác nhận, gõ sai mã thì không chạy;
5. giao diện tối;
6. mất mạng rồi có lại thì tự kết nối lại.

Giao diện được kiểm bằng **danh sách kiểm tay có ảnh chụp**, không dùng thư viện điều khiển trình duyệt, để giữ luật không thư viện ngoài. Phần dữ liệu và chat được kiểm tự động qua các đường dẫn `/api/*`.

**A-E2E-3c, chủ dự án tự thử:** A-ADP-1 với Claude Code thật.

## 11. Thứ tự

| Đợt | Việc | Phụ thuộc chính |
|---|---|---|
| 15 | T-037 (máy chủ web, đăng nhập) | Giai đoạn 2 xong (T-029, T-030) |
| 16 | T-038 (mã chủ dự án), T-039 (văn phòng pixel), T-041 (hội thoại, hộp thư) | T-037 |
| 17 | T-040 (các khu, nút hành động), T-042 (bộ nối Claude Code) | T-038, T-039, T-041 |
| 18 | T-043 (Phòng họp trên giao diện) | T-040, T-042 |
| bất kỳ | T-044 (tài liệu, Master) | — |
| 19 | T-045 (kiểm chứng) | Tất cả |

## 12. Các điểm đã duyệt (16/11/2026)

| # | Điểm | Đã duyệt |
|---|---|---|
| 1 | Máy chủ web chạy trong Monitor, mặc định `127.0.0.1:4300` | Có |
| 2 | Đăng nhập bằng mật khẩu đặt qua `ag web set-password`, lưu dạng băm **ngoài repo**. Hành động quan trọng phải gõ lại mã đối tượng | Có |
| 3 | Lệnh chủ dự án chấp nhận thêm **mã dùng một lần** do Monitor ký (60 giây, đúng hành động, đúng đối tượng), ngoài TTY | Có |
| 4 | Giao diện HTML/JS thuần, không build, không thư viện. Nét pixel tự vẽ, có tuỳ chọn thay bằng sprite có giấy phép | Có |
| 5 | Bộ nối đầu tiên là **Claude Code**, cộng **hộp thư** cho công cụ khác. Bộ nối Codex, Gemini để sau | Có |
| 6 | Tạo tính năng mới từ web đi qua Master chính; chuyển sang Master luồng sau khi bạn duyệt | Có |
| 7 | Giới hạn chat: 1 câu trả lời mỗi hội thoại, tối đa 3 chạy đồng thời, quá 15 phút thì dừng, có nút Dừng | Có |
| 8 | Tối đa 16 agent mỗi phòng, nhiều hơn thì sang "Phòng 2" | Có |
| 9 | Giao diện kiểm bằng danh sách kiểm tay có ảnh chụp, phần dữ liệu và chat kiểm tự động | Có |
| 10 | Giai đoạn 3 gồm 9 việc T-037 … T-045, Đợt 15 đến 19, bắt đầu sau Giai đoạn 2 | Có |

## 13. Lịch sử thay đổi

| Ngày | Thay đổi | Ai duyệt |
|---|---|---|
| 16/11/2026 | Bản đầu tiên, duyệt toàn bộ | Chủ dự án |
