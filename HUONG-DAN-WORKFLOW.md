# Workflow multi-agent: hướng dẫn đầy đủ và cách tuỳ chỉnh

Tài liệu cho **người muốn hiểu và áp dụng** workflow này vào dự án của mình. Đọc từ đầu đến cuối mất khoảng 20 phút. Phần tuỳ chỉnh ở mục 10.

> **Tình trạng (16/11/2026):** thiết kế, đặc tả Giai đoạn 1 và Giai đoạn 1b đã chốt (28 việc). Lệnh `ag`, Monitor, Telegram và trang web **chưa được viết**. Tài liệu này mô tả hệ thống **khi đã xây xong**. Chỗ nào chỉ có ở giai đoạn sau thì có ghi rõ. Cách dùng tạm trong lúc chưa có `ag` nằm ở mục 12.

---

## Mục lục

1. [Workflow này giải quyết vấn đề gì](#1-workflow-này-giải-quyết-vấn-đề-gì)
2. [Sáu nguyên tắc](#2-sáu-nguyên-tắc)
3. [Các vai](#3-các-vai)
4. [Khái niệm cơ bản](#4-khái-niệm-cơ-bản)
5. [Một việc đi từ đầu đến cuối](#5-một-việc-đi-từ-đầu-đến-cuối) (và luồng một tính năng, mục 5.3)
6. [Hỏi đáp: không ai tự quyết](#6-hỏi-đáp-không-ai-tự-quyết)
7. [Làm tiếp khi agent dừng giữa chừng](#7-làm-tiếp-khi-agent-dừng-giữa-chừng)
8. [Hàng rào quyền hạn](#8-hàng-rào-quyền-hạn)
9. [Theo dõi: Telegram, trang web, hộp thư Master](#9-theo-dõi-telegram-trang-web-hộp-thư-master)
10. [Tuỳ chỉnh](#10-tuỳ-chỉnh)
11. [Các kịch bản mẫu](#11-các-kịch-bản-mẫu)
12. [Tình trạng hiện tại và lộ trình](#12-tình-trạng-hiện-tại-và-lộ-trình)
13. [Tra cứu nhanh](#13-tra-cứu-nhanh)
14. [Câu hỏi thường gặp](#14-câu-hỏi-thường-gặp)

---

## 1. Workflow này giải quyết vấn đề gì

Khi giao việc cho AI viết code, ta hay gặp mấy chuyện sau:
- **AI quên.** Phiên làm việc khởi động lại hoặc hết token là mất hết ngữ cảnh. Việc đang làm dở không ai biết tới đâu.
- **AI tự quyết.** Gặp chỗ chưa rõ, AI tự đoán rồi làm luôn, và sai ý người giao việc.
- **AI tự khen.** AI báo "đã xong, test đạt hết" nhưng phần mềm không chạy.
- **Nhiều AI giẫm chân nhau.** Hai AI cùng sửa một file, ghi đè lên nhau.
- **Người phải ngồi canh.** Mỗi khi có việc mới hay có câu hỏi, người phải tự đi nhắn cho từng AI.

Workflow này biến việc nhiều AI cùng làm thành một **quy trình có sổ sách**:
- Mọi thứ được ghi vào file và git.
- Mỗi AI có vai rõ ràng, quyền hạn rõ ràng.
- Người làm không tự nghiệm thu.
- Con người (**chủ dự án**) là người quyết định cuối cùng.

**Không phụ thuộc công cụ AI.** Claude Code, Codex, Gemini CLI, Cursor, Copilot… đều tham gia được, và trộn lẫn được trong cùng một dự án. Điều kiện duy nhất: AI đọc/ghi được file và chạy được lệnh `git`, `node`. AI chỉ có khung chat trên web, không chạy được lệnh, thì không tham gia.

## 2. Sáu nguyên tắc

| # | Nguyên tắc | Nghĩa là |
|---|---|---|
| 1 | **Trạng thái nằm trong file và git, không nằm trong đầu agent** | Agent dừng lúc nào cũng được. Agent mới đọc file là làm tiếp được |
| 2 | **Ghi trạng thái qua lệnh `ag`, không ghi tay** | Dữ liệu luôn đúng định dạng, có lịch sử, kiểm được quyền |
| 3 | **Người làm không tự nghiệm thu** | Coder không tự đánh dấu "xong". Tester và Master kiểm tra độc lập |
| 4 | **Không tự quyết dựa trên phán đoán** | Mọi lựa chọn phải dẫn được nguồn. Không có nguồn thì hỏi cấp trên |
| 5 | **Luật bằng chữ đi kèm hàng rào bằng công cụ** | Lệnh `ag` kiểm vai, git hook chặn commit sai, mỗi agent một nhánh riêng |
| 6 | **Chỉ yêu cầu những gì AI nào cũng làm được** | Đọc/ghi file, chạy lệnh. Không dựa vào tính năng riêng của một công cụ |

## 3. Các vai

| Vai | Là ai | Hỏi ai | Phải làm | Không được |
|---|---|---|---|---|
| **Chủ dự án** | Con người | — | Cùng Master phân tích yêu cầu, trả lời câu hỏi được chuyển lên, cho tính năng "bắt đầu làm", xác nhận cổng và API của đội ngoài, nghiệm thu tính năng, quyết định push, duyệt agent mới | — |
| **Master** | AI bất kỳ. **Master chính**: 1 mỗi repo. **Master luồng**: mỗi tính năng tối đa 1 (1b) | Chủ dự án | Làm rõ yêu cầu, viết đặc tả có tiêu chí chấp nhận, chia việc, trả lời câu hỏi khi có nguồn, kiểm tra lại, gộp nhánh | Sửa code. Chọn thay chủ dự án. Push |
| **Coder** | AI bất kỳ, **nhiều**, chạy song song, có **chuyên môn** (`fe`, `be`…) | Master | Review đặc tả phần của mình, rồi viết code và test cho đúng việc được giao, trên nhánh riêng | Sửa đặc tả hay test chấp nhận. Thêm tính năng. Tự nghiệm thu. Push |
| **Tester** | AI bất kỳ, có thể có chuyên môn (`fe`, `be`, `e2e`) | Master | Review đặc tả và viết kế hoạch kiểm thử trước khi có code, chạy sản phẩm thật, kiểm tra API so với hợp đồng, báo lỗi kèm bằng chứng | Sửa code. Kiểm việc do chính mình code. Push |
| **Monitor** | **Chương trình**, không phải AI | — | Theo dõi trạng thái, gửi Telegram, chạy trang web | Ra quyết định |

**FE và BE không phải vai riêng** mà là **chuyên môn** của Coder và Tester. Họ có cùng quyền, chỉ khác loại việc nhận được và thư mục được sửa (Giai đoạn 1b).

Con người cũng tham gia được như một Coder (`--tool human`), ví dụ chủ dự án tự làm phần giao diện. Xem mục 11.4.

## 4. Khái niệm cơ bản

| Khái niệm | Mã | Là gì | Lưu ở |
|---|---|---|---|
| **Việc** | `T-NNN` | Một đơn vị công việc: tiêu đề, phạm vi file được sửa, điều kiện xong, bàn giao | `.agents-state/board/` |
| **Câu hỏi** | `D-NNN` | Câu hỏi và câu trả lời. Câu đã trả lời trở thành **tiền lệ** | `.agents-state/decisions/` |
| **Lỗi** | `B-NNN` | Báo lỗi: hiện tượng, cách tái hiện, bằng chứng | `.agents-state/bugs/` |
| **Cổng** | `G-NNN` | Điểm dừng chờ chủ dự án xác nhận, ví dụ "API đã sẵn sàng" | `.agents-state/board/` |
| **Tin nhắn** | `M-NNN` | Tin chủ dự án nhắn Master trên web (Giai đoạn 3) | `.agents-state/messages/` |
| **Bàn giao** | — | 3 ý bắt buộc: **đã làm, còn dở, bước tiếp theo** | Trong file việc |
| **Kế hoạch các bước** | — | Danh sách bước của một việc, đánh dấu khi xong từng bước | Trong file việc |
| **Hạn giữ việc** (lease) | — | Agent giữ việc trong N phút, gia hạn bằng `heartbeat`. Quá hạn thì agent khác nhận | Trong file việc |
| **Worktree** | — | Thư mục làm việc riêng của mỗi agent, trên nhánh riêng `agent/<ID>/<T-NNN>` | `<repo>-wt/<ID>/` |
| **Tính năng** | `F-NNN` | Một yêu cầu của chủ dự án, gom nhiều việc. Có độ ưu tiên, nhánh riêng `feature/F-NNN`, vòng đời riêng (mục 5.3) | `.agents-state/features/` |
| **Chuyên môn** | `area` | `fe`, `be`… gắn cho Coder, Tester và cho từng việc. Agent chỉ nhận việc đúng chuyên môn | `project.md` (`areas`) |
| **Hợp đồng API** | — | Mô tả API mà FE và BE cùng bám vào. Chỉ Master sửa, chủ dự án duyệt | `contract_dirs` |
| **Phụ thuộc bên ngoài** | `X-NNN` | API do đội khác làm, hoặc API có sẵn. Chủ dự án báo khi đội ngoài giao | `.agents-state/externals/` |
| **Nhánh trạng thái** | — | Nhánh git riêng `agents-state` chứa toàn bộ trạng thái. Mỗi thay đổi là một commit | `.agents-state/` |
| **Sự kiện** | — | Mỗi lệnh `ag` thêm một dòng JSON. Monitor đọc file này | `.agents-state/events.jsonl` |

**Vì sao trạng thái nằm ở nhánh riêng?** Mỗi Coder làm trên một worktree, một nhánh khác nhau. Nếu bảng việc nằm cùng chỗ với code, mỗi nhánh sẽ giữ một bản khác nhau. Đưa trạng thái ra một nhánh riêng thì mọi agent, dù ở worktree nào, đều ghi vào cùng một chỗ.

## 5. Một việc đi từ đầu đến cuối

### 5.1 Vòng đời

```
draft ──▶ approved ──claim──▶ in_progress ──▶ in_test ──verify──▶ verified ──merge──▶ done
              ▲                   │              │                   │
              │                  ask            bug             bug / gộp lỗi
              │                   ▼              ▼                   ▼
              └─── có trả lời ── blocked      reopened ◀─────────────┘
```

| Bước | Ai | Lệnh | Điều kiện |
|---|---|---|---|
| Tạo việc | Master | `ag task new` | Có phạm vi file, trỏ tới mục đặc tả |
| Duyệt | Master hoặc chủ dự án | `ag status T approved` | Master chỉ duyệt việc nằm trong đặc tả đã được chủ dự án duyệt |
| Nhận việc | Coder | `ag claim T` | Các việc phụ thuộc đã xong, phạm vi file không trùng với việc khác đang làm. Lệnh tự tạo nhánh và worktree |
| Làm | Coder | `ag plan`, `ag step`, `ag log`, `ag heartbeat` | Commit trên nhánh riêng |
| Giao kiểm tra | Coder | `ag status T in_test` | `ag` **tự chạy test**. Test đỏ thì bị từ chối |
| Kiểm tra | Tester | `ag claim T`, rồi `ag verify` hoặc `ag bug` | Tester không phải người code việc này |
| Gộp | Master | `ag merge T` | Gộp thử, chạy lại test, xanh mới commit. Việc thuộc một tính năng thì gộp vào **nhánh tính năng**; tính năng chỉ vào nhánh chính sau khi chủ dự án nghiệm thu (mục 5.3) |
| Đẩy lên remote | **Chỉ chủ dự án** | `ag push` | Phải gõ xác nhận tên nhánh |

### 5.2 Một ngày làm việc của Coder

```bash
ag checkin --id coder-02 --tool codex      # nhận vai, đọc quyền
ag inbox                                    # việc nào ưu tiên?
ag claim T-012                              # nhận việc; lệnh in đường dẫn worktree
cd ../myapp-wt/coder-02
ag plan T-012 "Model" "API" "Test" "Chạy thử"
# ... viết code, commit ...
ag step T-012 1 --note "Model xong, commit a1b2c3"
ag heartbeat                                # ít nhất mỗi 15 phút
# ... gặp chỗ đặc tả không nói rõ ...
ag ask "Ngày hiển thị theo định dạng nào?" --task T-012 --context "Mục 4.2 không ghi"
# việc chuyển sang blocked; Coder nhận việc khác hoặc dừng
```

### 5.3 Luồng một tính năng

Đây là luồng chính khi bạn làm việc với Master:

```
Phân tích ──▶ Đặc tả ──▶ Review ──▶ Chờ bắt đầu ──▶ Đang làm ──▶ Chờ nghiệm thu ──▶ Đã gộp ──▶ Đã push
(bạn +        (Master     (cấp dưới    (bạn duyệt       (code, test,   (Master kiểm xong,  (vào main)  (nếu bạn
 Master)       viết, chia  đọc, hỏi)    đặc tả cuối)     ghép nối,      báo cáo gửi bạn)                chọn push)
               việc)                                     sửa lỗi)
```

- **Review:** mỗi chuyên môn (FE, BE) và Tester nhận một việc review. Họ đọc đặc tả và đặt câu hỏi. Tester viết luôn **kế hoạch kiểm thử** cho từng tiêu chí chấp nhận. Đặc tả bị sửa thì những ai đã review xong phải review lại.
- **Chỉ khi mọi người review xong và không còn câu hỏi nào**, bạn mới được báo để cho "bắt đầu làm". Trước lúc đó không ai viết code.
- **Báo cáo nghiệm thu** có 7 phần: từng tiêu chí và bằng chứng, kết quả test, lỗi, các quyết định đã đưa ra, phụ thuộc bên ngoài, **cách tự thử**, những gì chưa làm.

**Bạn chỉ cần vào ở 4 thời điểm**, lần nào cũng có thông báo:

| # | Lúc nào | Bạn làm gì |
|---|---|---|
| 1 | Có câu hỏi Master không quyết được | `ag decide` |
| 2 | Review xong, hết câu hỏi | Duyệt đặc tả cuối: `ag feature start F` |
| 3 | Đội ngoài báo đã giao API (nếu có) | `ag ext delivered X` |
| 4 | Tính năng xong | Nghiệm thu: `ag feature accept F --push` (đạt và push), `accept` (đạt, chưa push), hoặc `reject` |

**Làm nhiều tính năng cùng lúc:** trong lúc tính năng A đang làm hoặc đang chờ, bạn và Master bàn tiếp tính năng B theo đúng luồng trên. Agent rảnh tự nhận việc theo độ ưu tiên của tính năng. Master trả lời câu hỏi đang chặn việc của A trước, rồi mới bàn tiếp B.

## 6. Hỏi đáp: không ai tự quyết

### 6.1 Chuỗi hỏi

```
Coder / Tester ──ag ask──▶ Master ──có nguồn──▶ ag answer --source <nguồn>
                              │
                              └─ không có nguồn ─▶ ag escalate ─▶ Chủ dự án ─▶ ag decide
```

- Coder và Tester **chỉ hỏi Master**.
- Master **chỉ được trả lời khi dẫn được nguồn**: mục đặc tả đã duyệt, câu `D-NNN` đã quyết trước đó, hoặc `project.md`. Lệnh `ag answer` bắt buộc có `--source`.
- Không có nguồn thì Master chuyển câu hỏi lên chủ dự án, kèm các phương án và ảnh hưởng của từng phương án. Master được ghi "Master đề xuất…" nhưng không được chọn hộ.
- Mỗi câu chủ dự án đã trả lời là một **tiền lệ**. Lần sau gặp câu tương tự, Master dẫn lại tiền lệ đó. Nhờ vậy số câu hỏi lên tới chủ dự án giảm dần.
- Trong lúc chờ, việc chuyển sang `blocked` và được nhả ra. **Không ai làm tiếp theo phỏng đoán.**

### 6.2 Ranh giới: cái gì phải hỏi

| Không cần hỏi | Bắt buộc hỏi |
|---|---|
| Chi tiết bên trong việc, không đổi hành vi hay giao diện: tên biến cục bộ, cách tách hàm, thứ tự code, **khi theo đúng quy ước trong `project.md`** | Hành vi, giao diện người dùng, định dạng dữ liệu, API, thêm thư viện, đổi cấu trúc thư mục. Chỗ đặc tả mơ hồ, thiếu, hay tài liệu mâu thuẫn nhau |

Mục "Quy ước code" trong `project.md` càng chi tiết thì càng ít câu hỏi. Xem mục 10.2.

## 7. Làm tiếp khi agent dừng giữa chừng

Agent có thể dừng bất cứ lúc nào: hết token, hết ngữ cảnh, lỗi mạng, bị tắt. Thường là **dừng đột ngột, không kịp bàn giao**. Vì vậy trạng thái phải được ghi **liên tục trong lúc làm**, không chỉ lúc dừng.

| Lớp lưu | Ghi gì | Khi nào |
|---|---|---|
| Kế hoạch các bước (`ag plan`, `ag step`) | Đã xong bước mấy | Mỗi khi xong một bước |
| Bàn giao (`ag handoff`) | Đã làm, còn dở, bước tiếp theo | Sau mỗi bước lớn và trước khi dừng |
| Commit trên nhánh | Code | Thường xuyên, kể cả code chưa xong |
| Nhật ký (`ag log`) | Ghi chú tự do | Bất kỳ lúc nào |
| Sự kiện | Mọi lệnh `ag` đã chạy | Tự động |
| Tự lưu khi tiếp quản | Phần code chưa commit của agent cũ | Tự động, khi agent khác nhận lại việc |

**Ba cách làm tiếp:**

1. **Cùng ID, nhanh nhất.** Mở phiên AI mới (cùng công cụ hay công cụ khác đều được) **trong đúng thư mục worktree cũ**, rồi dán:
   ```text
   Đọc AGENTS.md và làm theo. ID của bạn: coder-02 (làm tiếp phiên trước bị dừng).
   Chạy ag whoami và ag inbox, đọc bàn giao và kế hoạch các bước của việc đang giữ, chạy test để thấy hiện trạng, rồi làm tiếp từ bước chưa xong.
   ```
2. **Đổi agent ngay:** chủ dự án chạy `ag reassign T-012 --to coder-05`.
3. **Tự động:** chờ hết hạn giữ việc (mặc định 30 phút), agent khác `ag claim` là nhận được.

Cả hai cách 2 và 3: nếu worktree cũ còn thay đổi chưa commit, `ag` tự commit phần đó (`WIP: tự lưu khi tiếp quản…`) trước khi giao. Không mất dòng code nào.

## 8. Hàng rào quyền hạn

| Lớp | Chặn được gì |
|---|---|
| Lệnh `ag` | Sai vai thì từ chối (mã thoát 2). Ví dụ Coder không đặt được `done`, Master trả lời mà không có nguồn thì bị từ chối |
| Worktree riêng | Mỗi agent một thư mục, một nhánh, không ghi đè lên nhau |
| Hook `pre-commit` | Commit sửa file ngoài phạm vi việc, hoặc file cấm theo vai, thì bị từ chối. Chỉ Master commit được lên nhánh chính |
| Hook theo chuyên môn (1b) | Coder `fe` không commit được vào thư mục của `be`, và ngược lại, kể cả khi file đó nằm trong phạm vi việc |
| Hook hợp đồng (1b) | Chỉ Master commit được vào thư mục hợp đồng API |
| Hook `pre-push` | **Mọi lần push đều bị chặn**, trừ khi chủ dự án chạy `ag push` (hoặc `ag feature accept --push`) và gõ xác nhận |
| Lệnh của chủ dự án | `decide`, `approve-agent`, `gate pass/fail`, `reassign`, `push`, `feature start/accept/reject`, `ext delivered/fixed` bắt buộc gõ xác nhận trong terminal tương tác. AI chạy lệnh qua shell không tương tác nên không chạy nhầm được |
| Master duyệt diff | Đọc toàn bộ thay đổi trước khi gộp |

**Giới hạn cần biết:** trên một máy, hook có thể bị bỏ qua (`--no-verify`). Hàng rào này nhằm **chặn nhầm lẫn**, không chống được một agent cố tình phá. Phần còn lại dựa vào luật (cấm `--no-verify`), lịch sử git, và bước Master duyệt diff.

## 9. Theo dõi: Telegram, trang web, hộp thư Master

| Kênh | Có từ | Làm gì |
|---|---|---|
| `ag inbox`, `ag task list` | Giai đoạn 1 | Xem trong terminal |
| `STATUS.md` | Giai đoạn 2 | Bản tóm tắt tự cập nhật |
| **Telegram** | Giai đoạn 2 | **Chỉ thông báo, một chiều.** Gửi ngay khi: có câu hỏi chờ chủ dự án, cổng chờ xác nhận, agent mới xin vào, agent bị chặn lâu, lỗi nghiêm trọng, agent im lặng khi đang giữ việc. Các sự kiện trong 2 phút được gom thành một tin. Có bản tóm tắt ngày |
| **Trang web văn phòng pixel** | Giai đoạn 3 | Văn phòng pixel-art, mỗi agent là một nhân vật ngồi ở bàn. Màu áo là màu tính năng đang làm. Bong bóng trên đầu cho biết trạng thái. Agent đang chờ đứng ở cây nước, agent mới xin vào đứng ở cửa. Bảng trắng trên tường là bảng luồng thu nhỏ. Bên cạnh có khu "Cần bạn", bảng luồng theo tính năng, chi tiết từng agent. Trả lời câu hỏi, xác nhận cổng, nghiệm thu ngay trên web. Bản phác: `monitor-pixel-office.html` |
| **Phòng họp với Master** | Giai đoạn 3 | Chat trực tiếp trên web với Master chính (hội thoại "Chung") và từng Master luồng (mỗi tính năng một hội thoại). Monitor chạy công cụ AI qua bộ nối, câu trả lời hiện dần. Câu hỏi, "bắt đầu làm", nghiệm thu hiện thành thẻ có nút ngay trong hội thoại. Công cụ không hỗ trợ thì quay về hộp thư (`ag reply`) |

Trang web mặc định chỉ xem được trên máy hoặc mạng nội bộ. Muốn xem từ xa thì dùng Tailscale hoặc Cloudflare Tunnel, có đăng nhập. Telegram chỉ nhận bản tóm tắt, không nhận mã nguồn, vì nội dung đi qua máy chủ của Telegram.

## 10. Tuỳ chỉnh

Workflow chia làm hai phần:
- **Phần lõi dùng chung:** quy trình, vai, lệnh `ag`, hook. Mọi dự án giống nhau, nên agent nào đã quen ở dự án này thì sang dự án khác vẫn làm được.
- **Phần riêng:** mỗi người, mỗi dự án tự chỉnh.

| Mức | Chỉnh gì | Ở đâu | Ảnh hưởng |
|---|---|---|---|
| 1 | Lệnh build/test, thư mục, thời hạn giữ việc, chế độ làm việc | `.agents/project.md` (frontmatter) | Chỉ dự án này |
| 2 | Quy ước code, các quyết định chung | `.agents/project.md` (phần thân) | Giảm số câu hỏi |
| 3 | Thông báo Telegram | `.env` | Chỉ máy của bạn, không đưa lên git |
| 4 | Số agent, công cụ AI, ai làm vai gì | `assignments.md`, qua `ag approve-agent` | Đội của bạn |
| 5 | Luật, vai, skill | `templates/` trong bản fork của bạn | Mọi dự án dùng bản fork đó |

### 10.1 Mức 1: các khoá trong `project.md`

Frontmatter chỉ cho phép `khoá: giá trị` hoặc `khoá: [a, b]` trên một dòng.

| Khoá | Mặc định | Ý nghĩa | Ví dụ |
|---|---|---|---|
| `name` | — | Tên ngắn của dự án | `shop-api` |
| `test_cmd` | — | Lệnh chạy toàn bộ test. Mã thoát khác 0 là đỏ | `npm test`, `pytest -q`, `./gradlew test` |
| `build_cmd` | trống | Lệnh build | `npm run build` |
| `source_dirs` | — | Mã nguồn. Master và Tester không được sửa | `[src/**, app/**]` |
| `acceptance_dirs` | — | Test chấp nhận. Coder không được sửa | `[acceptance/**]` |
| `fixture_dirs` | — | Dữ liệu mẫu cố định. Coder không được sửa | `[fixtures/**]` |
| `spec_files` | — | File đặc tả. Chỉ Master sửa | `[SPEC.md, docs/spec/**]` |
| `main_branch` | `main` | Nhánh chính | `master`, `develop` |
| `lease_minutes` | `30` | Thời hạn giữ việc (phút) | `20` cho việc nhỏ, `60` cho việc nặng |
| `team_mode` | `team` | `team`: đủ vai. `solo`: Master kiêm Tester | `solo` |
| `known_failing` | `[]` | Test đã đỏ sẵn từ trước, chủ dự án đã duyệt. `test_cmd` phải tự loại ra | `[test/legacy_export.test.js]` |
| `previous_hooks_path` | trống | Hook cũ của dự án. Hook của `ag` gọi tiếp các hook này | `.husky` |
| `links` | `[]` | Repo khác (cùng máy) để đọc trạng thái chéo | `[be=../shop-api]` |
| `areas` | `[]` | Chuyên môn và thư mục (Giai đoạn 1b) | `[be=server/**, fe=web/**]` |
| `contract_dirs` | `[]` | Thư mục hợp đồng API, chỉ Master sửa (1b) | `[contracts/**]` |
| `setup_cmd` | trống | Lệnh cài đặt khi tạo worktree mới (1b) | `npm ci` |
| `worktree_env` | `[]` | Biến môi trường theo khe `AG_SLOT`, để nhiều phiên chạy server cùng lúc (1b) | `[PORT=3000+AG_SLOT, DB_NAME=app_AG_SLOT]` |
| `live_check_cmd` | trống | Kiểm tra API thật so với hợp đồng (1b) | `npm run contract:live` |
| `master_wake_cmd` | trống | Lệnh đánh thức Master khi có tin nhắn trên web (Giai đoạn 3) | `claude -p`, `codex exec` |

### 10.2 Mức 2: quy ước code và quyết định chung

Đây là chỗ **đáng đầu tư nhất**. Theo ranh giới "không tự quyết" (mục 6.2), Coder được tự làm mọi thứ theo đúng quy ước. Thiếu quy ước thì Coder phải hỏi.

Ví dụ phần thân `project.md`:

```markdown
## Quy ước code
- Định dạng: Prettier mặc định, thụt lề 2 dấu cách.
- Đặt tên: camelCase cho biến và hàm, PascalCase cho component, kebab-case cho tên file.
- Code mới: API đặt ở src/api/<tài-nguyên>/, mỗi endpoint một file.
- Lỗi: ném AppError(mã, thông-điệp); không console.log trong code chính.
- Test: cạnh file nguồn, tên <file>.test.ts.

## Quyết định chung đã có
- Ngày giờ lưu UTC, hiển thị theo múi giờ người dùng (D-004).
- Không thêm thư viện mới nếu chưa hỏi (D-001).
```

Master dẫn mục "Quyết định chung" làm nguồn khi trả lời câu hỏi.

### 10.3 Mức 3: thông báo (Giai đoạn 2)

File `.env` ở gốc repo, không đưa lên git:
```
TELEGRAM_BOT_TOKEN=...      # lấy từ @BotFather
TELEGRAM_CHAT_ID=...        # nhắn bot một tin rồi gọi getUpdates để lấy
```
Bot chỉ gửi tin, không nhận lệnh. Không cài Telegram thì mọi thứ khác vẫn chạy bình thường. Các tuỳ chọn như khoảng gom tin hay giờ gửi bản tóm tắt sẽ được chốt khi viết đặc tả Giai đoạn 2.

### 10.4 Mức 4: đội của bạn

| Bạn muốn | Cách làm |
|---|---|
| Một mình với 1 AI | `team_mode: solo`, 1 Master và 1 Coder. Hoặc bạn kiêm Master: `ag init --master-id owner --master-tool human` |
| Nhiều Coder song song | Duyệt thêm `coder-02`, `coder-03`… Master chia việc với phạm vi file không chồng nhau |
| Trộn nhiều công cụ AI | Mỗi agent khai `--tool` lúc check-in. Không cần cấu hình gì thêm |
| Tự mình code một phần | Duyệt một ID cho chính bạn với `tool: human`. Bạn nhận việc như một Coder, không bị tính hạn giữ việc |
| Thêm agent giữa chừng | Agent chạy `ag checkin`, rồi bạn chạy `ag approve-agent <ID> --role <vai>` |
| Tách Coder FE và BE (1b) | Khai `areas` trong `project.md`, duyệt agent kèm `--area fe` hoặc `--area be`. Agent làm cả hai thì `--area fe,be` |
| Làm nhiều tính năng cùng lúc (1b) | Mỗi tính năng có độ ưu tiên. Mở thêm phiên AI cho nhanh; mỗi agent AI chỉ giữ 1 việc. Khai `setup_cmd` và `worktree_env` để các phiên chạy server không đụng nhau |
| BE do đội khác làm, hoặc API có sẵn (1b) | Master tạo phụ thuộc bên ngoài `X-NNN`. Bạn là cầu nối với đội ngoài |

### 10.5 Mức 5: sửa luật, vai, skill (bản fork)

Các file trong `templates/` là phần lõi: `AGENTS.md`, `WORKFLOW.md`, `roles/*.md`, `skills/**`, `hooks/`. Muốn đổi thì fork repo này, sửa trong bản fork, rồi dùng bản fork để `ag init` cho các dự án của bạn.

**Sửa thoải mái:**
- câu chữ, ví dụ, ngôn ngữ của tài liệu (ví dụ dịch sang tiếng Anh);
- thêm skill mới cho một vai (`templates/skills/<vai>/<tên>.md`, đủ 4 mục: khi nào dùng, các bước, đầu ra, kiểm tra cuối);
- thêm điều cấm hoặc điều bắt buộc cho một vai;
- thêm các bước kiểm tra trong skill `tu-kiem-truoc-khi-giao`, ví dụ chạy linter.

**Đổi được, nhưng phải sửa cả code của `ag`:**
- thêm hoặc bớt trạng thái việc (`src/lib/transitions.js`);
- thêm một vai mới, ví dụ Reviewer hay DevOps (`src/lib/roles.js`, hook, file vai);
- đổi định dạng file trạng thái.

**Không nên bỏ.** Bỏ những điều này thì workflow mất tác dụng:

| Đừng bỏ | Vì |
|---|---|
| Người làm không tự nghiệm thu | Chính là lý do "21/21 test đạt nhưng app không mở được" |
| Master phải có nguồn mới được trả lời | Không có luật này, Master sẽ đoán thay chủ dự án |
| Bàn giao 3 ý, kế hoạch các bước | Không có chúng thì không làm tiếp được khi agent dừng |
| Trạng thái chỉ đổi qua `ag` | Sửa tay sẽ làm sai định dạng, mất lịch sử, bỏ qua kiểm tra quyền |
| Cấm agent tự push | Code chưa được chủ dự án xem không được rời khỏi máy |

### 10.6 Tuỳ chỉnh theo công cụ AI (không bắt buộc)

Quy trình không dựa vào tính năng riêng của công cụ nào. Nhưng nếu bạn dùng chủ yếu một công cụ, có thể thêm lớp tiện ích riêng:
- **Claude Code:** subagent cho từng vai trong `.claude/agents/`, giới hạn công cụ, quyền ghi theo đường dẫn trong `settings.json`, skill trong `.claude/skills/` sinh từ cùng nội dung `templates/skills/`.
- **Codex, Gemini CLI, Cursor, Copilot:** đọc `AGENTS.md`, hoặc file trỏ về nó (`GEMINI.md`, `.cursor/rules/`, `.github/copilot-instructions.md`), do `ag init` sinh ra.

## 11. Các kịch bản mẫu

### 11.1 Dự án mới

1. `git init`, tạo một commit đầu.
2. `ag init`, rồi điền `project.md`.
3. Mở một phiên AI làm Master: cùng bạn viết đặc tả. Bạn duyệt đặc tả.
4. Master chia việc. Bạn duyệt các Coder và Tester.
5. Mở các phiên Coder. Mỗi phiên dán: *"Đọc AGENTS.md và làm theo. ID của bạn: coder-01. Công cụ: …"*.

### 11.2 Dự án có sẵn

1. Commit hoặc stash hết thay đổi đang dở. Chạy `ag init --existing` (thêm `--main-branch master` nếu nhánh chính không tên `main`).
2. `ag` không ghi đè `AGENTS.md`, `CLAUDE.md` hay hook cũ, chỉ thêm một mục vào cuối file và nối tiếp hook cũ.
3. Master khảo sát dự án, điền `project.md` từ code hiện tại, chạy test để ghi mốc ban đầu.
4. Test đỏ sẵn thì bạn duyệt `known_failing`.
5. Master **chỉ đặc tả phần sẽ làm mới hoặc sửa**. Code cũ liên quan được ghi là "hành vi hiện tại, phải giữ nguyên".

### 11.3 Chỉ một việc, một Coder

`team_mode: solo`. Master tạo 1 việc. Coder ghi kế hoạch các bước bằng `ag plan`, làm và đánh dấu từng bước. Master kiểm tra thay Tester, rồi gộp. Cần ít nhất 2 phiên AI (Master và Coder), hoặc bạn kiêm Master.

### 11.4 Frontend và backend ở hai repo, bạn tự làm frontend

```
repo BE:  T-020 "API đơn hàng"  ──(Coder BE làm, Tester BE kiểm, Master BE gộp)──▶ done
                                                     │  (repo FE chỉ đọc sang)
repo FE:  G-001 "API đơn hàng sẵn sàng"  depends_on: [be:T-020]  ──bạn xác nhận──▶ passed
          T-021 "Nối API thật"           depends_on: [G-001]    ──▶ mở cho bạn làm
```

1. Master BE viết **hợp đồng API** trong repo BE, bạn duyệt. Repo FE ghi lại đúng bản đã duyệt và làm với dữ liệu giả theo hợp đồng.
2. Repo FE khai `links: [be=../shop-api]` và tạo cổng `G-001`.
3. BE xong `T-020`: cổng chuyển sang chờ bạn, có thông báo kèm URL, `curl` mẫu và kết quả kiểm tra API so với hợp đồng.
4. Bạn gọi thử API thật:
   - đạt: `ag gate pass G-001`, việc FE mở ra;
   - không đạt: `ag gate fail`, tạo lỗi, rồi bạn mang lỗi sang repo BE.
5. BE đổi hợp đồng sau khi FE đã dùng: repo FE tự phát hiện và hỏi bạn.

Repo FE chỉ **đọc** trạng thái của repo BE, không bao giờ ghi sang. Giai đoạn 1 chỉ hỗ trợ hai repo trên **cùng máy**.

### 11.5 Agent hết token giữa chừng

Xem mục 7. Cách nhanh nhất: mở phiên mới trong đúng worktree cũ với cùng ID.

### 11.6 Một tính năng có cả BE lẫn FE, cùng repo

1. Khai `areas: [be=server/**, fe=web/**]`. Duyệt Coder với `--area be` hoặc `--area fe`.
2. Master chia tính năng thành 4 việc:
   - hợp đồng API (bạn duyệt);
   - BE làm đúng hợp đồng, kèm test hợp đồng;
   - FE làm với API giả theo hợp đồng;
   - ghép nối.
3. BE và FE làm song song. Việc ghép nối mở ra khi cả hai xong.
4. Vấn đề khi ghép nối chia làm 3 loại:
   - lỗi FE: báo lỗi cho việc FE;
   - BE lệch hợp đồng: báo lỗi cho việc BE;
   - hợp đồng sai hoặc thiếu: câu hỏi lên bạn, không bên nào tự đoán.

### 11.7 Chỉ làm FE, BE do đội khác làm

1. Master chép tài liệu API của đội BE vào `contracts/external/`, ghi ngày và phiên bản. Bạn duyệt.
2. Master tạo `X-001` ở trạng thái "chờ". FE làm với API giả.
3. Đội BE báo xong (qua chat hay email). Bạn chạy `ag ext delivered X-001 --env <url staging>`.
4. Tester chạy test hợp đồng trên API thật. Mỗi chỗ lệch được ghi bằng `ag ext issue`.
5. Bạn chạy `ag ext issues X-001 --export`, rồi dán văn bản soạn sẵn gửi đội BE. Khi họ báo đã sửa: `ag ext fixed`, Tester kiểm lại.

**Agent không bao giờ liên lạc trực tiếp với đội ngoài. Bạn là cầu nối.**

### 11.8 Chỉ làm FE, API đã có sẵn (ví dụ app thống kê giá chứng khoán)

1. `ag ext new … --delivered`: tạo phụ thuộc ở trạng thái "đã có" ngay từ đầu.
2. Tester **chụp response thật một lần** làm dữ liệu mẫu trong `fixtures/`, ghi ngày chụp. Bạn duyệt bộ dữ liệu.
3. Test thường chỉ chạy trên dữ liệu mẫu, nên kết quả cố định và không tốn hạn mức gọi.
4. `ag ext check` (chạy `live_check_cmd`) kiểm tra API thật có đổi không. Có thay đổi thì bạn được hỏi.

### 11.9 Làm nhiều tính năng cùng lúc

- Mỗi tính năng có độ ưu tiên (1 cao nhất). Agent rảnh nhận việc của tính năng ưu tiên cao trước.
- Mỗi agent AI chỉ giữ 1 việc. Muốn nhanh hơn thì mở thêm phiên AI. Bạn (người) giữ được nhiều việc.
- Nhiều phiên chạy server cùng lúc: mỗi worktree có `AG_SLOT` riêng, nên cổng mạng và cơ sở dữ liệu không đụng nhau.
- Tính năng A bị chặn (ví dụ chờ đội ngoài): agent tự chuyển sang việc của B. A mở lại thì việc của A lên đầu.
- Theo dõi: `ag feature list`. Từ Giai đoạn 3 có trang web nhiều luồng, bản phác ở `monitor-nhieu-luong-mockup.html`.


## 12. Tình trạng hiện tại và lộ trình

| Giai đoạn | Nội dung | Tình trạng |
|---|---|---|
| **1** | Lệnh `ag`, khung `.agents/`, hook, tài liệu agent, dự án có sẵn, chế độ gọn, cổng, liên kết hai repo, tiếp quản, bộ skill | Đặc tả đã duyệt, 19 việc chờ giao. **Chưa có code** |
| **1b** | Tính năng và vòng đời có review, chuyên môn FE/BE, hợp đồng API, phụ thuộc bên ngoài, chạy song song an toàn, hộp thư Master theo tính năng | Đặc tả đã duyệt (`dac-ta/giai-doan-1b.md`), 8 việc T-020…T-027. **Chưa có code** |
| **2** | Monitor: `STATUS.md`, Telegram một chiều, liên kết hai repo ở hai máy khác nhau | Chưa đặc tả |
| **3** | Trang web văn phòng pixel, Phòng họp chat với Master chính và các Master luồng, trả lời câu hỏi, xác nhận cổng và nghiệm thu trên web | Có bản phác `monitor-pixel-office.html` (hướng chính) |
| **4** | Đóng gói thành mẫu repo, cài bằng một lệnh; tuỳ chọn tự mở phiên Coder và Tester | Chưa đặc tả |

**Trong lúc chưa có `ag`:** repo này đang tự xây chính nó bằng quy trình làm tay. Xem `AGENTS.md` ở gốc repo và `BAT-DAU.md`.

## 13. Tra cứu nhanh

### 13.1 Các lệnh `ag`

| Lệnh | Ai | Việc làm |
|---|---|---|
| `ag init [--existing] [--main-branch b] [--master-id id]` | Chủ dự án | Dựng khung cho repo |
| `ag checkin --id <ID> --tool <tên>` | Mọi agent | Đăng ký, nhận vai và quyền |
| `ag whoami` | Mọi agent | Mình là ai, đang giữ việc gì |
| `ag inbox` | Mọi agent | Việc cần làm, theo thứ tự ưu tiên |
| `ag heartbeat` | Mọi agent | Báo còn sống, gia hạn việc |
| `ag task new / list / show` | Master / mọi agent | Tạo, xem việc |
| `ag status T <trạng thái>` | Theo vai | Đổi trạng thái (có kiểm tra quyền) |
| `ag claim T` / `ag release T` | Coder, Tester | Nhận việc (tạo nhánh, worktree) / trả việc |
| `ag plan T "b1" "b2"…` / `ag step T <n>` | Người giữ việc | Kế hoạch các bước / đánh dấu xong bước |
| `ag log "…"` | Mọi agent | Ghi nhật ký |
| `ag handoff T --done --left --next` | Mọi agent | Bàn giao 3 ý |
| `ag ask "…" --task T --context "…"` | Coder, Tester | Hỏi Master |
| `ag answer D "…" --source <nguồn>` | Master | Trả lời khi có nguồn |
| `ag escalate D --options "A,B"` | Master | Chuyển câu hỏi lên chủ dự án |
| `ag decide D "…"` | Chủ dự án (TTY) | Trả lời câu hỏi |
| `ag bug "…" --task T --severity s --repro "…"` | Tester, Master | Báo lỗi |
| `ag verify T --evidence "…"` | Tester (Master khi `solo`) | Xác nhận đạt |
| `ag merge T` | Master | Gộp vào nhánh chính |
| `ag gate new / check / pass / fail` | Master / mọi agent / chủ dự án (TTY) | Cổng xác nhận |
| `ag approve-agent <ID> --role <vai> [--area …] [--feature F]` | Chủ dự án (TTY) | Duyệt agent mới. `--role master --feature F` duyệt Master luồng (1b) |
| `ag reassign T --to <ID>` | Chủ dự án (TTY) | Chuyển việc ngay |
| `ag push <nhánh>` | Chủ dự án (TTY) | Đẩy code lên remote |
| `ag reply M "…"` | Master | Trả lời tin nhắn trên web (Giai đoạn 3) |
| `ag feature new / list / show / note / priority` | Master / mọi agent / chủ dự án | Tính năng (1b) |
| `ag feature review / ready / merge F` | Master | Mở review, báo xong, gộp tính năng vào nhánh chính (1b) |
| `ag feature start / accept [--push] / reject F` | Chủ dự án (TTY) | Cho bắt đầu làm, nghiệm thu (1b) |
| `ag review ok F --area <cm> [--test-plan <file>]` | Coder, Tester | Xác nhận đã review đủ để làm (1b) |
| `ag ext new / issue / issues --export / verify / check` | Master, Tester | Phụ thuộc bên ngoài (1b) |
| `ag ext delivered / fixed` | Chủ dự án (TTY) | Ghi nhận đội ngoài giao API, báo đã sửa (1b) |
| `ag env` | Mọi agent | In biến môi trường của worktree (`AG_SLOT`, cổng…) (1b) |

Mã thoát: `0` thành công · `1` sai cú pháp · `2` không có quyền · `3` trạng thái không cho phép · `4` lỗi môi trường.

### 13.2 Cấu trúc thư mục trong một dự án

```
<repo>/
  AGENTS.md                      # điểm vào cho mọi AI
  CLAUDE.md, GEMINI.md, …        # 1 dòng: "Đọc AGENTS.md"
  .agents/
    WORKFLOW.md  project.md  roles/  skills/  hooks/  bin/  src/
  .agents-state/                 # nhánh agents-state (không nằm trên nhánh chính)
    assignments.md  registry/  board/  decisions/  bugs/  messages/  journal/  events.jsonl
    features/  externals/        # tính năng F-NNN, phụ thuộc bên ngoài X-NNN (1b)
  contracts/                     # hợp đồng API, chỉ Master sửa (1b, tên thư mục do dự án chọn)
  .agents-local/identity.json    # danh tính của worktree (không đưa lên git)
  .agents-local/env              # AG_SLOT, cổng, tên cơ sở dữ liệu của worktree (1b)
  .env                           # token Telegram (không đưa lên git)
<repo>-wt/<ID>/                  # worktree riêng của từng Coder, Tester
```

### 13.3 Các skill

| Vai | Skill |
|---|---|
| Chung | khởi động, bàn giao, làm tiếp, đặt câu hỏi, sắp hết ngữ cảnh |
| Master | làm rõ yêu cầu, viết đặc tả, viết hợp đồng API, chia việc, trả lời có nguồn, duyệt trước khi gộp, gộp nhánh, khảo sát dự án có sẵn, báo cáo mốc |
| Coder | đọc việc, viết test trước, sửa lỗi, tự kiểm trước khi giao, commit chuẩn |
| Tester | viết ca kiểm thử, kiểm thử thực tế, kiểm thử hợp đồng API, báo lỗi, kiểm lại sau khi sửa |
| Thêm ở 1b | FE: dùng API giả, kiểm thử giao diện · BE: làm đúng hợp đồng, thay đổi dữ liệu · Chung: ghép nối, review đặc tả · Tester: chụp dữ liệu mẫu, kiểm tra API ngoài, kế hoạch kiểm thử · Master: chia tính năng, hợp đồng từ API có sẵn, báo cáo nghiệm thu, xử lý nhiều luồng |

## 14. Câu hỏi thường gặp

**Có bắt buộc dùng nhiều công cụ AI khác nhau không?**
Không. Dùng toàn một công cụ cũng được. Chỉ là chạy được với nhiều công cụ thì không bị khoá vào một hãng.

**Chỉ dùng Claude Code thì có cần lệnh `ag` không, hay dùng subagent là đủ?**
Vẫn cần `ag`. Subagent chỉ giới hạn công cụ trong một phiên. `ag` mới là nơi giữ trạng thái giữa các phiên, chuyển việc giữa các agent, và kiểm tra quyền khi đổi trạng thái.

**Hỏi nhiều quá thì sao?**
Viết kỹ mục "Quy ước code" và "Quyết định chung" trong `project.md`. Mỗi câu đã trả lời là tiền lệ, nên số câu hỏi giảm dần theo thời gian.

**Tốn token không?**
Có tốn hơn so với một AI làm một mình, vì có thêm Master và Tester đọc lại. Bù lại, công sức dồn vào phần kiểm tra độc lập và không phải làm lại khi AI đoán sai. Việc nhỏ thì dùng `team_mode: solo`.

**AI cố tình bỏ qua luật thì sao?**
Hook và lệnh `ag` chặn nhầm lẫn, không chặn được agent cố tình phá trên cùng máy. Lịch sử git (mỗi commit có `Agent-Id`) và bước Master duyệt diff giúp phát hiện ra.

**Tôi có phải ngồi canh không?**
Không. Với mỗi tính năng, bạn chỉ phải vào 4 lần, lần nào cũng có thông báo:
1. trả lời câu hỏi Master không quyết được;
2. cho "bắt đầu làm" sau khi review xong;
3. xác nhận API của đội ngoài (nếu có);
4. nghiệm thu và quyết định push.

Xem mục 5.3.

**Có nên tách vai FE và BE riêng không?**
Không. FE và BE là chuyên môn của Coder: cùng quyền, khác loại việc và thư mục. Tách thành vai riêng thì phải nhân đôi toàn bộ luật mà không được thêm gì.

**BE do đội khác làm, AI có tự liên lạc với họ không?**
Không bao giờ. Bạn là cầu nối. `ag ext issues --export` soạn sẵn danh sách vấn đề để bạn gửi đi.

**Master có bị quá tải khi chạy nhiều tính năng không?**
Không, vì mỗi tính năng có thể có **Master luồng** riêng (`master-F-NNN`). Master luồng chỉ lo tính năng của mình, làm trên nhánh của tính năng. **Master chính** lo hội thoại "Chung", độ ưu tiên giữa các luồng và gộp tính năng vào `main`. Trên web (Giai đoạn 3), mỗi Master là một hội thoại riêng, giống mở nhiều phiên chat.

**Có chạy được trên Windows không?**
Có. `ag` viết bằng Node, không dùng thư viện ngoài. Hook chạy qua Git Bash.

**Muốn đổi tên vai sang tiếng Anh hoặc thêm vai Reviewer?**
Đổi câu chữ thì sửa `templates/` (mục 10.5). Thêm vai thì phải sửa cả code của `ag`.

---

*Tài liệu gốc chi tiết hơn: `README.md` (thiết kế và các quyết định), `dac-ta/giai-doan-1.md` (đặc tả và tiêu chí chấp nhận), `templates/` (luật mà agent đọc).*
