# Lời nhắn giao việc (giai đoạn tự khởi động)

Master soạn, chủ dự án dán vào phiên AI tương ứng. Lời nhắn có ID, vai và việc. Đây chính là sự duyệt agent của chủ dự án.

**Trước khi giao việc đầu tiên:** `main` phải có ít nhất 1 commit. Nếu chưa có, worktree của Coder không tạo được.

## Thứ tự giao

| Đợt | Việc | Vai | Song song được |
|---|---|---|---|
| 1 | T-001 | Coder | Chỉ 1 việc (mọi việc code khác đều cần T-001) |
| 1 | T-004 | Chủ dự án duyệt | Đã viết xong, chờ bạn đọc `templates/` |
| 2 | T-002 | Coder | — |
| 3 | T-003, T-005 | 2 Coder | Có |
| 4 | T-006 | Coder | — |
| 5 | T-007, T-008, T-009, T-010, T-011, T-012 | tối đa 6 Coder | Có, phạm vi file không chồng nhau |
| 5b | T-014 (`ag push`), T-016 (`plan`/`step`), T-017 (tiếp quản), T-018 (cổng) | tối đa 4 Coder | Có. T-014 cần T-012, T-017 cần T-007 |
| 5c | T-019 (liên kết hai repo) | Coder | — |
| bất kỳ | T-015 (bộ skill) | Master | Chạy song song với mọi đợt |
| 7 (1b) | T-020, T-021, T-022, T-023 | tối đa 4 Coder | Có, sau khi các việc Giai đoạn 1 mà chúng phụ thuộc đã xong |
| 8 (1b) | T-024, T-026, T-027 | tối đa 3 Coder | Có |
| bất kỳ (1b) | T-025 (skill 1b) | Master | Sau T-015 |
| 9 | T-013 | Tester (2 công cụ AI khác nhau cho 2 Coder, cần 2 repo mẫu FE/BE) | — |

Sau mỗi việc code: Tester kiểm tra (`in_test → verified`), rồi Master gộp (`verified → done`).

## Đợt 1: Coder làm T-001

Dán vào một phiên AI bất kỳ (Claude Code, Codex, Gemini CLI…) mở tại thư mục repo:

```text
Đọc AGENTS.md trong thư mục này và làm theo.
ID của bạn: coder-01. Vai: Coder. Việc được giao: T-001 (dac-ta/viec-gd1/T-001.md).
Công cụ của bạn: <tên công cụ>.
Đọc README.md mục 3, 4, 9 và dac-ta/giai-doan-1.md mục 2, 3, 7 trước khi viết code.
Chỗ nào chưa rõ thì tạo câu hỏi theo AGENTS.md mục 4, không tự quyết.
Khi xong, đặt việc sang in_test và ghi bàn giao. Không tự đánh dấu verified hay done.
```

## Kiểm tra T-001: Tester

Dùng một phiên **khác** phiên Coder. Nên dùng công cụ AI khác nếu có:

```text
Đọc AGENTS.md trong thư mục này và làm theo.
ID của bạn: tester-01. Vai: Tester. Việc: kiểm tra T-001 (dac-ta/viec-gd1/T-001.md), đang ở in_test.
Công cụ của bạn: <tên công cụ>.
Tạo worktree riêng ../multi-agent-workflow-wt/tester-01 checkout nhánh trong khoá branch của T-001.
Đối chiếu từng mục "Điều kiện xong" và mục 7 của dac-ta/giai-doan-1.md, chạy node --test và chạy thử bin/ag --help.
Đạt: đặt verified và ghi bằng chứng. Trượt: tạo dac-ta/loi/B-NNN.md rồi đặt reopened.
Không sửa code.
```

## Sau đó: Master gộp

Mở lại phiên Master (phiên này, hoặc một AI bất kỳ với lời nhắn ở README mục 7), nói: *"T-001 đã verified, gộp đi"*.
