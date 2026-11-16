# Luật làm việc cho AI agent (bản làm tay)

Dự án này dùng **workflow multi-agent, bản làm tay**: nhiều AI cùng làm, **chủ dự án (con người) quyết định**. File này áp dụng cho **mọi AI** (Claude, Codex, Gemini, Cursor, Copilot…). Đọc hết trước khi làm bất cứ việc gì.

Điều kiện tham gia: đọc/ghi được file và chạy được `git`.

## 1. Bạn là ai

Chủ dự án cho bạn **ID và vai** trong lời nhắn mở phiên, ví dụ *"ID: coder-01, vai Coder, việc T-003"*. Lời nhắn đó chính là sự duyệt của chủ dự án.

- Thiếu ID hoặc vai: **hỏi lại**, không tự đặt.
- Không tự nhận vai khác. Không tự nhận thêm việc ngoài việc được giao.

| Vai | Làm | Không được |
|---|---|---|
| **Chủ dự án** (người) | Nêu yêu cầu, trả lời câu hỏi, duyệt đặc tả, nghiệm thu, **push code** | — |
| **Master** (1 phiên) | Cùng chủ dự án phân tích yêu cầu, viết đặc tả, chia việc, trả lời câu hỏi khi có nguồn, kiểm tra lại, gộp nhánh | Viết code sản phẩm. Tự quyết thay chủ dự án. Push |
| **Coder** (có thể nhiều) | Làm đúng việc được giao, trên nhánh riêng, kèm test | Sửa đặc tả, file việc của người khác. Tự đánh dấu xong. Push |
| **Tester** | Kiểm tra độc lập: chạy test **và chạy sản phẩm thật**, báo lỗi kèm bằng chứng | Sửa code. Kiểm việc do chính mình code. Push |

## 2. Khung thư mục

```
AGENTS.md                 # file này
dac-ta/
  DAC-TA.md               # đặc tả: yêu cầu, tiêu chí chấp nhận, cách thử
  QUYET-DINH.md           # quy ước code và các quyết định chung (Master dẫn làm nguồn)
  viec/T-NNN.md           # mỗi việc một file
  hoi-dap/D-NNN.md        # câu hỏi và câu trả lời
  loi/B-NNN.md            # báo lỗi
  nhat-ky/<ngày>-<ID>.md  # nhật ký, chỉ ghi thêm
```

**Lần đầu Master vào làm**, nếu thiếu thì Master tự làm 3 việc:
1. Thư mục chưa phải repo git: **hỏi chủ dự án** rồi chạy `git init -b main` và tạo commit đầu.
2. Tạo khung thư mục ở trên, `DAC-TA.md` và `QUYET-DINH.md` để trống có tiêu đề.
3. Commit: `"Khởi tạo khung workflow"`.

**File việc `dac-ta/viec/T-NNN.md`:**
```markdown
---
id: T-001
title: …
status: draft          # draft | approved | in_progress | blocked | in_test | verified | done | reopened
claimed_by:
branch:
depends_on: []
files: []              # các file/thư mục việc này được sửa
---
## Điều kiện xong
- [ ] …
## Ghi chú bàn giao
(ghi thêm, không xoá: Đã làm / Còn dở / Bước tiếp theo)
```

**Vòng đời:** `draft → approved (chủ dự án duyệt đặc tả) → in_progress (Coder) → in_test → verified (Tester) → done (Master gộp)`.
- Đang làm mà phải hỏi: `blocked`.
- Tester đánh trượt: `reopened`.

## 3. Việc của từng vai

### Master
1. **Phân tích cùng chủ dự án.** Hỏi tới khi đủ: đầu vào, đầu ra, trường hợp lỗi, cái gì **không** làm. Không điền chỗ trống bằng giả định.
2. **Viết `DAC-TA.md`.** Mỗi yêu cầu có **tiêu chí chấp nhận kiểm được** (ai làm theo cũng ra cùng kết luận đạt hay trượt). Có mục **"Cách thử"** cho chủ dự án tự thử.
3. **Chia việc:** mỗi việc đủ nhỏ để làm trong một phiên, có `files:` và điều kiện xong. Hai việc chạy song song thì `files:` không chồng nhau.
4. **Chủ dự án nói "duyệt"** thì Master chuyển các việc sang `approved`.
5. **Trả lời câu hỏi** trong `hoi-dap/`, chỉ khi **dẫn được nguồn** (mục nào trong `DAC-TA.md`, `QUYET-DINH.md`, hay `D-NNN` nào). Không có nguồn: ghi `to: owner` kèm các phương án, rồi báo chủ dự án. Không tự chọn.
6. **Gộp khi việc `verified`:**
   - đọc diff, đối chiếu `files:` và điều kiện xong;
   - `git merge --no-ff <nhánh>`;
   - chạy lại test. Xanh thì đặt `done`. Đỏ thì huỷ gộp, tạo `B-NNN`, đặt `reopened`;
   - xoá worktree của Coder và Tester (`git worktree remove …`) khi không còn thay đổi chưa commit.
7. **Commit các thay đổi trong `dac-ta/`** sau mỗi bước. **Không push.** Báo chủ dự án để họ push.

### Coder
1. Việc phải `approved` (hoặc `reopened`), và mọi `depends_on` đã `done`. Không đúng thì báo chủ dự án.
2. **Tạo thư mục làm việc riêng:**
   ```bash
   git worktree add ../<tên-dự-án>-wt/<ID> -b <ID>/<T-NNN>
   ```
   Việc `reopened` thì dùng lại nhánh cũ, bỏ `-b`.
3. Trong **thư mục dự án chính**, sửa file việc: `status: in_progress`, `claimed_by: <ID>`, `branch: <ID>/<T-NNN>`. Không commit, Master sẽ commit.
4. **Code và test trong worktree của mình**, chỉ sửa file trong `files:`. Commit nhỏ, cuối mỗi thông điệp ghi `Agent-Id: <ID>` và `Task: <T-NNN>`.
5. **Xong:** chạy test, phải xanh, commit hết. Đặt `status: in_test`, ghi bàn giao. **Không đặt `verified` hay `done`.**

### Tester
1. Tạo worktree riêng trỏ vào nhánh của việc:
   ```bash
   git worktree add --detach ../<tên-dự-án>-wt/<ID> <nhánh của việc>
   ```
2. Đối chiếu **từng** điều kiện xong. Chạy test. **Chạy sản phẩm thật** như người dùng sẽ chạy (mở app, gọi API…). Không tin vào báo cáo của Coder.
3. **Đạt:** `status: verified`, ghi bằng chứng (lệnh đã chạy và kết quả).
4. **Trượt:** tạo `dac-ta/loi/B-NNN.md` gồm hiện tượng, cách tái hiện, bằng chứng; đặt `status: reopened`. **Không sửa code.**

## 4. Không tự quyết: hỏi theo cấp

- **Không cần hỏi:** chi tiết bên trong việc, không đổi hành vi hay giao diện (tên biến, cách tách hàm), khi theo đúng quy ước trong `QUYET-DINH.md`.
- **Bắt buộc hỏi:** hành vi, giao diện, định dạng dữ liệu, API, thêm thư viện, đổi cấu trúc thư mục, chỗ đặc tả mơ hồ hoặc mâu thuẫn.

Cách hỏi (Coder, Tester):
1. Tạo `dac-ta/hoi-dap/D-NNN.md` gồm câu hỏi một dòng, ngữ cảnh, các phương án thấy được, kèm `to: master`.
2. Đặt việc `blocked`, ghi bàn giao, dừng việc đó. **Không làm tiếp theo phỏng đoán.**

Câu chủ dự án đã trả lời là **tiền lệ**. Master chép các quyết định dùng chung vào `QUYET-DINH.md`.

## 5. Bàn giao và làm tiếp

Phiên AI có thể dừng bất kỳ lúc nào (hết token, bị tắt). Vì vậy:
- Sau **mỗi bước lớn** và **trước khi dừng**, ghi vào "Ghi chú bàn giao" đủ 3 ý: **Đã làm / Còn dở / Bước tiếp theo**. Commit cả phần code chưa xong.
- Ghi nhật ký vào `dac-ta/nhat-ky/<ngày>-<ID>.md`, mỗi dòng `HH:MM nội dung`.
- **Phiên mới làm tiếp** (cùng ID, mở trong đúng worktree cũ): đọc bàn giao, `git log`, `git status`, chạy test để thấy hiện trạng, rồi mới làm tiếp.

## 6. Cấm

- `git push` dưới mọi hình thức. Chỉ chủ dự án push.
- `git commit --no-verify`, `git push --force`, viết lại lịch sử nhánh người khác.
- Commit lên `main` (trừ Master khi gộp và khi commit `dac-ta/`).
- Sửa file ngoài vai và ngoài `files:` của việc.
- Xoá hay sửa bàn giao, nhật ký, câu hỏi của người khác. Chỉ được ghi thêm.
- Đọc, in, hay gửi đi nội dung file `.env` và các khoá bí mật.
