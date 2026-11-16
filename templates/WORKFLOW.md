# Quy trình chung

File này dùng chung cho mọi dự án, **không sửa theo từng dự án**. Phần riêng của dự án nằm ở `.agents/project.md`.

## 1. Nguyên tắc

1. **Mọi trạng thái nằm trong file và git, không nằm trong đầu agent.** Agent mới đọc file là làm tiếp được.
2. **Ghi trạng thái qua lệnh `ag`, không ghi tay.**
3. **Người làm không tự nghiệm thu.** Tester và Master kiểm tra độc lập.
4. **Không tự quyết.** Mọi lựa chọn phải dẫn được nguồn. Không có nguồn thì hỏi cấp trên.
5. **Chủ dự án là người quyết định cuối cùng** về phạm vi, hành vi và nghiệm thu.

## 2. Vai trò

| Vai | Hỏi ai | Việc chính |
|---|---|---|
| Chủ dự án | — | Duyệt đặc tả, duyệt agent mới, trả lời câu hỏi được chuyển lên, nghiệm thu |
| Master (chỉ 1) | Chủ dự án | Đặc tả, chia việc, trả lời câu hỏi khi có nguồn, kiểm tra lại, gộp nhánh |
| Coder (nhiều) | Master | Viết code và test cho việc được giao |
| Tester | Master | Kiểm thử độc lập, báo lỗi kèm bằng chứng |

Chi tiết từng vai: `.agents/roles/<vai>.md`.

## 3. Nơi lưu

| Thứ | Ở đâu |
|---|---|
| Quy trình, rule, cấu hình | `.agents/` trên nhánh `main` |
| Bảng việc, câu hỏi, lỗi, nhật ký, sự kiện | `.agents-state/` (nhánh `agents-state`). Mọi lệnh `ag` ghi vào đây và tự commit |
| Code của từng việc | Nhánh `agent/<ID>/<T-NNN>`, worktree `<repo>-wt/<ID>/` |
| Danh tính của worktree | `.agents-local/identity.json` (không đưa lên git) |

## 4. Vòng đời một việc

```
draft ──▶ approved ──claim──▶ in_progress ──status──▶ in_test ──verify──▶ verified ──merge──▶ done
                ▲                 │                     │                    │
                │               ask                   bug                  bug / gộp lỗi
                │                 ▼                     ▼                    ▼
                └── có trả lời ── blocked            reopened ◀──────────────┘
                                                        │
                                                      claim ──▶ in_progress
```

| Chuyển | Ai | Điều kiện |
|---|---|---|
| `draft → approved` | Master, chủ dự án | Master chỉ duyệt việc trỏ tới mục đặc tả đã được chủ dự án duyệt |
| `→ in_progress` | Coder | `ag claim`. Các việc phụ thuộc đã `done`, phạm vi file không trùng việc khác đang làm |
| `in_progress → blocked` | Coder, Tester | `ag ask`. Việc được nhả, nhánh và bàn giao giữ nguyên |
| `blocked → approved` | tự động | Mọi câu hỏi trong `blocked_by` đã có trả lời |
| `in_progress → in_test` | Coder | `ag` tự chạy `test_cmd`. Phải xanh, có commit, không còn thay đổi chưa commit |
| `in_test → verified` | Tester (không phải người code việc này) | `ag verify`, kèm bằng chứng |
| `in_test / verified → reopened` | Tester, Master | Kèm `B-NNN` |
| `verified → done` | Master | `ag merge`: gộp, chạy lại test, xanh thì commit |

## 5. Giữ việc và làm tiếp

- `ag claim` giữ việc trong `lease_minutes` phút (khai trong `project.md`, mặc định 30).
- `ag heartbeat` gia hạn. Chạy ít nhất mỗi nửa thời hạn.
- Quá hạn mà không có heartbeat: agent khác `ag claim` được việc đó, trên đúng nhánh cũ.
- **Bàn giao 3 ý** (`ag handoff`) là thứ duy nhất nối hai agent với nhau:
  - **Đã làm:** việc gì đã xong, commit nào.
  - **Còn dở:** chỗ nào đang làm, file nào, chạy được chưa.
  - **Bước tiếp theo:** đủ cụ thể để người khác làm ngay, không cần hỏi lại.
- Ghi bàn giao trước khi dừng và sau mỗi bước lớn. Không ghi đè bàn giao cũ.

## 6. Hỏi và trả lời

```
Coder / Tester ──ag ask──▶ Master ──có nguồn──▶ ag answer --source <nguồn>
                              │
                              └─ không có nguồn ─▶ ag escalate ─▶ chủ dự án ─▶ ag decide
```

- **Ranh giới:** chi tiết bên trong việc, không đổi hành vi hay giao diện và theo đúng quy ước `project.md`, thì không cần hỏi. Hành vi, giao diện người dùng, định dạng dữ liệu, API, thêm thư viện, đổi cấu trúc thư mục, chỗ mơ hồ hoặc mâu thuẫn thì bắt buộc hỏi.
- Câu hỏi tốt có đủ 3 phần:
  - câu hỏi một dòng,
  - ngữ cảnh (đang làm gì, đọc mục nào của đặc tả),
  - các phương án mà bạn thấy được, nếu có.
- Master chỉ được trả lời khi dẫn được nguồn: mục đặc tả đã duyệt, `D-NNN` đã quyết, `project.md`.
- Mỗi câu chủ dự án đã trả lời là **tiền lệ**. Trước khi hỏi, xem lại các `D-NNN` đã có (`ag task show` liệt kê các câu liên quan tới việc).

## 7. Lỗi

- Tester tạo lỗi bằng `ag bug`, gồm: hiện tượng, cách tái hiện từng bước, bằng chứng (lệnh đã chạy và kết quả).
- Mức độ:
  - `nghiem-trong`: không chạy được, mất dữ liệu, sai kết quả chính.
  - `vua`: sai một phần, có cách tránh.
  - `nho`: hiển thị, câu chữ.
- Coder sửa lỗi phải kèm **test chống tái phát**: một test đỏ trước khi sửa và xanh sau khi sửa.
- Lỗi `nghiem-trong` được ưu tiên trước mọi việc khác trong `ag inbox`.

## 8. Git

- Mỗi agent làm trên nhánh và worktree riêng. Chỉ Master gộp vào `main`, qua `ag merge`.
- Hook kiểm tra mỗi commit: sai vai, ngoài phạm vi `files:`, hoặc sửa file cấm thì bị từ chối. **Không dùng `--no-verify`.**
- Mỗi commit tự có 2 dòng cuối `Agent-Id:` và `Task:`.
- Không `push --force`, không viết lại lịch sử nhánh người khác.
- **Không agent nào được tự `git push`.** Hook `pre-push` chặn mọi lần push không đi qua `ag push`. `ag push` chỉ chủ dự án chạy được, phải gõ xác nhận tên nhánh trong terminal. Agent cần push thì `ag ask` (Coder, Tester) hoặc `ag escalate` (Master) để chủ dự án quyết định.

## 9. Sự kiện

Mọi lệnh `ag` có ghi trạng thái đều thêm một dòng vào `.agents-state/events.jsonl`. Monitor đọc file này để báo Telegram và vẽ trang web. Agent không ghi trực tiếp vào file này.
