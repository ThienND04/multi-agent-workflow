# Lời nhắn giao việc (giai đoạn tự khởi động)

Master soạn, chủ dự án dán vào phiên AI tương ứng. Lời nhắn có ID, vai và việc. Đây chính là sự duyệt agent của chủ dự án.

**Trước khi giao việc đầu tiên:** `main` phải có ít nhất 1 commit. Nếu chưa có, worktree của Coder không tạo được.

## Thứ tự giao

Chi tiết từng bước (mở phiên nào, kiểm tra gì, mốc chuyển sang `ag`): [HUONG-DAN-THUC-HIEN.md](../HUONG-DAN-THUC-HIEN.md). Các việc trong cùng một đợt không phụ thuộc nhau và không sửa chung file.

| Đợt | Việc | Vai | Song song |
|---|---|---|---|
| trước Đợt 5 | T-004 | Chủ dự án duyệt | Đã viết xong, chờ bạn đọc `templates/` |
| 1 | T-001 | Coder | 1 |
| 2 | T-002 | Coder | 1 |
| 3 | T-003, T-005 | Coder | 2 |
| 4 | T-006 | Coder | 1 |
| 5 | T-007, T-008, T-009, T-010, T-011, T-012 | Coder | tối đa 6 (nên 3 + 3) |
| ★ | Mốc chuyển sang `ag` | Chủ dự án + Master | HUONG-DAN-THUC-HIEN.md mục 4 |
| 6 | T-014, T-016, T-017, T-018 | Coder | 4 |
| 7 | T-019, T-020, T-021, T-023 | Coder | 4 (bắt đầu 1b) |
| 8 | T-022, T-024, T-026, T-027 | Coder | 4 |
| 9 | T-028 (Master luồng) | Coder | 1 |
| 10 | T-013 | Tester (2 công cụ AI khác nhau) | — |
| 11 (GĐ2) | T-029 | Coder | 1 |
| 12 (GĐ2) | T-030, T-031, T-033 | Coder | 3 |
| 13 (GĐ2) | T-032, T-034 | Coder | 2 |
| 14 (GĐ2) | T-036 | Tester | — |
| bất kỳ (GĐ2) | T-035 (tài liệu) | Master | — |
| 15 (GĐ3) | T-037 | Coder | 1 |
| 16 (GĐ3) | T-038, T-039, T-041 | Coder | 3 |
| 17 (GĐ3) | T-040, T-042 | Coder | 2 |
| 18 (GĐ3) | T-043 | Coder | 1 |
| 19 (GĐ3) | T-045 | Tester + chủ dự án | — |
| bất kỳ (GĐ3) | T-044 (tài liệu) | Master | — |
| bất kỳ | T-015 (sau T-004), T-025 (sau T-015), xong trước Đợt 10 | Master | — |

Sau mỗi việc code: Tester kiểm tra (`in_test → verified`), rồi Master gộp (`verified → done`).

## Đợt 1: Coder làm T-001

Dán vào một phiên AI bất kỳ (Claude Code, Codex, Gemini CLI…) mở tại thư mục repo:

```text
Đọc AGENTS.md trong thư mục này và làm theo.
ID của bạn: coder-01. Vai: Coder. Việc được giao: T-001 (dac-ta/viec-gd1/T-001.md).
Công cụ của bạn: <tên công cụ>.
Đọc THIET-KE.md mục 3, 4, 9 và dac-ta/giai-doan-1.md mục 2, 3, 7 trước khi viết code.
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

Mở lại phiên Master (phiên này, hoặc một AI bất kỳ với lời nhắn ở HUONG-DAN-THUC-HIEN.md mục 1.3), nói: *"T-001 đã verified, gộp đi"*.
