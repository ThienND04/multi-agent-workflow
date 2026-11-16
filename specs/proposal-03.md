# Đề xuất bổ sung 03: trò chuyện với Master trên web, nhiều phiên theo tính năng

**Trạng thái:** **Đã duyệt toàn bộ 7 điểm** ngày 16/11/2026. Đã đưa vào: `specs/phase-1b.md` mục 8a (việc T-028), internal/DESIGN.md quyết định 22–26, lộ trình Giai đoạn 3 và 4.

**Câu hỏi của chủ dự án:** trên trang monitor, làm sao chat với Master để bàn giao việc? Giống ứng dụng Claude đang dùng: mở **nhiều phiên** nói chuyện với Master, mỗi phiên một chủ đề, rồi từ đó triển khai theo luồng.

Các điểm cần duyệt gom ở **mục 7**.

---

## 1. Thiết kế hiện tại thiếu gì

| Đã có | Thiếu |
|---|---|
| Hộp thư Master trên web (quyết định 16): bạn để lại tin, Master đọc khi chạy `ag inbox` | **Không tức thì.** Phải có phiên Master đang chạy và tự kiểm tra hộp thư |
| Mọi thứ gắn mã tính năng, inbox của Master nhóm theo tính năng | **Chỉ một phiên Master** (quyết định 22). Muốn bàn tính năng B thì phải chen vào cùng phiên đang lo tính năng A |
| Thẻ "Cần bạn" có nút hành động | Nút trên web chưa có cách xác nhận thay cho việc gõ trong terminal (TTY) |

## 2. Ba cách làm

| | A. Hộp thư (đã có) | B. Chat trực tiếp qua bộ nối công cụ | C. Dùng giao diện của chính công cụ AI |
|---|---|---|---|
| Cách chạy | Web ghi tin vào file, Master đọc khi có phiên | Monitor **tự chạy công cụ AI** (chế độ không tương tác, nối tiếp phiên), đẩy câu trả lời lên web theo thời gian thực | Bạn mở nhiều phiên trong ứng dụng của công cụ (như Claude Code đang dùng), web chỉ để theo dõi |
| Tức thì | Không | **Có** | Có |
| Nhiều phiên song song | Không | **Có**, mỗi hội thoại một phiên | Có |
| Phụ thuộc công cụ | Không | Cần một **bộ nối** cho mỗi công cụ. Công cụ nào không có chế độ không tương tác thì quay về A | Hoàn toàn |
| Mọi thứ ở một chỗ | Có | **Có** | Không: chat một nơi, theo dõi một nơi |
| Công sức xây | Nhỏ | Vừa | Không có |

**Master đề xuất: B là cách chính, A làm dự phòng.** C dùng được ngay hôm nay, không cần xây gì (mục 6).

## 3. Thiết kế

### 3.1 Master chính và Master luồng

Quyết định 22 ("một phiên Master chung, Master luồng để sau") được thay bằng:

| | **Master chính** (1 phiên) | **Master luồng** (mỗi tính năng tối đa 1 phiên) |
|---|---|---|
| Phạm vi | Toàn dự án | Đúng một tính năng `F-NNN` |
| Làm việc ở | Worktree chính, nhánh `main` | Worktree riêng của nhánh `feature/F-NNN` |
| Viết đặc tả | Đặc tả chung, `project.md` | Chỉ đặc tả của tính năng mình (`specs/F-NNN-*.md`, nằm trên nhánh tính năng cho tới khi gộp) |
| Chia việc, trả lời câu hỏi | Việc và câu hỏi không thuộc tính năng nào | Việc và câu hỏi của tính năng mình |
| Gộp | Gộp tính năng vào `main` (`ag feature merge`) | Gộp việc vào nhánh tính năng (`ag merge`) |
| Độ ưu tiên, phân xử giữa các luồng | Có | Không. Đụng tới luồng khác thì hỏi Master chính |

- ID: `master` (chính) và `master-F-005` (luồng).
- `ag` kiểm tra phạm vi: Master luồng gọi lệnh trên tính năng khác thì trả mã 2.
- Câu hỏi Master luồng không có nguồn để trả lời thì đi thẳng lên bạn (`escalate`), không cần qua Master chính.
- Hai luồng sửa chung vùng code: `ag feature new` đã cảnh báo và hỏi bạn từ trước (A-FEAT-7).

### 3.2 Hội thoại (thread)

- Mỗi hội thoại là một file `.agents-state/threads/C-NNN.md`:
  - `feature` (hoặc `chung`), `agent` (`master` hoặc `master-F-NNN`), `status`;
  - phần thân là **toàn bộ tin nhắn** theo thứ tự, có giờ.
- **Lịch sử nằm trong file, không nằm trong phiên AI.** Phiên công cụ bị mất (hết token, khởi động lại) thì bộ nối mở phiên mới. Phiên mới đọc file hội thoại và mục "Ghi chú của Master" của tính năng, rồi trả lời tiếp. Nguyên tắc 1 vẫn giữ nguyên.
- Hội thoại "Chung" thuộc về Master chính.
- Nút **"+ Tính năng mới"** tạo `F-NNN` (trạng thái `analyzing`), nhánh tính năng, worktree, và một hội thoại mới gắn với Master luồng của tính năng đó.

### 3.3 Bộ nối công cụ (adapter)

Khai trong `project.md`:
```
master_adapter: claude-code     # hoặc codex, gemini-cli, mailbox
```

Mỗi bộ nối làm đúng 3 việc:
1. **Bắt đầu phiên** trong một thư mục, với lời nhắn mở đầu chuẩn: "Đọc AGENTS.md, bạn là `master-F-005`, đọc hội thoại C-012…".
2. **Gửi tiếp một tin** vào phiên đang có (nối tiếp phiên).
3. **Trả câu trả lời từng phần** để web hiện dần, như app chat.

- Công cụ nào chỉ có giao diện tương tác, không có chế độ chạy không tương tác thì dùng `mailbox`, tức cách A.
- Bộ nối truyền cho công cụ các giới hạn quyền của vai Master (không sửa mã nguồn) theo cách riêng của từng công cụ. Hook của `ag` vẫn là hàng rào chung.

### 3.4 Từ chat ra luồng triển khai

```
Bạn: "+ Tính năng mới: Đăng nhập Google"
  → F-005 analyzing, mở hội thoại với master-F-005
Bạn và Master luồng trao đổi trong hội thoại   → Master viết đặc tả, chia việc
Master: "Đặc tả xong, mở review"               → ag feature review F-005 → các agent nhận việc review
   … câu hỏi Master không quyết được hiện thành THẺ trong hội thoại, có nút trả lời
Review xong                                    → THẺ "Bắt đầu làm" trong hội thoại   → bạn bấm
Code, test, sửa lỗi                            → tiến độ hiện trong hội thoại và trên văn phòng
Xong                                           → THẺ "Nghiệm thu" kèm báo cáo   → Đạt + push / Đạt, chưa push / Chưa đạt
```

Mọi việc cần bạn của tính năng đó hiện **ngay trong hội thoại** của nó, đồng thời hiện ở khu "Cần bạn".

### 3.5 Bấm nút trên web thay cho gõ trong terminal

Hiện nay, lệnh của chủ dự án (`decide`, `feature start`, `feature accept`…) bắt buộc gõ xác nhận trong terminal tương tác. Trên web, cách xác nhận tương đương là:
1. Bạn **đăng nhập** trang monitor bằng mật khẩu riêng. Mật khẩu này đặt khi cài Monitor, lưu dạng băm ở thư mục cấu hình của người dùng, **ngoài repo**.
2. Hành động quan trọng (bắt đầu làm, nghiệm thu, push, duyệt agent) phải **gõ lại mã** (ví dụ `F-005`) trong hộp xác nhận.
3. Monitor gọi `ag` kèm một **mã dùng một lần** do chính Monitor cấp. `ag` chỉ nhận lệnh chủ dự án khi có TTY, hoặc có mã hợp lệ còn hạn.

Giới hạn vẫn như cũ: trên cùng một máy, cách này chặn nhầm lẫn, không chặn được agent cố tình giả mạo.

### 3.6 Để sau: tự mở phiên Coder và Tester

Cùng bộ nối đó, Monitor có thể **tự mở phiên Coder** khi có việc `approved` mà chưa ai nhận. Bạn sẽ không phải tự mở từng phiên nữa. Phần này kéo theo nhiều thứ phải quyết: số phiên tối đa, công cụ nào cho phép, giới hạn chi phí, giờ được chạy. Đề xuất để **Giai đoạn 4**, khi bộ nối đã chạy ổn với Master.

### 3.7 An toàn

- Từ nay trang web **chạy được công cụ AI trên máy bạn**. Vì vậy bắt buộc đăng nhập, mặc định chỉ mở ở `localhost`. Xem từ xa thì qua Tailscale hoặc Cloudflare Tunnel, có đăng nhập.
- Mọi tin nhắn và mọi lệnh bộ nối chạy đều được ghi vào hội thoại và vào `events.jsonl`.
- Nội dung chat không gửi qua Telegram. Telegram chỉ báo "có tin mới trong hội thoại C-012".

## 4. Giao diện: khu "Phòng họp"

Bản phác: `internal/mockups/monitor-pixel-office.html`, khu **Phòng họp với Master** (ngay dưới cảnh văn phòng).

| Phần | Nội dung |
|---|---|
| Cột trái | Danh sách hội thoại: **Chung**, mỗi tính năng một mục (màu của tính năng, chấm đỏ nếu có việc chờ bạn, chấm xanh nhấp nháy nếu Master đang trả lời), nút **+ Tính năng mới** |
| Giữa | Các tin nhắn. Câu trả lời hiện dần. **Thẻ hành động** nằm ngay trong luồng tin: câu hỏi, "Bắt đầu làm", "Nghiệm thu" |
| Dưới | Ô nhập tin, kèm trạng thái phiên: "master-F-005 · Claude Code · đang hoạt động" |
| Trong văn phòng | Mỗi Master luồng là một nhân vật ngồi quanh **bàn họp**, mặc áo màu tính năng của mình |

## 5. Ảnh hưởng tới kế hoạch

| Phần | Thay đổi |
|---|---|
| Giai đoạn 1b | Thêm **T-028**: Master luồng. ID `master-F-NNN`, `ag approve-agent … --role master --feature F`, kiểm tra phạm vi trong mọi lệnh của Master, worktree của tính năng. Phụ thuộc T-021, T-026. Chạy ở Đợt 9, trước T-013. Kịch bản A-E2E-1b thêm 1 Master luồng |
| Giai đoạn 3 | Hội thoại `C-NNN`, bộ nối `claude-code` (bộ nối đầu tiên) và `mailbox`, phòng họp trên web, đăng nhập và mã dùng một lần cho hành động của chủ dự án |
| Giai đoạn 4 | Tự mở phiên Coder và Tester (tuỳ chọn) |
| Quyết định 22 | Thay bằng mục 3.1 |

## 6. Dùng ngay hôm nay (cách C)

Ứng dụng Claude bạn đang dùng đã cho mở nhiều phiên. Trước khi có Giai đoạn 1b và 3, cách an toàn là:
- **Chỉ một phiên làm Master thật**, tức phiên được ghi file và gộp nhánh.
- Các phiên khác dùng để **bàn ý tưởng** cho tính năng tương lai. Khi chốt, dán kết luận sang phiên Master để ghi vào tài liệu.

Lý do: khi chưa có `ag` kiểm tra phạm vi, hai phiên cùng làm Master trên một thư mục dễ ghi đè lên nhau.

## 7. Các điểm đã duyệt (16/11/2026)

| # | Điểm | Đã duyệt |
|---|---|---|
| 1 | Chat trực tiếp qua bộ nối công cụ là cách chính, hộp thư làm dự phòng | Có (mục 2) |
| 2 | **Master chính + Master luồng** (mỗi tính năng một phiên), thay quyết định 22 | Có (mục 3.1) |
| 3 | Lịch sử hội thoại lưu trong file, phiên AI mất thì phiên mới đọc lại và trả lời tiếp | Có (mục 3.2) |
| 4 | Hành động của chủ dự án trên web: đăng nhập, gõ lại mã, mã dùng một lần | Có (mục 3.5) |
| 5 | Thêm T-028 (Master luồng) vào Giai đoạn 1b | Có (mục 5) |
| 6 | Tự mở phiên Coder và Tester để ở Giai đoạn 4 | Có (mục 3.6) |
| 7 | Khu "Phòng họp" trên giao diện | Có (mục 4) |
