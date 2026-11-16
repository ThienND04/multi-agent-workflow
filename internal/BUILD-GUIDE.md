# Hướng dẫn thực hiện Giai đoạn 1 và 1b, từng bước

Tài liệu cho **chủ dự án**: làm gì, theo thứ tự nào, mở phiên AI nào, dán lời nhắn gì, kiểm tra gì, từ hôm nay cho tới khi lệnh `ag` chạy được đầy đủ.

- Muốn hiểu workflow là gì thì đọc [WORKFLOW-GUIDE.md](WORKFLOW-GUIDE.md).
- File này chỉ nói **cách làm**.

---

## 0. Bức tranh chung

Ta dùng chính workflow này để xây lệnh `ag`. `ag` chưa có, nên quá trình chia làm 2 chặng:

```
CHẶNG A: LÀM TAY                                ★ MỐC CHUYỂN          CHẶNG B: DÙNG ag
Đợt 1 → Đợt 2 → Đợt 3 → Đợt 4 → Đợt 5    ──▶   ag init trên    ──▶   Đợt 6 → 7 → 8 → 9 → 10
(lõi ag: khung, trạng thái, init, checkin,       chính repo này        (phần còn lại của Giai đoạn 1,
 task/status, claim, inbox, hỏi đáp, bug,                              toàn bộ 1b, kiểm chứng cuối)
 verify/merge, hook)
```

**Bảng đợt.** Đã xếp sao cho các việc trong cùng một đợt **không phụ thuộc nhau và không sửa chung file**:

| Đợt | Việc | Số Coder chạy song song | Ghi chú |
|---|---|---|---|
| — | T-004 (tài liệu agent) | — | **Bạn duyệt trước Đợt 5**, vì T-012 cần nó |
| 1 | T-001 | 1 | Khung CLI |
| 2 | T-002 | 1 | Lõi trạng thái |
| 3 | T-003, T-005 | 2 | `init`; `checkin` và duyệt agent |
| 4 | T-006 | 1 | `task`, `status` |
| 5 | T-007, T-008, T-009, T-010, T-011, T-012 | tối đa 6 (nên 3 + 3) | Phần còn lại của lõi |
| ★ | Mốc chuyển sang `ag` | — | Mục 4 |
| 6 | T-014, T-016, T-017, T-018 | 4 | `push`, `plan`/`step`, tiếp quản, cổng |
| 7 | T-019, T-020, T-021, T-023 | 4 | Liên kết hai repo; **bắt đầu 1b**: chuyên môn, tính năng, phụ thuộc ngoài |
| 8 | T-022, T-024, T-026, T-027 | 4 | Hợp đồng và ghép nối, chạy song song, vòng đời tính năng, hộp thư Master |
| 9 | T-028 | 1 | Master chính và Master luồng |
| 10 | T-013 | Tester | Kiểm chứng đầu-cuối cho cả 1 và 1b |
| bất kỳ | T-015 (sau T-004), T-025 (sau T-015) | Master | Bộ skill. Cần xong trước Đợt 10 |

**Mỗi việc code đều đi đúng vòng:**

```
Coder làm ──▶ in_test ──▶ Tester kiểm tra ──▶ verified ──▶ Master gộp ──▶ done ──▶ bạn push
                              │
                              └── trượt: báo lỗi B-NNN, việc về reopened, Coder sửa
```

## 1. Chuẩn bị (một lần)

### 1.1 Máy và công cụ

```bash
git --version
```
```bash
node --version
```
Cần Git ≥ 2.38 và Node ≥ 20. Máy hiện tại đã đủ: Git 2.45, Node 20.10.

**Chuẩn bị ít nhất 2 công cụ AI chạy được lệnh**, ví dụ Claude Code và Codex CLI, hoặc Gemini CLI. Kịch bản kiểm chứng cuối bắt buộc có 2 công cụ khác nhau.

### 1.2 Các phiên AI bạn sẽ mở

| Phiên | Vai | Gợi ý | Mở khi |
|---|---|---|---|
| Master | Master | Một phiên Claude Code dùng lâu dài, mở ở thư mục repo | Ngay bây giờ |
| `coder-01`, `coder-02`… | Coder | Trộn công cụ: số lẻ một công cụ, số chẵn công cụ khác | Mỗi đợt |
| `tester-01` | Tester | **Khác công cụ** với Coder của việc đang kiểm, nếu được | Khi có việc `in_test` |

**Quy tắc ID:**
- Một phiên AI một ID.
- Phiên mới **làm tiếp** việc của phiên cũ thì dùng lại đúng ID cũ, mở trong đúng thư mục worktree cũ.
- Phiên mới **làm việc mới** thì dùng ID mới.

### 1.3 Mở phiên Master

Mở công cụ AI ở thư mục repo, dán:

```text
Đọc internal/DESIGN.md, AGENTS.md, specs/phase-1.md, specs/phase-1b.md và internal/BUILD-GUIDE.md.
Vai của bạn: Master trong giai đoạn tự khởi động (làm tay, chưa có lệnh ag).
Việc của bạn: trả lời câu hỏi trong specs/questions/ khi có nguồn, chuyển lên tôi khi không có nguồn;
gộp nhánh các việc đã verified theo mục 3.4 của internal/BUILD-GUIDE.md; commit các thay đổi trạng thái trong specs/;
làm các việc vai Master (T-004, T-015, T-025). Không viết code trong src/, bin/, test/. Không push.
Đầu mỗi lượt trao đổi, kiểm tra specs/questions/ và các file việc có status in_test hoặc verified trước.
```

### 1.4 Duyệt T-004

Đọc 6 file trong `templates/`: `AGENTS.md`, `WORKFLOW.md`, `project.md`, và 3 file trong `roles/`.
- Cần sửa: nói với Master.
- Đạt: nói với Master *"duyệt T-004"*. Master chuyển T-004 sang `done`.

**Phải xong trước Đợt 5**, vì T-012 (hook) cần T-004.

## 2. Bốn lời nhắn mẫu (dùng cho Chặng A)

Thay phần trong `<…>`.

**A. Giao việc cho Coder**, mỗi việc một phiên mới:
```text
Đọc AGENTS.md trong thư mục này và làm theo.
ID của bạn: <coder-NN>. Vai: Coder. Việc được giao: <T-NNN> (specs/tasks/<T-NNN>.md). Công cụ: <tên công cụ>.
Đọc internal/DESIGN.md mục 3, 4, 9; specs/phase-1.md mục 2, 3, 7 và mục đặc tả mà việc trỏ tới (khoá spec:).
Chỉ sửa đúng các file trong khoá files: của việc. Chỗ nào chưa rõ thì tạo câu hỏi theo AGENTS.md mục 4, không tự quyết.
Ghi bàn giao sau mỗi bước lớn. Xong thì chạy node --test, đặt việc sang in_test, ghi bàn giao. Không tự đánh dấu verified hay done. Không push.
```

**B. Giao Tester kiểm tra**, khi việc có `status: in_test`:
```text
Đọc AGENTS.md trong thư mục này và làm theo.
ID của bạn: tester-01. Vai: Tester. Việc: kiểm tra <T-NNN> (specs/tasks/<T-NNN>.md), đang ở in_test. Công cụ: <tên công cụ>.
Tạo worktree riêng (xoá worktree tester cũ nếu còn):
  git worktree add --detach ../multi-agent-workflow-wt/tester-01 <nhánh trong khoá branch: của việc>
Đối chiếu TỪNG tiêu chí A-… mà việc yêu cầu và mục 7 của specs/phase-1.md. Chạy node --test, chạy thử lệnh bằng bin/ag.
Đạt: đặt verified, ghi bằng chứng (lệnh đã chạy và kết quả) vào bàn giao.
Trượt: tạo specs/bugs/B-NNN.md (hiện tượng, cách tái hiện, bằng chứng), đặt reopened. Không sửa code.
```

**C. Nhờ Master gộp**, khi việc có `status: verified`. Nói trong phiên Master:
```text
<T-NNN> đã verified. Gộp theo mục 3.4 của internal/BUILD-GUIDE.md.
```

**D. Làm tiếp khi một phiên AI bị dừng hoặc hết token.** Mở phiên mới **trong đúng thư mục worktree cũ** (`../multi-agent-workflow-wt/<ID>`), dán:
```text
Đọc AGENTS.md (ở thư mục repo chính) và làm theo. ID của bạn: <ID cũ> (làm tiếp phiên trước bị dừng). Việc: <T-NNN>.
Đọc ghi chú bàn giao trong file việc, xem git log và git status của worktree này, chạy node --test để thấy hiện trạng,
rồi làm tiếp từ chỗ còn dở. Ghi bàn giao trước khi làm tiếp.
```

## 3. Chặng A: làm tay, Đợt 1 đến Đợt 5

### 3.1 Một đợt diễn ra thế nào

1. **Bạn mở các phiên Coder** của đợt, mỗi việc một phiên, dán lời nhắn A. Các việc trong cùng đợt chạy song song được.
2. **Coder làm.**
   - Chỗ không rõ thì Coder tạo câu hỏi `specs/questions/D-NNN.md` và dừng việc đó.
   - Master trả lời nếu có nguồn. Không có nguồn thì Master báo bạn trong phiên Master.
   - Bạn trả lời trong phiên Master, Master ghi lại vào file.
3. **Việc nào sang `in_test`:** bạn mở phiên Tester, dán lời nhắn B.
4. **Tester:**
   - trượt: Coder (cùng phiên, hoặc phiên mới với lời nhắn D) sửa lỗi, rồi quay lại bước 3;
   - đạt: sang bước 5.
5. **Việc `verified`:** bạn nói với Master theo lời nhắn C. Master gộp vào `main`.
6. **Hết đợt** (mọi việc `done`): làm bước kiểm tra cuối đợt (mục 3.3), push, rồi sang đợt sau.

**Mỗi đợt, bạn chỉ cần theo dõi 3 chỗ:**

| Xem gì | Ở đâu |
|---|---|
| Việc đang ở đâu | Dòng `status:` và mục "Ghi chú bàn giao" của `specs/tasks/T-NNN.md` |
| Có câu hỏi chờ bạn | Master báo trong phiên Master. Hoặc tìm trong `specs/questions/` các file có `to: owner` |
| Có lỗi | `specs/bugs/B-NNN.md` |

### 3.2 Chi tiết từng đợt

**Đợt 1: T-001 (khung CLI).** 1 Coder.
- Kiểm tra khi xong:
  ```bash
  node --test
  ```
  ```bash
  node bin/ag.js --help
  ```
- `package.json` không có thư viện ngoài. Có file `.gitattributes` để giữ xuống dòng LF.

**Đợt 2: T-002 (lõi trạng thái).** 1 Coder.
- Kiểm tra: `node --test` xanh. Test khoá ghi chạy 20 tiến trình song song không bị trùng số hiệu.

**Đợt 3: T-003 (`ag init`) và T-005 (`checkin`, duyệt agent).** 2 Coder song song. Nên dùng 2 công cụ khác nhau.
- Kiểm tra: thử `ag init` trên một repo nháp:
  ```bash
  git init ../repo-nhap
  ```
  ```bash
  git -C ../repo-nhap commit --allow-empty -m "khoi tao"
  ```
  Rồi chạy `node bin/ag.js init` bên trong `../repo-nhap` và xem các file được tạo ra. Xoá `../repo-nhap` sau khi xem xong.

**Đợt 4: T-006 (`task`, `status`).** 1 Coder.
- Kiểm tra: test bảng chuyển trạng thái phủ đủ mọi ô (A-STS-1).

**Đợt 5: T-007 đến T-012.** Tối đa 6 Coder.
- Nếu thấy khó theo dõi, chia 2 lượt: T-007, T-008, T-009 trước; T-010, T-011, T-012 sau.
- **T-012 cần T-004 đã được bạn duyệt.**
- Kiểm tra cuối đợt: `node --test` xanh trên `main`, và mọi lệnh trong `templates/AGENTS.md` đều có thật (test A-DOC-3 của T-012).

**Trong Chặng A, Master làm song song:**
- T-015 (bộ skill), sau khi bạn duyệt T-004;
- trả lời câu hỏi;
- gộp nhánh.

### 3.3 Cuối mỗi đợt

1. Mọi việc của đợt có `status: done`.
2. Trên `main`:
   ```bash
   node --test
   ```
   Phải xanh hết.
3. Master đã commit hết thay đổi trong `specs/`. `git status` sạch.
4. **Bạn push:**
   ```bash
   git push origin main
   ```
5. Đóng các phiên Coder và Tester đã xong.

### 3.4 Master gộp một việc thế nào (Chặng A)

Master làm trong thư mục repo chính, nhánh `main`:
1. Đọc diff của nhánh việc, đối chiếu với `files:` và tiêu chí của việc, đọc bằng chứng của Tester.
2. Gộp:
   ```bash
   git merge --no-ff agent/<ID>/<T-NNN>
   ```
3. Chạy `node --test`. Đỏ thì huỷ gộp (`git merge --abort` nếu chưa commit, hoặc `git reset --hard ORIG_HEAD` nếu vừa commit, **chỉ sau khi báo bạn**), tạo `B-NNN`, đặt việc `reopened`.
4. Xanh: đặt việc `done`, ghi bàn giao, commit các thay đổi trong `specs/`.
5. Kiểm tra worktree của Coder và Tester không còn thay đổi chưa commit, rồi xoá chúng:
   ```bash
   git worktree remove ../multi-agent-workflow-wt/<ID>
   ```
6. Báo bạn. **Không push.**

## 4. ★ Mốc chuyển sang `ag` (sau Đợt 5)

Sau Đợt 5, `ag` đã có đủ lõi: `init`, `checkin`, duyệt agent, `task`, `status`, `claim`, `handoff`, `inbox`, hỏi đáp, `bug`, `verify`, `merge`, hook. Từ đây, chính repo này chạy bằng `ag`.

| # | Ai | Làm gì |
|---|---|---|
| 1 | Master | Viết `.agents/project.md` cho repo này: `test_cmd: node --test`, `source_dirs: [src/**, bin/**]`, `acceptance_dirs: [test/e2e/**]`, `spec_files: [specs/**, internal/DESIGN.md]`. Bạn duyệt |
| 2 | **Bạn**, trong terminal của bạn | `node bin/ag.js init --existing`. Lệnh in danh sách thay đổi rồi đòi bạn gõ xác nhận |
| 3 | Master | **Chuyển dữ liệu một lần:** chép các file việc, câu hỏi, lỗi từ `specs/` vào `.agents-state/` (`board/`, `decisions/`, `bugs/`), commit trên nhánh `agents-state` với thông điệp "Chuyển trạng thái từ chặng làm tay". Đây là lần **duy nhất** được sửa tay trạng thái |
| 4 | Master | Thay nội dung "giai đoạn tự khởi động" trong `AGENTS.md` ở gốc repo bằng nội dung chuẩn. Thêm ghi chú đầu `specs/task-order.md` rằng từ nay trạng thái nằm trong `.agents-state/`, các file trong `specs/tasks/` chỉ còn là bản lưu. Bạn duyệt |
| 5 | **Bạn** | Duyệt các agent sẽ dùng tiếp, ví dụ `node bin/ag.js approve-agent coder-01 --role coder` (và tương tự với các ID khác) |
| 6 | Master + 1 Coder | **Chạy thử:** Coder `ag checkin` → `ag inbox` → `ag claim` một việc Đợt 6 → làm → `ag status … in_test`. Tester `ag verify`. Master `ag merge`. Đi trọn một vòng thì mốc chuyển đạt |
| 7 | **Bạn** | `git push origin main`. Nhánh `agents-state` có push hay không do bạn quyết (khuyên push, để có bản sao lưu) |

**Từ sau mốc chuyển:**
- Lời nhắn mở phiên rút gọn lại còn:
  ```text
  Đọc AGENTS.md và làm theo. ID của bạn: <ID>. Công cụ: <tên>.
  ```
  Agent tự `ag inbox` và tự nhận việc. Muốn chỉ định việc thì thêm *"Nhận việc <T-NNN>"*.
- Bạn trả lời câu hỏi bằng `ag decide D-NNN "…"` trong terminal của bạn.
- Lời nhắn D (làm tiếp) vẫn dùng được, chỉ thay *"đọc ghi chú bàn giao"* bằng *"chạy ag whoami và ag inbox"*.

## 5. Chặng B: dùng `ag`, Đợt 6 đến Đợt 10

Vòng làm việc vẫn như Chặng A, nhưng đi qua lệnh:

| Ai | Lệnh chính |
|---|---|
| Coder | `ag checkin`, `ag inbox`, `ag claim`, `ag plan`/`ag step` (khi T-016 xong), `ag handoff`, `ag ask`, `ag status … in_test` |
| Tester | `ag claim` việc `in_test`, `ag verify` hoặc `ag bug` + `ag status … reopened --bug` |
| Master | `ag inbox`, `ag answer`/`ag escalate`, `ag merge` |
| Bạn | `ag decide`, `ag approve-agent`, `ag task list`, và `ag push` (khi T-014 xong) hoặc `git push` |

`ag claim` tự từ chối việc chưa đủ phụ thuộc hay trùng phạm vi file, nên bạn không cần tự canh thứ tự nữa. Bảng đợt chỉ còn là gợi ý nên mở bao nhiêu phiên.

**Đợt 6: T-014, T-016, T-017, T-018.**
- Sau T-014: dùng `ag push` thay cho `git push`. Thử `git push` trực tiếp, phải bị hook chặn.
- Sau T-016: Coder bắt đầu dùng `ag plan`/`ag step`.

**Đợt 7: T-019, T-020, T-021, T-023.** Đây là lúc **bắt đầu Giai đoạn 1b**.
- Sau T-020: thử duyệt agent kèm `--area`.
- Sau T-021: thử `ag feature new`. Từ đây, việc thuộc tính năng gộp vào nhánh tính năng.

**Đợt 8: T-022, T-024, T-026, T-027.**
- Sau T-026: có đủ vòng đời tính năng, gồm review, "bắt đầu làm", nghiệm thu `accept --push`.
- **Giai đoạn 1 và 1b gần xong phần code**, chỉ còn T-028.

**Đợt 9: T-028 (Master luồng).**
- Sau T-028: thử duyệt một Master luồng cho một tính năng thử (`ag approve-agent master-F-001 --role master --feature F-001`), rồi mở phiên cho nó trong worktree mà `ag` tạo ra.
- Từ đây, mỗi tính năng có thể có Master riêng. Giao diện chat trên web cho các Master này thuộc Giai đoạn 3.

**Master, trước Đợt 10:** xong T-015 và T-025 (bộ skill). Bạn đọc và duyệt.

**Đợt 10: T-013, kiểm chứng đầu-cuối.** Tester, chạy với **2 công cụ AI khác nhau** cho 2 Coder:
1. Kịch bản A-E2E (8 bước): repo mẫu, 2 Coder song song, câu hỏi lên tới bạn, tắt một Coder rồi làm tiếp, cổng giữa hai repo.
2. Kịch bản A-E2E-1b: hai tính năng song song, FE/BE, phụ thuộc "đội ngoài" giả lập, `AG_SLOT`.
3. Biên bản ghi ở `test/e2e/BIEN-BAN.md`.

**Bạn tham gia trực tiếp ở bước nào thì Tester sẽ nhờ**: trả lời câu hỏi, cho "bắt đầu làm", nghiệm thu. Kịch bản cần đúng các thao tác đó của chủ dự án.

## 6. Hoàn thành

Khi T-013 `done`:
1. Bạn đọc biên bản kiểm chứng. Đạt thì gắn nhãn phiên bản:
   ```bash
   git tag v0.1.0
   ```
   ```bash
   git push origin main --tags
   ```
2. Bước tiếp theo theo lộ trình:
   - dùng `ag` cho dự án thật đầu tiên: app Lịch mua bán, theo [EXAMPLE-STOCK-APP.md](EXAMPLE-STOCK-APP.md);
   - song song, Master viết đặc tả Giai đoạn 2 (Monitor và Telegram).

## 7. Khi có sự cố

| Sự cố | Làm gì |
|---|---|
| Phiên AI hết token, treo, tắt | Lời nhắn D, mở trong đúng worktree cũ, cùng ID |
| Coder làm sai hướng nhiều lần | Đóng phiên đó. Mở phiên mới (có thể đổi công cụ) với ID mới, lời nhắn D, ghi rõ "bỏ cách làm cũ vì …" |
| Hai Coder lỡ sửa chung một file | Master gộp việc nào xong trước. Việc sau bị xung đột thì trả về `reopened`, Coder đó cập nhật nhánh từ `main` rồi giao lại |
| Test trên `main` đỏ sau khi gộp | Master huỷ lần gộp đó (mục 3.4 bước 3), báo bạn |
| Câu hỏi bị treo lâu | Hỏi Master: *"Liệt kê các câu hỏi đang chờ tôi"* |
| Không chắc việc nào đang ở đâu | Hỏi Master: *"Tóm tắt trạng thái mọi việc của đợt hiện tại"*. Sau mốc chuyển thì chạy `ag task list` |

## 8. Các điểm đã duyệt (16/11/2026)

| # | Điểm | Lý do |
|---|---|---|
| 1 | **Mốc chuyển sang `ag` đặt sau Đợt 5**, không phải ngay sau T-003 và T-006. Đã sửa mục 8 của `specs/phase-1.md` | Sau T-006 mới có `task` và `status`, chưa có `claim`, `handoff`, hỏi đáp, `merge`, hook. Chuyển sớm thì phải trộn làm tay với `ag` trong nhiều đợt, dễ sai trạng thái |
| 2 | Lần chuyển dữ liệu một lần ở mốc chuyển (mục 4, bước 3) là ngoại lệ duy nhất của luật "chỉ đổi trạng thái qua `ag`" | Chưa có lệnh nhập dữ liệu, và viết thêm lệnh chỉ để dùng một lần thì không đáng |
| 3 | Thứ tự đợt như bảng ở mục 0 (T-022 tách sang Đợt 8 vì sửa chung thư mục hook với T-020) | Tránh hai Coder sửa chung file |
