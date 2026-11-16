# Ví dụ đầy đủ: xây app "Lịch mua bán" bằng workflow này

App Android thống kê lịch mua bán cổ phiếu: với mỗi cách "mua ngày này, bán ngày kia", app đếm số lần lãi trong 8 tuần gần nhất. App dùng API giá có sẵn. Đây là kiểu dự án **chỉ có FE, API có sẵn**.

File này viết cho **chủ dự án**: cần chuẩn bị gì, làm gì, theo thứ tự nào.

---

## 0. Điều kiện trước khi bắt đầu

| Cần có | Bắt buộc? | Ghi chú |
|---|---|---|
| Lệnh `ag` đã xong **Giai đoạn 1 và 1b** (bản `v0.1.0`) | **Có** | Xây theo [BUILD-GUIDE.md](BUILD-GUIDE.md). Chưa có `ag` thì chỉ làm tay được, như dự án cũ |
| Telegram (Giai đoạn 2) | Không | Chưa có thì bạn tự xem `ag inbox` và `ag feature list` |
| Trang web văn phòng và Phòng họp (Giai đoạn 3) | Không | Chưa có thì bạn chat với Master trong phiên của công cụ AI, và gõ lệnh `ag` trong terminal |

Mỗi bước dưới đây ghi lệnh terminal. Khi đã có Giai đoạn 3, mỗi lệnh của bạn đều có nút tương ứng trên web.

## 1. Chuẩn bị

### 1.1 Máy

| Cần | Dùng cho | Kiểm tra |
|---|---|---|
| Git ≥ 2.38, Node.js ≥ 20 | Chạy `ag` | `git --version`, `node --version` |
| JDK 17, Android SDK, Gradle (đi kèm dự án) | Build app | `java -version` |
| **Máy ảo Android hoặc điện thoại thật cắm cáp**, có `adb` | **Tester chạy app thật** | `adb devices` liệt kê được thiết bị |

> Bài học từ lần làm trước: Coder báo "21/21 test đạt" nhưng app không mở được. Lần này **Tester bắt buộc cài APK và mở app** trên thiết bị thật hoặc máy ảo. Phải có `adb` thì mới làm được.

### 1.2 Công cụ AI (ít nhất 2 loại)

| Vai | ID | Gợi ý công cụ | Ghi chú |
|---|---|---|---|
| Master chính | `master` | Claude Code | Phiên dùng lâu dài |
| Coder | `coder-fe-01` | Codex | Thêm `coder-fe-02` khi làm song song |
| Tester | `tester-01` | Gemini CLI | **Khác công cụ với Coder.** Chạy trên máy có `adb` |

### 1.3 Những gì bạn cần đưa cho Master

| Thứ | Ví dụ | Đặt ở đâu |
|---|---|---|
| Mô tả nghiệp vụ | Giá lúc 9:30 và 14:30, không dùng giá ATO/ATC, phí 0,3%, cửa sổ 8 tuần, cách tính lãi/lỗ | Kể cho Master trong phiên chat. Master ghi vào đặc tả |
| Nguồn API giá | URL, tài liệu, giới hạn số lần gọi | Kể cho Master |
| Khoá API (nếu có) | `PRICE_API_KEY=…` | **Chỉ** trong file `.env` ở gốc repo. Không dán vào chat, không commit |
| Mã tham chiếu (nếu dùng lại) | `stats-reference.js` của dự án cũ | Chép vào `reference/` |
| Dữ liệu giá mẫu cũ (nếu có) | `fixtures/` HPG, TCB | Chép vào `fixtures/`, hoặc để Tester chụp mới (bước 5) |

## 2. Bước 1: tạo repo và khởi tạo workflow

**Làm lại từ đầu:**
```bash
mkdir lich-mua-ban
```
```bash
cd lich-mua-ban
```
```bash
git init -b main
```
```bash
git commit --allow-empty -m "Khởi tạo"
```
```bash
node ../multi-agent-workflow/bin/ag.js init --master-id master
```

**Tiếp tục code cũ:** mở thư mục code cũ (đã commit hết), rồi:
```bash
node ../multi-agent-workflow/bin/ag.js init --existing
```
Lệnh in danh sách thay đổi, rồi bạn gõ xác nhận.

Từ đây gọi lệnh là `.agents/bin/ag` (Windows: `.agents\bin\ag.cmd`). Dưới đây viết gọn là `ag`.

## 3. Bước 2: điền `project.md`

Mở phiên Master trước (bước 4), rồi nhờ Master soạn file này cùng bạn. Nội dung gần đúng:

```
---
name: lich-mua-ban
test_cmd: ./gradlew testDebugUnitTest
build_cmd: ./gradlew assembleDebug
source_dirs: [app/src/main/**]
acceptance_dirs: [app/src/test/java/acceptance/**]
fixture_dirs: [fixtures/**]
contract_dirs: [contracts/**]
spec_files: [specs/**]
areas: [fe=app/**]
main_branch: main
lease_minutes: 45
live_check_cmd: node tools/live-check.js
---
## Công nghệ
Kotlin, Jetpack Compose, Material 3, Room (cache), DataStore (cài đặt). minSdk 26.

## Quy ước code
- Gói theo tầng: data/, domain/ (StatsEngine thuần Kotlin), ui/.
- StatsEngine không phụ thuộc Android, test bằng JUnit với dữ liệu trong fixtures/.
- Tên màn hình: XxxScreen; ViewModel: XxxViewModel, có factory.
- Không gọi API trong unit test.

## Quyết định chung đã có
- Giá dùng: khớp cuối trong 15 phút sau ATO (9:30) và khớp cuối trước ATC (14:30).
- Phí mặc định 0,3%.
```

Bạn duyệt. Đây là "nguồn" để Coder khỏi phải hỏi những việc nhỏ.

## 4. Bước 3: thêm agent

Chạy trong terminal của bạn. Mỗi lệnh phải gõ xác nhận:
```bash
ag approve-agent coder-fe-01 --role coder --area fe
```
```bash
ag approve-agent tester-01 --role tester --area fe
```

Master đã có sẵn từ lúc `init`.

**Mở mỗi phiên AI** ở thư mục repo, dán:
```text
Đọc AGENTS.md và làm theo. ID của bạn: <ID>. Công cụ: <tên công cụ>.
```
Agent tự check-in, đọc vai, rồi chạy `ag inbox`. Muốn thêm agent về sau thì làm lại đúng bước này với ID mới.

## 5. Bước 4: cùng Master phân tích tính năng đầu tiên

Trong phiên Master:
```text
Tôi muốn xây app Lịch mua bán. Tạo tính năng F-001 "Bảng thống kê mua bán" với độ ưu tiên 1.
<kể nghiệp vụ: đầu vào, đầu ra, cách tính, màn hình, những gì chưa làm ở bản này>
Hỏi tôi đến khi đủ để viết đặc tả có tiêu chí chấp nhận chạy được. Không tự quyết.
```

Master tạo `F-001` (`ag feature new`) và hỏi bạn từng điểm. Ví dụ:
- Ngày nghỉ lễ tính thế nào?
- Mã cổ phiếu nào có sẵn?
- Mất mạng thì hiện gì?

Bạn trả lời ngay trong phiên chat.

## 6. Bước 5: khai nguồn dữ liệu (API có sẵn)

Master làm, bạn duyệt:
1. Tạo phụ thuộc bên ngoài ở trạng thái "đã có":
   ```bash
   ag ext new --title "API giá" --contract contracts/price-api.yaml --owner-team "Nhà cung cấp dữ liệu" --feature F-001 --delivered --env <URL API>
   ```
2. Viết hợp đồng `contracts/price-api.yaml` từ tài liệu của nhà cung cấp.
3. Tạo việc cho Tester: **chụp dữ liệu thật một lần** vào `fixtures/` (ví dụ HPG, TCB, nến 15 phút, 8 tuần), ghi ngày chụp, đối chiếu với hợp đồng.
4. **Bạn duyệt bộ dữ liệu mẫu.** Từ đây mọi test chạy trên bộ này, nên kết quả cố định.
5. Viết `tools/live-check.js`: gọi API thật vài lần để so với hợp đồng. Chạy bằng `ag ext check X-001` khi cần.

## 7. Bước 6: Master viết đặc tả và chia việc

- **Đặc tả** `specs/F-001-bang-thong-ke.md` có:
  - tiêu chí chấp nhận với **số liệu cụ thể** tính từ mã tham chiếu và dữ liệu mẫu (ví dụ "ô TCB thứ 2 → thứ 4 có 8 lệnh, lãi 6/8");
  - mục **"Cách thử"**: cài APK, mở app, xem ô nào, thấy số nào.
- **Việc**, ví dụ:

  | Việc | Nội dung | Phụ thuộc |
  |---|---|---|
  | T-001 | Dựng project Android, build được APK rỗng mở được trên máy | — |
  | T-002 | `StatsEngine` (Kotlin thuần), test bằng `fixtures/` cho đúng số trong đặc tả | T-001 |
  | T-003 | Tầng dữ liệu: gọi API, cache Room, chạy được khi mất mạng | T-001 |
  | T-004 | Màn bảng nhiệt | T-002 |
  | T-005 | Màn chi tiết ô | T-002 |
  | T-006 | Ghép nối: dữ liệu thật, chạy trên máy thật (`type: integration`) | T-003, T-004, T-005 |

- Master mở review: `ag feature review F-001`.

## 8. Bước 7: review đặc tả

- Mở phiên `coder-fe-01` và `tester-01` (lời nhắn ở bước 3). Hai agent tự thấy việc review trong `ag inbox`.
- Coder đọc đặc tả, đặt câu hỏi (`ag ask`), rồi `ag review ok`.
- **Tester viết kế hoạch kiểm thử** phủ từng tiêu chí, gồm cả bước cài APK và mở app trên thiết bị.
- Câu nào Master không có nguồn thì chuyển lên bạn. Bạn xem và trả lời:
  ```bash
  ag inbox
  ```
  ```bash
  ag decide D-NNN "câu trả lời"
  ```
- Review xong, hết câu hỏi: `ag` báo tính năng sẵn sàng bắt đầu.

## 9. Bước 8: cho bắt đầu làm

Đọc lại đặc tả cuối và danh sách việc, rồi:
```bash
ag feature start F-001
```

## 10. Bước 9: làm, kiểm tra, sửa

**Agent tự chạy, bạn không phải giao từng việc:**
- Coder: `ag claim` → `ag plan` → code → `ag step` → `ag status … in_test`. `ag` tự chạy test, đỏ thì không cho giao.
- Tester: nhận việc `in_test`, chạy test, **cài APK lên thiết bị và mở app**. Đạt thì `ag verify`. Không đạt thì `ag bug` kèm ảnh chụp hoặc log, việc trả về cho Coder.
- Master: trả lời câu hỏi, gộp từng việc vào nhánh `feature/F-001`.

**Bạn:**
- trả lời câu hỏi khi được báo;
- xem tiến độ khi muốn:
  ```bash
  ag feature list
  ```
- muốn nhanh hơn thì mở thêm `coder-fe-02` (duyệt như bước 3). T-003, T-004, T-005 chạy song song được.

## 11. Bước 10: nghiệm thu

Khi mọi việc xong, Master chạy `ag feature ready F-001`. Bạn nhận báo cáo:
```bash
ag feature report F-001
```

Tự thử theo mục "Cách thử":
```bash
./gradlew assembleDebug
```
```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Rồi chọn một trong ba:
- **Đạt và đẩy lên GitHub:**
  ```bash
  ag feature accept F-001 --push
  ```
- **Đạt, chưa push:**
  ```bash
  ag feature accept F-001
  ```
- **Chưa đạt:**
  ```bash
  ag feature reject F-001 --bug "mô tả chỗ chưa đạt"
  ```
  Tính năng quay lại "đang làm" kèm lỗi.

## 12. Bước 11: các tính năng tiếp theo, làm song song

Các yêu cầu của dự án cũ thành các tính năng mới, mỗi tính năng đi đúng vòng từ bước 4 đến bước 10:

| Tính năng | Nội dung (yêu cầu cũ) | Ưu tiên gợi ý |
|---|---|---|
| F-002 | Màn hướng dẫn (YC-001) | 3 |
| F-003 | Lọc theo thứ và giờ (YC-002) | 2 |
| F-004 | Icon "nến theo thứ" (YC-003) | 3 |
| F-005 | Chi tiết ô có cột "Giá", "Lên bảng nhiệt" (YC-004) | 2 |

- **Trong lúc F-001 đang làm**, bạn bàn tiếp F-003 với Master. Agent rảnh tự nhận việc của tính năng ưu tiên cao hơn.
- **Muốn mỗi tính năng có Master riêng:**
  ```bash
  ag approve-agent master-F-003 --role master --feature F-003
  ```
  Rồi mở một phiên AI riêng cho nó. Từ Giai đoạn 3, mỗi Master luồng là một hội thoại trong Phòng họp trên web.
- **Hai tính năng sửa chung một màn hình** (ví dụ F-003 và F-005 cùng sửa màn bảng nhiệt): `ag feature new` cảnh báo và hỏi bạn làm tuần tự hay song song.

## 13. Việc của bạn, tóm gọn

| Lúc nào | Bạn làm gì |
|---|---|
| Một lần | Chuẩn bị máy và thiết bị Android, `ag init`, duyệt `project.md`, duyệt agent, đưa nghiệp vụ và nguồn API cho Master, duyệt dữ liệu mẫu |
| Mỗi tính năng, 4 lần | Trả lời câu hỏi · Cho bắt đầu làm · (không cần với API có sẵn: xác nhận đội ngoài) · Nghiệm thu và quyết định push |
| Khi muốn | `ag feature list` xem tiến độ; mở thêm Coder cho nhanh; đổi ưu tiên `ag feature priority` |

## 14. Khi có sự cố

| Sự cố | Làm gì |
|---|---|
| Phiên AI hết token | Mở phiên mới trong đúng worktree cũ, cùng ID: *"Đọc AGENTS.md và làm theo. ID: coder-fe-01 (làm tiếp phiên trước). Chạy ag whoami và ag inbox rồi làm tiếp."* |
| Muốn chuyển việc sang agent khác ngay | `ag reassign T-NNN --to coder-fe-02` |
| API giá đổi định dạng | `ag ext check X-001` báo lệch và tạo câu hỏi cho bạn. Master cập nhật hợp đồng, bạn duyệt, Tester chụp lại dữ liệu mẫu nếu cần |
| App build được nhưng không mở trên máy | Đây là lý do Tester phải chạy máy thật. Tester báo `B-NNN` kèm log `adb logcat`, việc trả về Coder |
| Không biết đang ở đâu | `ag feature list`, `ag task list`, hoặc hỏi Master *"Tóm tắt trạng thái F-001"* |
