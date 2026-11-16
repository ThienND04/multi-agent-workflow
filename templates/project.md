---
name: ten-du-an
test_cmd: npm test
build_cmd: npm run build
source_dirs: [src/**]
acceptance_dirs: [acceptance/**]
fixture_dirs: [fixtures/**]
spec_files: [SPEC.md]
lease_minutes: 30
---
# Cấu hình dự án

File này là **phần riêng duy nhất** của dự án (cùng với `.env`). Mọi thứ khác trong `.agents/` dùng chung, không sửa.

Phần frontmatter ở trên do lệnh `ag` đọc. Chỉ viết `khoá: giá trị` hoặc `khoá: [a, b]` trên một dòng.

| Khoá | Ý nghĩa |
|---|---|
| `name` | Tên ngắn của dự án |
| `test_cmd` | Lệnh chạy toàn bộ test. `ag status … in_test` và `ag merge` chạy lệnh này, mã thoát khác 0 là đỏ |
| `build_cmd` | Lệnh build. Để trống nếu không cần |
| `source_dirs` | Mã nguồn. Master và Tester không được sửa |
| `acceptance_dirs` | Test chấp nhận. Coder không được sửa |
| `fixture_dirs` | Dữ liệu mẫu cố định. Coder không được sửa |
| `spec_files` | Các file đặc tả. Chỉ Master sửa |
| `lease_minutes` | Thời hạn giữ việc (phút) trước khi việc được mở cho agent khác |

## Công nghệ

(Ngôn ngữ, phiên bản, framework, cách cài môi trường.)

## Quy ước code

Theo ranh giới "không tự quyết", Coder **được tự làm** những gì theo đúng mục này mà không cần hỏi. Viết càng rõ thì càng ít câu hỏi.

- Định dạng: (công cụ format, độ thụt lề…)
- Đặt tên: (biến, hàm, file…)
- Cấu trúc thư mục: (đặt code mới ở đâu)
- Xử lý lỗi, ghi log: (cách làm chung)
- Test: (đặt ở đâu, đặt tên thế nào)

## Quyết định chung đã có

(Chủ dự án hoặc Master ghi các quyết định áp dụng cho cả dự án, kèm số `D-NNN` nếu có. Master dẫn mục này làm nguồn khi trả lời câu hỏi.)
