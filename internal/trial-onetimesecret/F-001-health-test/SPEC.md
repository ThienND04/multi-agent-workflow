---
id: F-001
title: Nền tảng test và endpoint health cho server
lane: full
status: in_dev
to: none
master: master-01
---
## Yêu cầu
Server chưa có script test nào và chưa có endpoint kiểm tra sống. Thêm cả hai để kit và CI có chỗ bám.

## Phương án đã chọn
- Health: chỉ báo tiến trình sống, KHÔNG kiểm DB (đơn giản, không phụ thuộc Mongo). Phương án bị loại: health kiểm cả kết nối Mongo (nặng hơn, test cần mock DB).
- Test: jest + supertest (đã có sẵn trong devDependencies), import `src/app.js`, không khởi động `src/index.js`. Không thêm thư viện.

## Tiêu chí (kiểm được)
1. `GET /api/health` trả 200 và body JSON `{"status":"ok"}`.
2. `GET /api/health` không cần đăng nhập, không chạm DB.
3. Script `test:cov` trong `server/package.json` chạy jest kèm coverage; `sh workflow/run.sh test <wt> server` xanh, có test cho tiêu chí 1.
4. Không đổi hành vi các route hiện có.

## Cách thử
1. `sh workflow/run.sh test <wt> server` xanh.
2. `sh workflow/run.sh serve <wt> server` ở nền, rồi `curl http://localhost:<cổng slot>/api/health -i` thấy 200 và `{"status":"ok"}`.
