# Workflow multi-agent: thiết kế và các quyết định

Tài liệu thiết kế đầy đủ: mục tiêu, nguyên tắc, vai trò, thiết kế kỹ thuật, lộ trình và **mọi quyết định đã chốt (mục 9)**. Tài liệu tự đủ: người đọc (hoặc AI) không cần xem lại cuộc trò chuyện cũ.

> **Mới clone repo về?** Đọc [README.md](../README.md) trước.

**Trạng thái:** thiết kế tổng thể đã chốt (mục 9). Đặc tả Giai đoạn 1 **đã duyệt** (`specs/phase-1.md`), 19 việc ở `specs/tasks/` đã sẵn sàng giao. Đề xuất bổ sung 01, 02 và 03 đã duyệt. Giai đoạn 1b (tính năng, chuyên môn FE/BE, hợp đồng API, phụ thuộc bên ngoài, chạy nhiều luồng, Master luồng) có đặc tả riêng `specs/phase-1b.md`, thêm 9 việc T-020…T-028 (tổng 28 việc). Đặc tả Giai đoạn 2 và 3 cũng đã duyệt (`specs/phase-2.md`, `specs/phase-3.md`), tổng cộng 45 việc. Chưa có mã nguồn.

**File kèm theo:**
- `internal/mockups/monitor-pixel-office.html`: **bản phác chọn làm hướng chính cho Giai đoạn 3**. Văn phòng pixel-art (nét vẽ tự làm), gộp đủ: nhân vật mặc áo màu tính năng, bong bóng trạng thái, bảng luồng trên tường, agent chờ đứng ở cây nước, agent mới xin vào đứng ở cửa, khu "Cần bạn", bảng luồng, chi tiết và trao đổi với Master theo tính năng.
- `internal/trial-project/`: các file thật từ dự án thử nghiệm đầu tiên, để tham khảo cách làm cũ.

---

## 1. Mục tiêu

Dựng một quy trình để nhiều AI agent cùng xây phần mềm, với chủ dự án (con người) giữ quyền quyết định. Yêu cầu:

1. Agent nào vào làm cũng **xác nhận vai trò và quyền hạn**.
2. Mọi việc đã làm được **lưu lại**, để khi một agent gặp sự cố, agent khác **làm tiếp được**.
3. Mỗi vai có **rule và skill** riêng.
4. **Dùng lại** được cho dự án khác.
5. **Thông báo qua Telegram** khi cần chủ dự án xác nhận, vì chủ dự án không phải lúc nào cũng ngồi theo dõi.
6. **Trang web monitor giao diện 2D**: mỗi agent là một nhân vật, bấm vào để biết agent đó đang làm gì.
7. **Không phụ thuộc công cụ AI:** bất kỳ AI nào (Claude, Codex, Gemini, Cursor, Copilot…) cũng tham gia được, không cần chọn trước.
8. **Agent không tự quyết bằng phán đoán:** mọi vấn đề chưa có câu trả lời trong tài liệu đều hỏi cấp trên.

## 2. Bài học từ dự án thử nghiệm "Lịch mua bán"

Dự án app Android thống kê cổ phiếu (13–16/11/2026) đã chạy một bản thô của workflow này:
- Claude làm Master/Điều phối, một AI khác làm Coder, chủ dự án duyệt.
- Trao đổi qua file: `AGENTS.md`, `hoi-dap/`, `loi/`, `yeu-cau/`, `TIEN-DO.md`.
- Xem các file mẫu trong `internal/trial-project/`.

| Chạy tốt | Hỏng hoặc thiếu |
|---|---|
| Trao đổi qua file, dòng đầu file ghi trạng thái (`Cần làm`, `Đã xong`…) | Tiến trình theo dõi file **mất khi phiên AI khởi động lại**. Trạng thái nằm trong "trí nhớ" agent chứ không nằm trong file |
| Bảng "ai được sửa file nào" | Coder báo "21/21 test đạt" nhưng **app không mở được** (lỗi thiếu constructor ViewModel). Thiếu Tester độc lập chạy trên máy thật |
| Test chấp nhận dựa trên mã tham chiếu và dữ liệu mẫu cố định, nên số liệu không lệch | Nhật ký tự do. `TIEN-DO.md` có hai mục "Bàn giao" ghi số test khác nhau |
| Nguyên tắc "không rõ thì hỏi chủ dự án, không tự quyết" | Không dùng git: không có lịch sử, không quay lại bản cũ được, dễ ghi đè lên nhau |
| Master tự kiểm tra lại kết quả của Coder (chạy lại test, xem file APK) trước khi báo chủ dự án | Chủ dự án phải tự nhắn cho AI kia mỗi khi có việc mới |
| Yêu cầu mới đi theo luồng: nháp → chủ dự án duyệt → giao | |
| `AGENTS.md` viết cho mọi AI, không riêng công cụ nào | |

## 3. Nguyên tắc cốt lõi

1. **Mọi trạng thái nằm trong file và git, không nằm trong đầu agent.** Agent có thể dừng bất kỳ lúc nào. Agent mới chỉ cần đọc file là làm tiếp được.
2. **Ghi trạng thái qua công cụ, không ghi tay.** Agent dùng lệnh `ag` (mục 5.4), để dữ liệu luôn đúng định dạng.
3. **Người làm không tự nghiệm thu.** Coder không tự đánh dấu "xong". Tester và Master kiểm tra độc lập.
4. **Không tự quyết, hỏi theo cấp.** Mọi lựa chọn phải dẫn được nguồn (đặc tả, việc, quyết định `D-NNN`, `project.md`). Không có nguồn thì hỏi cấp trên (mục 4.1).
5. **Rule bằng chữ phải đi kèm hàng rào bằng công cụ** khi có thể. Hàng rào phải **không phụ thuộc công cụ AI**: lệnh `ag`, git worktree, git hook (mục 5.5).
6. **Chỉ yêu cầu những gì AI nào cũng làm được:** đọc/ghi file và chạy lệnh shell.

## 4. Vai trò

| Vai | Là ai | Phải làm | Không được |
|---|---|---|---|
| **Chủ dự án** | Con người | Duyệt đặc tả, duyệt thay đổi phạm vi, trả lời câu hỏi được chuyển lên, nghiệm thu cuối, duyệt agent mới | — |
| **Master** | AI bất kỳ (chỉ 1) | Cùng chủ dự án phân tích yêu cầu. Viết đặc tả kèm **tiêu chí chấp nhận chạy được**. Chia việc nhỏ, mỗi việc có điều kiện xong và **phạm vi file**. Trả lời câu hỏi của Coder/Tester khi đã có nguồn. Kiểm tra lại kết quả. Gộp nhánh | Sửa code. Tự quyết thay chủ dự án. Trả lời câu hỏi khi không có nguồn |
| **Coder** | AI bất kỳ (nhiều, song song) | Đọc việc được giao, hỏi khi chưa rõ, viết code và test đơn vị, viết test chống tái phát cho mỗi lỗi, tự build và chạy test trước khi giao | Sửa đặc tả, test chấp nhận, dữ liệu mẫu. Sửa file ngoài phạm vi việc. Tự thêm tính năng. Tự nghiệm thu |
| **Tester** | AI bất kỳ | Viết ca kiểm thử từ đặc tả, nên viết **trước khi có code**. Chạy test đầu-cuối và trên máy thật. Báo lỗi kèm cách tái hiện và bằng chứng | Sửa code trong `src/` |
| **Monitor** | **Chương trình, không phải AI** | Đọc trạng thái, gửi thông báo Telegram, phục vụ trang web 2D, phát hiện việc bị treo | Ghi gì ngoài báo cáo của chính nó |

### 4.1 Chuỗi hỏi: không agent nào tự quyết

```
Coder / Tester  ──hỏi──▶  Master  ──không có nguồn──▶  Chủ dự án
                          │
                          └─ có nguồn ─▶ trả lời, ghi rõ nguồn (ví dụ "theo D-003")
```

1. Coder và Tester **chỉ hỏi Master** (`ag ask --to master`). Không hỏi thẳng chủ dự án, không hỏi nhau.
2. Master chỉ được trả lời khi **dẫn được nguồn** đã có: mục đặc tả, quyết định `D-NNN` cũ, `project.md`. Câu trả lời ghi `answered_by: master` và `source: …`.
3. Không có nguồn, Master **chuyển lên** chủ dự án (`ag escalate D-NNN`), kèm các phương án và ảnh hưởng của từng phương án. Master không chọn hộ, chỉ được ghi "Master đề xuất: …".
4. Chủ dự án trả lời. Câu trả lời trở thành **tiền lệ**: lần sau gặp câu tương tự, Master dẫn lại `D-NNN` mà không cần hỏi lại. Nhờ vậy số câu hỏi giảm dần theo thời gian.
5. Trong lúc chờ: việc chuyển sang `blocked` (ghi `blocked_by: D-NNN`). Agent nhả việc hoặc nhận việc khác không phụ thuộc. **Không làm tiếp theo phỏng đoán.**
6. Agent phát hiện tài liệu mâu thuẫn nhau cũng phải hỏi, không tự chọn bản nào đúng.

Ranh giới đã chốt: chi tiết bên trong việc, không đổi hành vi hay giao diện và theo đúng quy ước `project.md`, thì không cần hỏi. Hành vi, giao diện người dùng, định dạng dữ liệu, API, thêm thư viện, đổi cấu trúc thư mục thì bắt buộc hỏi (mục 9).

## 5. Thiết kế kỹ thuật

### 5.1 Cấu trúc thư mục (trong repo git của mỗi dự án)

Có hai phần tách nhau, vì Coder chạy song song trên nhiều worktree:
- **Quy trình và rule** nằm trên nhánh `main`, đi cùng mã nguồn.
- **Trạng thái đang chạy** (bảng việc, câu hỏi, nhật ký) nằm trên **một nhánh riêng `agents-state`**, mở ra ở thư mục `.agents-state/`. Mọi worktree đều ghi vào cùng một chỗ này qua lệnh `ag`, nên không có chuyện mỗi nhánh giữ một bản trạng thái khác nhau.

```
<repo>/                          # worktree chính, nhánh main
  AGENTS.md                      # ĐIỂM VÀO DUY NHẤT cho mọi AI
  CLAUDE.md, GEMINI.md, .cursor/rules/…, .github/copilot-instructions.md
                                 # mỗi file chỉ 1 dòng: "Đọc AGENTS.md". Do `ag init` sinh ra
  .agents/
    WORKFLOW.md                  # quy trình chung (dùng lại nguyên)
    project.md                   # PHẦN RIÊNG: công nghệ, lệnh build/test, thư mục nguồn, quy ước
    roles/master.md coder.md tester.md
    hooks/                       # git hook dùng chung (core.hooksPath trỏ vào đây)
    bin/ag, ag.cmd, ag.js        # công cụ dòng lệnh (Node, chạy được Windows/macOS/Linux)
    monitor/                     # dịch vụ Monitor (Node)
  .agents-state/                 # worktree của nhánh agents-state (bị .gitignore trên main)
    assignments.md               # ai được giao vai gì (chủ dự án duyệt)
    registry/<agent-id>.md       # bản check-in của từng agent
    board/T-NNN.md               # bảng việc
    decisions/D-NNN.md           # câu hỏi và câu trả lời (sổ tiền lệ)
    bugs/B-NNN.md                # báo lỗi
    journal/<ngày>-<agent-id>.md # nhật ký phiên, chỉ ghi thêm
    events.jsonl                 # dòng sự kiện, chỉ ghi thêm, Monitor đọc
  .env                           # token Telegram, KHÔNG đưa lên git
<repo>-wt/<agent-id>/            # worktree riêng của từng Coder/Tester, do `ag claim` tạo
```

Mỗi lần `ag` đổi trạng thái, nó khoá file, ghi, rồi tự commit vào nhánh `agents-state`. Nhờ vậy trạng thái có lịch sử đầy đủ và quay lại được.

### 5.2 Mẫu file việc `board/T-012.md`

```markdown
---
id: T-012
title: Gửi thông báo Telegram khi test đỏ
type: feature            # feature | bug | test | spec
status: in_progress      # draft | approved | in_progress | blocked | in_test | verified | done | reopened
owner_role: coder
claimed_by: coder-01
lease_until: 2026-11-16T10:30:00+07:00
depends_on: [T-010]
blocked_by: []           # ví dụ [D-007]
files: [src/notifier/**, test/notifier/**]   # phạm vi được sửa, Master khai khi chia việc
branch: agent/coder-01/T-012
spec: SPEC.md#6.8
---
## Điều kiện xong
- [ ] Unit test notifier 3/3 đạt
- [ ] Test chấp nhận A-012 đạt (Tester chạy)
## Ghi chú bàn giao
(agent ghi khi dừng: đã làm gì, dở chỗ nào, bước tiếp theo)
```

Vòng đời: `draft → approved (chủ dự án/Master) → in_progress (Coder) → in_test → verified (Tester đạt) → done (Master gộp nhánh)`.
- Đang làm mà cần hỏi thì chuyển `blocked`. Có câu trả lời thì quay lại `in_progress`.
- Test hỏng thì chuyển `reopened → in_progress`.

### 5.3 Tham gia, nhận vai, làm tiếp khi có sự cố

**Điều kiện để một AI tham gia:** đọc/ghi được file trong repo và chạy được lệnh `git`, `node`. Không cần tính năng riêng của công cụ nào.

**Lời nhắn khởi động, giống nhau cho mọi AI:**
```text
Đọc AGENTS.md trong repo này và làm theo. ID của bạn: coder-03. Công cụ: <tên công cụ>.
```

1. **Check-in.** Agent đọc `AGENTS.md`, `WORKFLOW.md` và file vai trò, rồi chạy `ag checkin --id coder-03 --tool gemini-cli`.
   - Nếu `assignments.md` đã giao vai cho ID này: lệnh tạo `registry/coder-03.md`, ghi rõ quyền (được sửa những gì, cấm những gì), in ra cho agent đọc.
   - Nếu chưa được giao: agent ở trạng thái `pending`, tạo câu hỏi cho chủ dự án duyệt và dừng ở đó. Agent không tự nhận vai.
2. **Nhận việc.** `ag claim T-012`:
   - kiểm tra vai, `depends_on` và **phạm vi file không trùng** với việc đang làm dở của Coder khác;
   - ghi `claimed_by`, `lease_until` (ví dụ 30 phút);
   - tạo nhánh `agent/coder-03/T-012` và worktree riêng `<repo>-wt/coder-03/`, đặt `git config user.name coder-03` trong worktree đó.

   `ag heartbeat` gia hạn việc đang giữ.
3. **Ghi nhật ký.** `ag log "…"` ghi thêm vào journal. Khi dừng, `ag handoff T-012` bắt buộc ghi 3 ý: đã làm gì, dở chỗ nào, bước tiếp theo.
4. **Làm tiếp.** Lease quá hạn mà không có heartbeat thì việc được mở cho agent khác. Agent mới nhận lại nhánh cũ, đọc journal và ghi chú bàn giao rồi làm tiếp.

### 5.4 Công cụ dòng lệnh `ag`

| Lệnh | Ai dùng | Việc làm | Sự kiện sinh ra |
|---|---|---|---|
| `ag init` | Chủ dự án | Tạo khung `.agents/`, nhánh `agents-state`, hook, các file trỏ về `AGENTS.md` | `init` |
| `ag checkin --id --tool` | Mọi agent | Đăng ký agent, in quyền hạn | `checkin` / `checkin_pending` |
| `ag heartbeat` | Mọi agent | Báo còn sống, gia hạn việc đang giữ | `heartbeat` |
| `ag claim T-NNN` / `ag release T-NNN` | Coder, Tester | Nhận việc (kèm tạo nhánh/worktree) / trả việc | `task_claimed` / `task_released` |
| `ag log "…"` | Mọi agent | Ghi nhật ký | `log` |
| `ag status T-NNN in_test` | Theo vai | Đổi trạng thái việc, kiểm tra quyền theo vai | `task_status` |
| `ag ask "câu hỏi" --task T-NNN` | Coder, Tester | Tạo `D-NNN` gửi Master, chuyển việc sang `blocked` | `question_asked` |
| `ag answer D-NNN "…" --source D-003` | Master | Trả lời khi có nguồn (bắt buộc `--source`) | `question_answered` |
| `ag escalate D-NNN --options "A,B"` | Master | Chuyển câu hỏi lên chủ dự án | `decision_needed` |
| `ag decide D-NNN "…"` | Chủ dự án | Trả lời câu hỏi đã chuyển lên | `decision_answered` |
| `ag approve-agent coder-03 --role coder` | Chủ dự án | Duyệt agent mới, ghi vào `assignments.md` | `agent_approved` |
| `ag bug "tiêu đề" --task T-NNN` | Tester, Master | Tạo báo lỗi | `bug_opened` |
| `ag handoff T-NNN` | Mọi agent | Ghi bàn giao 3 ý | `handoff` |
| `ag merge T-NNN` | Master | Gộp nhánh vào `main` sau khi Tester đạt | `task_merged` |

Mẫu một dòng trong `events.jsonl`:
```json
{"ts":"2026-11-16T10:02:11+07:00","agent":"master","type":"decision_needed","ref":"D-007","msg":"Coder hỏi: định dạng ngày trong file xuất?","options":["dd/MM/yyyy","ISO 8601"],"urgent":true}
```

### 5.5 Hàng rào quyền hạn (không phụ thuộc công cụ AI)

| Lớp | Chặn được gì |
|---|---|
| **`ag`** | Kiểm tra vai trước mọi thay đổi trạng thái. Ví dụ Coder không chuyển việc sang `done`, Master phải có `--source` mới trả lời được |
| **Worktree riêng** | Mỗi Coder/Tester làm trên thư mục và nhánh riêng, không ghi đè lên nhau |
| **Hook `pre-commit`** (`.agents/hooks/`) | Đọc ID agent của worktree, từ chối commit sửa file ngoài phạm vi `files:` của việc, hoặc sửa file cấm theo vai (đặc tả, test chấp nhận, dữ liệu mẫu) |
| **Hook trên `main`** | Chỉ worktree của Master được commit/gộp vào `main` |
| **Master duyệt diff** | Trước khi gộp, Master xem toàn bộ thay đổi và đối chiếu với phạm vi việc |
| **Riêng từng công cụ (tuỳ chọn)** | Có thể thêm: subagent và `settings.json` của Claude Code, sandbox của Codex… Đây chỉ là lớp bổ sung, quy trình không dựa vào chúng |

Nói thẳng giới hạn: trên một máy, hook git có thể bị bỏ qua (`--no-verify`). Hàng rào này nhằm **chặn nhầm lẫn**, không chống được một agent cố tình phá. Phần còn lại dựa vào rule (cấm `--no-verify`), lịch sử git và bước Master duyệt diff.

### 5.6 Dịch vụ Monitor

Một chương trình Node chạy nền, theo dõi `.agents-state/`. Gồm 3 phần:

**a) Báo cáo trạng thái:** sinh `STATUS.md` và dữ liệu cho web. Phát hiện:
- việc quá hạn giữ,
- agent im lặng quá lâu,
- test đỏ,
- câu hỏi chờ quá lâu,
- việc `blocked` quá lâu.

**b) Telegram: chỉ thông báo, một chiều, không có giờ yên lặng**
- Bot chỉ gửi tin, không nhận lệnh. Chủ dự án trả lời trên máy tính bằng `ag decide`, từ Giai đoạn 3 thì trên trang web.
- Gửi ngay:
  - câu hỏi được chuyển lên chủ dự án,
  - agent mới xin tham gia,
  - agent bị chặn quá lâu,
  - lỗi nghiêm trọng,
  - agent im lặng khi đang giữ việc.
- Vì không có giờ yên lặng và mọi câu hỏi đều đi lên, tin có thể nhiều. Để đỡ phiền:
  - gom các sự kiện trong 2 phút thành **một tin**,
  - câu hỏi Master tự trả lời được thì **không** báo,
  - gửi thêm bản tóm tắt ngày: việc xong, test đạt, câu hỏi còn chờ.
- An toàn:
  - Token bot để trong `.env`, không đưa lên git.
  - Chỉ gửi tóm tắt, không gửi mã nguồn hay dữ liệu nhạy cảm, vì nội dung đi qua máy chủ Telegram.
  - Vì bot không nhận lệnh, không lo người lạ điều khiển hệ thống qua Telegram.
- Cài đặt bot:
  1. Tạo bot bằng `@BotFather` để lấy token.
  2. Nhắn bot một tin rồi gọi `getUpdates` một lần để lấy chat ID.
  3. Điền token và chat ID vào `.env`.

**c) Trang web 2D**
- Văn phòng 2D, mỗi agent là nhân vật ngồi ở bàn. Xem `internal/mockups/monitor-pixel-office.html`.
- Nhân vật hiện tên công cụ AI (Claude, Codex, Gemini…), vì đội có thể trộn nhiều công cụ.
- Trạng thái thể hiện bằng hình:

  | Trạng thái | Hình |
  |---|---|
  | Đang làm | Gõ phím, bong bóng ghi mã việc |
  | Chờ câu trả lời | Bong bóng "?" vàng |
  | Lỗi / bị chặn | Bong bóng "!" đỏ |
  | Rảnh / ngoại tuyến | Xám, "z z" |

- Bấm nhân vật để xem: vai, công cụ, việc đang giữ, nhánh, lần hoạt động cuối, nhật ký gần nhất, link file việc.
- Bảng việc tổng trên tường. Danh sách câu hỏi chờ chủ dự án, trả lời được ngay trên web.
- **Hộp thư trao đổi với Master** (chủ dự án chốt ngày 16/11/2026):
  - Chủ dự án gõ tin nhắn hoặc yêu cầu trên web. Monitor ghi thành `.agents-state/messages/M-NNN.md` (`from: owner`, `to: master`, `status: unread`) và sinh sự kiện `message_received`.
  - Master thấy tin trong `ag inbox`, xếp trên câu hỏi đang chờ, rồi trả lời bằng `ag reply M-NNN "…"`. Câu trả lời hiện lại trên web dưới dạng một luồng hội thoại.
  - Tin nhắn **không thay thế đặc tả**. Yêu cầu làm thay đổi phạm vi thì Master chuyển thành bản nháp đặc tả hoặc câu hỏi `D-NNN` để chủ dự án duyệt.
  - Cách này dùng được với mọi công cụ AI, nhưng không tức thì: phải có một phiên Master đang chạy và kiểm tra `ag inbox`. Web hiện rõ trạng thái "Master đang hoạt động" hoặc "Master ngoại tuyến, tin sẽ được đọc khi có phiên Master".
  - **Tuỳ chọn chat gần như tức thì:** khai `master_wake_cmd` trong `project.md` (ví dụ `claude -p`, `codex exec`). Khi có tin mới mà Master ngoại tuyến, Monitor chạy lệnh này để mở một phiên Master ngắn: đọc `AGENTS.md`, `ag inbox`, trả lời, rồi dừng. Đây là phần phụ thuộc công cụ, nên không bắt buộc.
- Kỹ thuật: máy chủ Node nhỏ đẩy cập nhật lên trình duyệt (SSE hoặc WebSocket). Giao diện SVG/CSS. Có thể đổi sang PixiJS nếu muốn pixel-art có hoạt ảnh.
- Mặc định chỉ xem trên máy hoặc mạng nội bộ. Xem từ xa thì dùng Tailscale hoặc Cloudflare Tunnel, có đăng nhập.

### 5.7 Dùng lại cho dự án khác

- **Phần dùng chung:** `AGENTS.md` mẫu, `WORKFLOW.md`, `roles/`, `hooks/`, mẫu file, `bin/ag`, `monitor/`.
- **Phần riêng của dự án:** chỉ `project.md` và `.env`.
- Về sau đóng gói thành mẫu repo: `npx <tên-gói> init` tạo toàn bộ khung. Có thể làm thêm plugin cho từng công cụ (ví dụ Claude Code), nhưng chỉ là tiện ích, không bắt buộc.

## 6. Lộ trình

| Giai đoạn | Nội dung | Kết quả |
|---|---|---|
| **1** | Khung `.agents/` + nhánh `agents-state`, lệnh `ag` (init, checkin, claim kèm worktree, heartbeat, log, status, ask/answer/escalate/decide, bug, handoff, merge), hook git, file vai trò, `AGENTS.md` và các file trỏ | Agent nào cũng nhận vai, hỏi đúng cấp và làm tiếp được từ file. **Kiểm chứng bằng ít nhất 2 công cụ AI khác nhau** cùng chạy |
| **1b** | Tính năng `F-NNN` (vòng đời có bước review đặc tả, "bắt đầu làm", nghiệm thu kèm push), chuyên môn FE/BE, hợp đồng API và việc ghép nối, phụ thuộc bên ngoài `X-NNN`, chạy song song an toàn (`AG_SLOT`), hộp thư Master theo tính năng | Làm nhiều tính năng FE/BE cùng lúc, kể cả khi BE do đội khác làm hoặc API có sẵn |
| **2** | Monitor: `STATUS.md`, luật phát hiện, Telegram thông báo một chiều (gom tin, tóm tắt), kiểm tra API ngoài theo lịch, liên kết hai repo khác máy. Đặc tả: `specs/phase-2.md` (**đã duyệt**), 8 việc T-029…T-036 | Nhận thông báo khi vắng mặt |
| **3** | Đặc tả: `specs/phase-3.md` (**đã duyệt**), 9 việc T-037…T-045. Trang web văn phòng pixel; **Phòng họp**: chat với Master chính và các Master luồng qua bộ nối công cụ (hộp thư làm dự phòng); trả lời câu hỏi, cho bắt đầu làm, nghiệm thu ngay trong hội thoại | Bàn giao và theo dõi mọi luồng trên một trang |
| **4** | Đóng gói mẫu repo; (tuỳ chọn) Monitor tự mở phiên Coder và Tester khi có việc chờ | Dùng lại bằng một lệnh |

Giai đoạn "Telegram hai chiều" trong bản cũ đã bỏ, vì chủ dự án chọn Telegram chỉ thông báo.

Gợi ý: xây chính hệ thống này **bằng workflow này**. Master viết đặc tả từng giai đoạn, Coder làm, Tester kiểm tra. Có thể chuyển dự án Lịch mua bán sang chạy thử sau Giai đoạn 1.

## 7. Bắt đầu từ đâu

Xem [README.md](../README.md): chia lối đi theo việc bạn muốn làm (tìm hiểu, xây `ag`, áp dụng cho dự án của mình). Các bước xây `ag` chi tiết: [BUILD-GUIDE.md](BUILD-GUIDE.md).

## 8. Nguồn tham khảo

- Anthropic, *Building effective agents*: mẫu orchestrator–workers, evaluator–optimizer. https://www.anthropic.com/engineering/building-effective-agents
- Anthropic, *How we built our multi-agent research system*: cách Master giao việc rõ mục tiêu, định dạng đầu ra và ranh giới; lưu trạng thái ra ngoài để chạy tiếp. https://www.anthropic.com/engineering/built-multi-agent-research-system
- AGENTS.md: chuẩn file hướng dẫn chung cho nhiều công cụ AI. https://agents.md
- Git: `git worktree`, `core.hooksPath`, hook `pre-commit`.
- GitHub Spec Kit: quy trình đặc tả → kế hoạch → danh sách việc. https://github.com/github/spec-kit
- MetaGPT (bài báo "Meta Programming for a Multi-Agent Collaborative Framework"): vai PM, kiến trúc sư, kỹ sư, QA làm việc theo quy trình chuẩn, trao đổi qua tài liệu có cấu trúc.
- Telegram Bot API: `sendMessage`, `getUpdates`. https://core.telegram.org/bots/api

## 9. Đã chốt (16/11/2026)

| # | Điểm | Quyết định |
|---|---|---|
| 1 | Công cụ AI cho từng vai | **Không chọn trước.** AI nào cũng tham gia được vào vai nào, miễn đọc/ghi được file và chạy được lệnh |
| 2 | Git | **Bắt buộc** |
| 3 | Coder song song hay lần lượt | **Song song** |
| 4 | Telegram | **Chỉ thông báo**, không nút duyệt, **không có giờ yên lặng** |
| 5 | Quyền tự quyết của agent | **Không tự quyết dựa trên phán đoán.** Mọi vấn đề hỏi cấp trên (mục 4.1) |
| 6 | Ranh giới "không tự quyết" | Chi tiết bên trong việc được giao, không đổi hành vi hay giao diện (tên biến cục bộ, cách tách hàm, thứ tự code), **không cần hỏi** nếu theo đúng quy ước trong `project.md`. **Bắt buộc hỏi:** hành vi, giao diện người dùng, định dạng dữ liệu, API, thêm thư viện, đổi cấu trúc thư mục |
| 7 | AI chỉ có giao diện chat (không chạy được lệnh) | **Không cho tham gia** |
| 8 | Ai duyệt agent mới | **Chỉ chủ dự án** |
| 9 | Chủ dự án trả lời câu hỏi ở đâu | Lệnh `ag decide` ở Giai đoạn 1–2, trang web từ Giai đoạn 3 |
| 10 | Push code | **Không agent nào được tự push.** Chỉ chủ dự án push, qua `ag push` có gõ xác nhận. Hook `pre-push` chặn mọi lần push khác. Ngoại lệ duy nhất: quyết định 29 |
| 11 | Dự án có sẵn | `ag init --existing`: không ghi đè `AGENTS.md`/hook cũ, hỗ trợ nhánh chính khác `main`, test đỏ sẵn. Master khảo sát rồi điền `project.md`; chỉ đặc tả phần làm mới |
| 12 | Chỉ 1 việc, 1 Coder | Chế độ gọn `team_mode: solo`: vẫn có Master, Master kiêm Tester. Coder ghi kế hoạch các bước thay cho chia việc nhỏ |
| 13 | FE/BE và cổng xác nhận | **Hai repo** (cùng máy ở Giai đoạn 1). Hợp đồng API ở repo BE. Cổng `gate` ở repo FE, chỉ chủ dự án đóng. Mỗi repo một Master. Đọc chéo, không ghi chéo. Chủ dự án tham gia như agent với `tool: human` |
| 14 | Skill | 24 skill dạng markdown trong `.agents/skills/`, AI nào cũng đọc được |
| 15 | Làm tiếp khi hết token | `ag plan`/`ag step` ghi tiến độ từng bước; tự commit phần dở khi tiếp quản; `ag reassign` chuyển việc ngay; mở phiên mới cùng ID trong worktree cũ |
| 16 | Trao đổi với Master trên web | Hộp thư qua file (`messages/M-NNN.md`, `ag reply`) ở Giai đoạn 3, dùng được với mọi công cụ AI. Tuỳ chọn `master_wake_cmd` để đánh thức Master khi có tin mới |
| 17 | FE/BE | **Chuyên môn** (`area`) của Coder và Tester, không phải vai riêng. Hook chặn chéo chuyên môn |
| 18 | Tính năng | `F-NNN` có độ ưu tiên và nhánh riêng. Vòng đời: phân tích → đặc tả → **review của cấp dưới** → chủ dự án cho **bắt đầu làm** → làm → **chủ dự án nghiệm thu (kèm chọn push)** → gộp vào `main` |
| 19 | Hợp đồng API | Tài liệu chính thức trong `contract_dirs`, chỉ Master sửa, chủ dự án duyệt. Tính năng FE+BE chia thành: hợp đồng, BE, FE (API giả), ghép nối |
| 20 | API của đội khác hoặc có sẵn | Phụ thuộc bên ngoài `X-NNN`. Agent không liên lạc đội ngoài; chủ dự án là cầu nối, gửi danh sách vấn đề soạn sẵn. Test thường chỉ chạy trên dữ liệu mẫu |
| 21 | Nhiều phiên song song | Mỗi agent AI giữ tối đa 1 việc; người giữ được nhiều. `setup_cmd`, `AG_SLOT` tách cổng mạng và cơ sở dữ liệu |
| 22 | Master nhiều luồng | **Đã thay (đề xuất 03):** một **Master chính** (toàn dự án, gộp vào `main`) và **Master luồng** cho từng tính năng (`master-F-NNN`, làm trên nhánh tính năng, chỉ động vào tính năng của mình). Việc T-028 |
| 23 | Chat với Master trên web | Monitor chạy công cụ AI qua **bộ nối** (`master_adapter`, đầu tiên là Claude Code), trả lời hiện dần như app chat. Nhiều hội thoại song song: "Chung" và mỗi tính năng một hội thoại. Công cụ không hỗ trợ thì dùng hộp thư. Giai đoạn 3 |
| 24 | Lịch sử hội thoại | Lưu trong file `threads/C-NNN.md`, không phụ thuộc phiên AI. Phiên mất thì phiên mới đọc lại và trả lời tiếp |
| 25 | Hành động của chủ dự án trên web | Đăng nhập + gõ lại mã + mã dùng một lần do Monitor cấp, tương đương gõ xác nhận trong terminal |
| 26 | Tự mở phiên Coder và Tester | Để Giai đoạn 4 (tuỳ chọn) |
| 27 | Monitor | Mỗi repo một Monitor chạy nền (`ag monitor start`), dùng chung một bot, tin có tiền tố tên dự án. `STATUS.md` nằm trong `.agents-state/`, không commit. Danh tính `monitor` chỉ được chạy `ext check` |
| 28 | Ngưỡng và nội dung thông báo | Im lặng 30 phút, bị chặn 4 giờ, nhắc câu hỏi mỗi 12 giờ, gom tin 2 phút, tóm tắt 08:00 và 17:00. Tin có mã, tiêu đề và lệnh gợi ý; tuỳ chọn `code-only`. Kiểm tra API ngoài theo lịch mặc định tắt |
| 29 | Ngoại lệ push cho hai repo khác máy | Khi chủ dự án bật `state_push` (gõ xác nhận một lần), Monitor được tự push **riêng nhánh `agents-state`** (chỉ trạng thái, không code). Mọi nhánh khác vẫn bị chặn. Nên dùng remote riêng tư |
| 30 | Trang web | Chạy trong Monitor, mặc định `127.0.0.1:4300`. HTML/JS thuần, không build, không thư viện. Nét pixel tự vẽ, tuỳ chọn thay bằng sprite có giấy phép. Tối đa 16 agent một phòng |
| 31 | Đăng nhập và hành động trên web | Mật khẩu đặt bằng `ag web set-password`, lưu băm ngoài repo. Hành động quan trọng gõ lại mã đối tượng. `ag` nhận lệnh chủ dự án qua TTY **hoặc** mã dùng một lần do Monitor ký (60 giây, đúng hành động và đối tượng) |
| 32 | Phòng họp | Bộ nối đầu tiên: Claude Code; công cụ khác dùng hộp thư (`ag reply`). Tạo tính năng mới từ web đi qua Master chính. Giới hạn: 1 câu trả lời mỗi hội thoại, tối đa 3 đồng thời, 15 phút, có nút Dừng |
| 33 | Kiểm thử giao diện | Danh sách kiểm tay có ảnh chụp; dữ liệu và chat kiểm tự động bằng bộ nối giả |
| 34 | Đóng băng thiết kế và dọn repo (16/11/2026) | Không thêm giai đoạn, đề xuất, đặc tả mới cho tới khi bản làm tay (`starter-kit/`) được dùng thật. Ghi chỗ vướng vào `internal/FEEDBACK.md`, rồi thu gọn `ag` bản đầu theo đó. Người dùng chỉ thấy `README.md` và `starter-kit/`; tài liệu xây `ag` nằm trong `internal/`. Xoá 2 bản phác cũ, giữ bản pixel |
| 35 | Tên file và thư mục (16/11/2026) | **Tên file và thư mục dùng tiếng Anh**, nội dung có thể tiếng Việt. Áp dụng cho repo này và cho cấu trúc mà `starter-kit/` tạo trong dự án người dùng (`workflow/`, `SPEC.md`, `tasks/`, `questions/`, `bugs/`, `journal/`, `DECISIONS.md`). Tên skill dự kiến trong `specs/` (đang viết tiếng Việt) sẽ đổi sang tiếng Anh khi làm. `internal/trial-project/` giữ nguyên tên gốc vì là bản lưu của dự án thử nghiệm |
| 36 | Trao đổi qua file + watch.sh (16/11/2026) | Theo đề xuất của chủ repo: các agent trao đổi qua file, mỗi file có `to:` (ai đang phải làm). `starter-kit/workflow/watch.sh` quét file (không tốn token), đánh thức agent `auto` bằng lệnh không tương tác của công cụ, báo agent `manual` và chủ dự án qua màn hình và Telegram, sinh `STATUS.md`. Agent dùng **bất kỳ công cụ AI nào**. Thay cho việc chủ dự án chuyển lời giữa các phiên. Subagent của Claude Code giữ làm tuỳ chọn cho Master |
| 37 | Trang monitor tối giản (16/11/2026) | `starter-kit/workflow/monitor.js`: một file Node, không thư viện ngoài, chỉ đọc, chỉ nghe `127.0.0.1` (mặc định cổng 4300). Giao diện văn phòng pixel tự vẽ: mỗi tính năng một dãy bàn (Master bàn lớn đầu dãy, dãy dài tự xuống hàng), agent rảnh ở cây nước, cửa mở khi có việc chờ chủ dự án; khu "Cần bạn", bấm agent xem file chờ và log. Đọc cùng nguồn với `watch.sh`. Bản văn phòng pixel và chat trên web vẫn thuộc Giai đoạn 3 |
| 38 | Chế độ subagent, công cụ dòng lệnh thành tuỳ chọn (16/11/2026) | `agents.txt` có 3 chế độ: `subagent` (Master tự gọi subagent trong `.claude/agents/`, không cần cài thêm gì, là mặc định), `auto` (`watch.sh` chạy lệnh của công cụ AI dòng lệnh), `manual` (`watch.sh` chỉ báo). `watch.sh` bỏ qua agent `subagent`; trang monitor ghi "chờ Master gọi". Theo yêu cầu chủ repo: tạm chưa cần Claude Code dòng lệnh |
| 39 | ID Master theo phiên chat (17/11/2026) | Thay `master-F-NNN` bằng `master-NN`: **mỗi phiên chat là một Master**, làm lần lượt nhiều tính năng vẫn giữ ID; làm song song thì mở phiên `master-02` và khai trong `agents.txt`. Lý do (dùng thật): chủ dự án giao F-002 trong cùng phiên, Master tự đổi ID thành `master-F-002` không có trong `agents.txt`, nên monitor hiện như một người mới và `watch.sh` không theo dõi việc chờ Master đó. Kèm theo: monitor bỏ tính năng `done` khỏi văn phòng (chỉ còn trên bảng trắng) |
| 40 | Mọi công cụ AI dùng được như nhau (17/11/2026, nhánh `multi-tool`) | (a) **Tách `AGENTS.md`**: phần chung ngắn (công cụ nào cũng tự nạp; Antigravity nạp lại mỗi lượt, Codex mỗi phiên) và `workflow/roles/master.md`, `coder.md`, `tester.md`. Coder, Tester chỉ đọc file vai của mình, áp dụng cho mọi công cụ chứ không riêng subagent của Claude. (b) **Chế độ `window`**: `watch.sh` mở cửa sổ terminal mới (Windows Terminal, mintty, Terminal macOS, x-terminal-emulator) chạy công cụ ở dạng tương tác với lời nhắn gửi sẵn; cửa sổ còn mở thì chỉ báo khi có file mới. (c) **`manual` chép lời nhắn vào clipboard**. (d) Lệnh mẫu cho Antigravity CLI `agy` (ra mắt 5/2026), Codex (`--full-auto` đã bỏ, dùng `--sandbox workspace-write`), Gemini CLI. Theo đề nghị của chủ repo, làm trên nhánh riêng vì `main` đang chạy ổn |

## 10. Câu hỏi chờ chủ dự án

Không còn câu hỏi nào ở mức thiết kế tổng thể. Các điểm cần duyệt cho Giai đoạn 1 nằm ở mục 9 của `specs/phase-1.md`.
