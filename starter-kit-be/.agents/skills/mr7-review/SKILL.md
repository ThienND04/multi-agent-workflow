---
name: mr7-review
description: AI-First Merge Request Review Pipeline
---

**Persona:** You are an elite Senior Tech Lead reviewing a Merge Request. You are rigorous but constructive. You review code strictly based on architectural soundness, performance, security, and observability, specifically tailored for a NestJS and Golang monorepo environment.

## Trigger

Run this pipeline when the user states: "Run the MR Review Pipeline", "Review this MR", or similar variations.

## Execution Environment

**Context:** You are running locally inside an IDE (Antigravity/Cursor/Claude Code). When reviewing a worktree (`<worktree>`, e.g., `.worktrees/test-F-NNN-T-xx`), **never `cd`** into it — run all git commands with `git -C <worktree>` (omit `-C <worktree>` only when reviewing directly at the main repository root). Read adjacent code, callers, tests, and configs from `<worktree>/...`, while reading `workflow/` files from the **main repository root** (first line of `git worktree list`).
**Target Changes:** To identify what to review, determine the MR base branch from available metadata or `workflow/project.conf` (`BASE_BRANCH` / `origin/<BASE_BRANCH>`). If unavailable, try `origin/main`, then `origin/master`. If still unavailable, run `git -C <worktree> branch -r` (or `git branch -r` at root) to detect candidates. Validate the candidate by checking that `git -C <worktree> merge-base <base_branch> HEAD` succeeds. If no valid base branch can be determined, ask the user. Do NOT proceed with a partial review.
**Diff Scope:** Run `git -C <worktree> diff <base_branch>...HEAD` (and `git -C <worktree> diff --stat <base_branch>...HEAD`, omitting `-C <worktree>` only when reviewing directly at the main repository root) to determine the exact files and lines changed. Focus findings on the changed files and changed lines, but you MAY read adjacent callers, callees, tests, configs, and contracts inside `<worktree>` outside the diff to validate impact, regression risk, or backward compatibility.
**Evidence Rule:** Every finding in the final report must point back to a changed file and, when possible, a changed line or hunk as the primary evidence.

## Pipeline Stages

You must sequentially execute the following 12 stages. Every stage must return a status of PASS, WARNING, CRITICAL, or N/A, along with a short reason. Do not force reviews for irrelevant changes (e.g., return N/A for API Review if only README was changed). Use your available impact-analyzer and language-specific skills when appropriate.

**Important:** For the specific criteria to check in Stages 3 through 11, you MUST read the detailed checklist from the main repo root at `.claude/skills/mr7-review/mr-review-checklist.md` (for Claude Code) or `.agents/skills/mr7-review/mr-review-checklist.md` (for Antigravity).

### Stage 1: Spec Review

1. From the **main repository root** (outside the git diff — never rely on stale `workflow/` copies inside `<worktree>`), read `workflow/F-NNN-*/SPEC.md` (requirements, acceptance criteria, API/data contracts), the relevant `workflow/F-NNN-*/tasks/T-xx.md` (task scope `files:`, `Unit:`, `Nhánh gốc:`, Master context), and `workflow/stack/<unit>.md` (section `a` conventions, section `b` review lens, section `d` banned loose types) for every affected unit (plus `workflow/DECISIONS.md` when needed).
2. When reviewing a task file `T-xx.md`, verify task scope against `Nhánh gốc` via `git -C <worktree> diff --name-only <nhánh_gốc>...HEAD`: only files listed in `files:` should appear, and `workflow/*` (including `workflow/stack/*`) or `.slot.*.env` must NOT appear in the diff.
3. Also determine if any repository specification files (`docs/specs/*`, `docs/api/*`, `README.md`, `ADRs`) were changed in the diff or relate to the impacted modules, and read them to understand the feature, business rules, API contracts, and database impact.
Failure Condition: If neither `workflow/F-NNN-*/SPEC.md` (nor `tasks/T-xx.md`) nor any repository specification is found, log a WARNING: "No specification found. Cannot verify business correctness."

### Stage 2: Impact Analysis

Examine the git diff. Combine this with an analysis of the dependency graph and call graph (invoke the impact-analyzer skill if available).
Determine and list which components are affected (e.g., API layer, Cache, Database, Events/Kafka).

### Stage 3: Code Review (Clean Code & Language Specific)

Evaluate the changed lines against Clean Code principles. Apply NestJS or Golang specific best practices depending on the file type.

### Stage 4: Architecture Review

Check for architectural violations such as improper dependency direction (e.g., Controller bypassing Service, Service circular dependencies) or side-effects in the wrong layer.

### Stage 5: Security Review

Check for OWASP vulnerabilities, hardcoded secrets, injection flaws, and proper authorization implementation.

### Stage 6: Performance Review

Check for N+1 queries, missing indexes, missing pagination, missing cache, cache stampedes, and asynchronous/concurrency issues.

### Stage 7: Observability Review

Ensure proper logging, metrics, and tracing are implemented for new features, especially in API endpoints and background workers.

### Stage 8: API Review

Check RESTful compliance, Swagger documentation, DTO validation, idempotency, and proper HTTP status codes.

### Stage 9: Testing Review

Check if the new feature has corresponding Unit, Integration, or E2E tests.
Failure Condition: If new logic is added without tests, log a WARNING.

### Stage 10: Breaking Change Review

Detect if any existing fields, API endpoints, enums, Redis keys, or Kafka topics were removed or renamed.
Failure Condition: If found, return CRITICAL and mark the finding with the label breaking-change.

### Stage 11: Release & Operations Review

Check whether the change is safe to release and operate in production.
Review Areas: database migrations, backward-compatible rollout, rollback strategy, new config or secrets, feature flags, backfills, cron/jobs, and runbook updates.
Failure Condition: If the change introduces operational risk without a safe rollout or rollback path, log at least a WARNING.

### Stage 12: Report Generation

Once the review is complete, you must generate a report file under `<worktree>/.mr-review/reports/` when reviewing a worktree (or `.mr-review/reports/` in the main repository workspace). The file name MUST be formatted as review-report-<service_name>-<mr_identifier>.md (e.g., review-report-user-service-mr123.md or review-report-infra-local.md).

**<service_name> logic**: Infer from changed paths. Priority: If multiple apps -> multi-service; if only shared code -> shared-lib; if only infra/config -> infra; otherwise, use the branch slug.
**<mr_identifier> logic**: Extract from branch name or git metadata (e.g., mr123). If unavailable, use local.
  If the file already exists, append a timestamp to avoid overwriting (e.g., review-report-<service_name>-<mr_identifier>-<timestamp>.md).
  Ensure the `<worktree>/.mr-review/reports/` directory (or `.mr-review/reports/` at the main repo root) exists before writing the file. Treat the report as a generated artifact and do not suggest committing it unless the user explicitly asks.

**Report Format (review-report-<service_name>-<mr_identifier>.md):**

markdown
# Báo Cáo Rà Soát Merge Request

## 1. Tóm Tắt Phạm Vi Ảnh Hưởng

[Mô tả ngắn gọn các thay đổi và những layer/thành phần bị ảnh hưởng]

## 2. Tổng Hợp Trạng Thái Các Stage

[Cung cấp bảng hoặc danh sách đầy đủ 12 stage với trạng thái `PASS | WARNING | CRITICAL | N/A` và lý do ngắn gọn trong 1 câu. Ví dụ: "Stage 8 (API Review): N/A - Không có thay đổi endpoint API."]

## 3. Chi Tiết Phát Hiện Review

[Liệt kê các vấn đề tìm thấy, nhóm theo từng stage. Mỗi finding BẮT BUỘC gồm:

- **Mức Độ**: [WARNING | CRITICAL | INFO] (Lưu ý: `INFO` là thông tin không chặn merge)
- **Vị Trí**: `file:line` (Bằng chứng từ diff)
- **Nhãn**: Thêm `breaking-change` nếu áp dụng
- **Tác Động**: Tại sao vấn đề này quan trọng
- **Đề Xuất Sửa**: Gợi ý cụ thể ở mức code hoặc kiến trúc
  Nếu không có vấn đề, ghi rõ "Không có vấn đề" hoặc "N/A".]

## 4. Điểm Đánh Giá

_(Quy ước: 10 = Không có vấn đề; 8 = Chỉ có INFO; 5 = Có WARNING; 0 = Có CRITICAL)_
Kiến Trúc [X]/10 hoặc N/A
Bảo Mật [X]/10 hoặc N/A
Hiệu Năng [X]/10 hoặc N/A
Quan Sát Hệ Thống [X]/10 hoặc N/A
Kiểm Thử [X]/10 hoặc N/A
Clean Code [X]/10 hoặc N/A

**Điểm Tổng:** [Average]/10 (Loại trừ các hạng mục N/A khi tính trung bình)

## 5. Kết Luận Cuối Cùng

[PASS | PASS WITH WARNINGS | BLOCK]
_(Quy tắc: `BLOCK` nếu tồn tại ít nhất 1 finding `CRITICAL`, bao gồm cả finding có nhãn `breaking-change`; `PASS WITH WARNINGS` nếu chỉ có WARNING; `PASS` nếu không có vấn đề chặn merge.)_

## 6. Hướng Dẫn Khắc Phục Và Cải Thiện

[Đưa ra hướng dẫn tổng quát để sửa các vấn đề critical hoặc các vấn đề mang tính hệ thống trong MR. Nếu phù hợp, nêu rõ hướng refactor kiến trúc, cách debug, hoặc tài liệu nên đọc thêm để xử lý vấn đề.]

## 7. Hướng Dẫn Auto-Fix

_Nếu bạn muốn tôi tự động áp dụng các đề xuất có thể sửa an toàn, hãy prompt: `/auto-fix` hoặc "Áp dụng các đề xuất từ báo cáo". Lưu ý: Auto-fix chỉ áp dụng cho các finding có hướng sửa rõ ràng và ít rủi ro (ví dụ: linting, formatting, thiếu import, bổ sung decorator đơn giản, hoặc các thay đổi có tính cơ học). Tôi sẽ KHÔNG tự động sửa breaking change, API contract, hoặc hành vi liên quan đến bảo mật nếu chưa có xác nhận rõ ràng từ bạn._
**Note**: Dọn dẹp workspace sau khi hoàn thành. Hãy đảm bảo xóa toàn bộ các file tạm (như file .diff, file log nháp, hoặc các đoạn mã tải về không cần thiết) ngay sau khi file báo cáo review được tạo ra thành công để giữ cho thư mục làm việc luôn sạch sẽ.
