# Cách hoạt động

## 1. Bài toán

Tôi là developer. Tôi muốn giao việc cho nhiều AI agent, nhưng:
- tôi **chỉ nói chuyện với một agent: Master**;
- Master cùng tôi làm rõ yêu cầu, rồi giao cho các agent khác (Coder, Tester). Các agent này có thể dùng **bất kỳ AI nào**;
- không agent nào tự đoán khi chưa rõ;
- tôi là người quyết định cuối: tính năng xong hay chưa, có push hay không.

## 2. Các vai và cách chúng trao đổi

```
                 ┌─────────────┐
                 │     BẠN     │   chỉ chat với Master · nghiệm thu · push
                 └──────┬──────┘
                        │ chat
                 ┌──────▼──────┐
                 │   MASTER    │   làm rõ, viết tài liệu, chia việc,
                 └──────┬──────┘   trả lời câu hỏi, gộp code
                        │ đọc / ghi file
  ┌─────────────────────▼──────────────────────┐
  │  "Bảng tin" chung: workflow/F-001-…/       │
  │  SPEC.md · tasks/ · questions/ · bugs/     │
  │  mỗi file có dòng  to: <ai đang phải làm>  │
  └─────────▲──────────────────────────▲───────┘
            │ đọc / ghi file           │ đọc / ghi file
      ┌─────┴─────┐              ┌─────┴─────┐
      │   CODER   │              │  TESTER   │   AI bất kỳ: Claude, Codex,
      └─────▲─────┘              └─────▲─────┘   Gemini, Antigravity…
            │ đánh thức                │ đánh thức (hoặc báo bạn)
  ┌─────────┴──────────────────────────┴───────┐
  │  watch.sh: quét file, ai có việc thì gọi   │   không tốn token khi rảnh
  └────────────────────────────────────────────┘
```

**Quy tắc cốt lõi:** mỗi file cần ai đó làm gì đều có dòng **`to:`** ghi tên người đang phải làm. Làm xong phần của mình thì **đổi `to:` sang người kế tiếp**.

**Script `watch.sh`** quét các file đó vài chục giây một lần:
- **Không tốn token**, vì chỉ là script đọc file.
- File chờ một agent chế độ **`subagent`**: script không làm gì, vì **Master tự gọi** agent đó ngay trong phiên chat. Đây là chế độ mặc định, chỉ cần ứng dụng Claude desktop.
- File chờ một agent chế độ **`auto`** (Claude Code, Codex, Gemini CLI dòng lệnh): script mở cho agent đó một phiên mới bằng lệnh không tương tác, kèm danh sách file cần xử lý.
- File chờ một agent **đánh thức tay** (ví dụ Antigravity, không chạy được bằng lệnh) hoặc chờ **bạn**: script báo lên màn hình và qua Telegram.
- Sinh **`STATUS.md`**: bảng ai đang làm gì, ai đang chờ gì.

## 3. Một tính năng đi từ đầu đến cuối

```
① Bạn + Master làm rõ yêu cầu → Master viết SPEC.md, chia việc → bạn nói "duyệt"
② Master giao việc (to: coder-01, to: tester-01) → Master gọi họ (hoặc watch.sh đánh thức) → họ KHẢO SÁT
③ Chưa rõ → họ ghi câu hỏi (to: master-F-001) → Master trả lời nếu có nguồn;
   KHÔNG chắc → câu hỏi chuyển sang to: owner → watch.sh báo bạn → bạn bàn với Master, chốt
④ Rõ hết → Master mở cho làm (to: coder-01) → Coder code → to: tester-01 → Tester kiểm tra
   ⇄ có lỗi thì to: coder-01 để sửa
⑤ Đạt → to: master-F-001 → Master viết báo cáo → to: owner → watch.sh báo bạn
⑥ Bạn thử → "đạt": Master gộp code, BẠN push   /   "chưa đạt": quay lại ④
```

**Bạn chỉ phải quyết định 3 lần cho mỗi tính năng:**
1. bàn yêu cầu và nói "duyệt";
2. trả lời những câu Master không chắc;
3. nghiệm thu và push.

Ngoài ra, khi `watch.sh` báo có việc chờ Master, bạn nói với Master một câu *"Xử lý việc đang chờ"*. Lý do: Master là phiên bạn đang chat, nên mặc định không chạy tự động. Có thể cho Master tự xử lý cả khi bạn vắng mặt (xem `SETUP.md`, bước 4).

## 4. Mười bốn yêu cầu và cách đáp ứng

| # | Yêu cầu | Cách đáp ứng |
|---|---|---|
| 1 | Master cùng tôi làm rõ, viết tài liệu, chia việc cho cấp 2 | Master hỏi tới khi đủ, viết `SPEC.md` (tiêu chí kiểm được, mục "Cách thử") và các file việc nhỏ |
| 2 | Cấp 2 khảo sát, hỏi chỗ chưa rõ; Master giải quyết; không chắc thì hỏi tôi | Bước ② ③. Mỗi câu hỏi là một file `questions/D-NN.md`, chuyển qua lại bằng `to:` |
| 3 | Rõ mới code; test lỗi thì Coder sửa; đạt thì báo Master, Master báo tôi; tôi quyết và push | Bước ④ ⑤ ⑥. Không agent nào được push: file quyền của Claude Code chặn `git push` |
| 4, 11 | Theo dõi mọi agent: trạng thái, việc đang làm | **Trang monitor local** (`node workflow/monitor.js`): văn phòng pixel, mỗi tính năng một dãy bàn (mục 6). Thêm `workflow/STATUS.md` dạng bảng |
| 5, 12 | Thông báo qua Telegram, chỉ một chiều | `watch.sh` gọi `notify.sh` khi có việc chờ bạn hoặc chờ một agent đánh thức tay. Bot chỉ gửi, không nhận lệnh |
| 6 | Không tự quyết theo phán đoán | Mọi câu trả lời phải kèm **nguồn**. Không có nguồn thì chuyển `to: owner` |
| 7 | Mỗi vai có skill riêng | Luật riêng cho từng vai trong `AGENTS.md`. Với Claude Code có thêm file vai trong `.claude/agents/`; skill dùng chung có thể đặt thêm trong `.claude/skills/` |
| 8 | Lưu phiên, agent lỗi thì agent khác làm tiếp | Mọi trạng thái nằm trong file (`to:`, `status:`, bàn giao) và trong commit. Mỗi lần đánh thức là một phiên mới, đọc file là làm tiếp được |
| 9 | Tối ưu context và token | Mục 5 |
| 10 | Tôi chỉ làm việc với Master | Đúng. Các agent khác do Master gọi (chế độ `subagent`) hoặc do `watch.sh` đánh thức (chế độ `auto`); bạn không chat với họ |
| 13 | Chọn AI và model cho từng agent | Mỗi agent một dòng trong `workflow/agents.txt`: chế độ (`subagent`, `auto`, `manual`), công cụ, model, tài khoản tuỳ bạn. Master chọn agent phù hợp cho từng việc |
| 14 | Nhiều tính năng cùng lúc, không phải chờ | Mỗi tính năng một thư mục và một Master (`master-F-001`, `master-F-002`). Một `watch.sh` đánh thức agent cho mọi tính năng |

## 5. Tối ưu context và token (yêu cầu 9)

| Cách | Tiết kiệm thế nào |
|---|---|
| **Script quét thay cho AI** | Lúc chờ không tốn token. AI chỉ chạy khi thật sự có việc |
| **Mỗi lần đánh thức là một phiên mới, ngắn** | Không phiên nào phình to vì giữ lịch sử dài. Trạng thái được đọc từ file |
| **Chỉ đọc file có `to:` là mình, cộng những gì `can_doc:` chỉ tới** | Agent không đọc cả dự án |
| **Phiên Master gọn** | Master không đọc code hay log, chỉ đọc tài liệu, câu hỏi và báo cáo ngắn |
| **Model theo việc** | Việc thường giao cho agent dùng model nhanh, rẻ; việc khó giao cho agent dùng model mạnh (khai trong `agents.txt`) |
| **`AGENTS.md` ổn định** | Ít sửa thì công cụ dùng lại được bộ nhớ đệm prompt, rẻ hơn |
| **Tính năng có sẵn của công cụ** | Claude Code: `/compact`, `/clear`, tắt các máy chủ MCP không dùng (`/mcp`), xem mức dùng bằng `/cost` hoặc `/usage` (tuỳ phiên bản) |

## 6. Trang monitor

Chạy `node workflow/monitor.js` (cần Node.js 18 trở lên), rồi mở **http://localhost:4300**.

```
┌─ tường: tủ sách · cửa (mở khi có việc chờ bạn) · bảng các tính năng · cây nước ─┐
│                                                                                 │
│  ┌─ F-001 · Đặt hàng [in_dev] ───────────────────────────────────────────────┐  │
│  │  [bàn lớn] master-F-001    [bàn] coder-01 …    [bàn] tester-01 1          │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│  ┌─ F-003 · Thông báo [in_dev] ──────────────────────────────────────────────┐  │
│  │  master-F-003   coder-01  coder-02  coder-03 …  coder-04  coder-05        │  │
│  │                 tester-02            (dãy dài thì tự xuống hàng)          │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

- **Văn phòng pixel, mỗi tính năng một dãy bàn** có thảm màu riêng. Master ngồi bàn lớn đầu dãy, Coder và Tester ở các bàn kế tiếp. Nhiều tính năng thì nhiều dãy.
- **Bong bóng trên đầu:** `…` đang chạy, số là số việc đang chờ, `z` là rảnh. Agent rảnh đứng ở cây nước. Cửa mở nghĩa là có việc chờ bạn.
- **Bấm vào một agent:** xem file đang chờ nó và log gần nhất.
- **Chỉ đọc**, tự làm mới 3 giây một lần, chỉ mở trên máy bạn. Trang đọc đúng các file mà `watch.sh` đọc, và không cần cài thư viện nào.

**Sau này:** chat với Master và bấm duyệt ngay trên trang (thiết kế trong `specs/phase-3.md`, bản phác trong `internal/mockups/`).

## 7. Chia tài khoản: 2 tài khoản Claude và 1 tài khoản Antigravity

**Bắt đầu (chỉ cần ứng dụng Claude desktop):**

| Agent | Chạy ở đâu | Đánh thức |
|---|---|---|
| Master | Ứng dụng Claude desktop, tài khoản 1 | Bạn chat trực tiếp |
| Coder, Tester | Subagent trong phiên của Master, cùng tài khoản 1 | **Master tự gọi** |
| Tester độc lập (tuỳ chọn) | Antigravity | **Tay**: `watch.sh` báo, bạn mở phiên |

Ở cách này, Coder và Tester **dùng chung hạn mức** với Master.

**Khi cần tách hạn mức:** cài Claude Code dòng lệnh, đăng nhập tài khoản 2 vào thư mục cấu hình riêng (biến `CLAUDE_CONFIG_DIR`), rồi chuyển Coder sang chế độ `auto`. Coder khi đó chạy bằng tài khoản 2, không ăn vào hạn mức của Master. Cách làm từng bước ở `SETUP.md`, bước 3 và 4.

Tính năng thứ hai làm song song: mở thêm một phiên Master (tài khoản 1 hoặc 2).

---

**Triển khai từng bước:** [SETUP.md](SETUP.md).
