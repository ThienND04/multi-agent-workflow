---
description: "Use when: writing, reviewing, or refactoring code. Covers clean code principles, naming, SOLID, DRY, KISS, error handling, modularity, and maintainability for all programming languages."
applyTo: "**/*.py,**/*.ts,**/*.js,**/*.go,**/*.rs,**/*.java,**/*.cs,**/*.rb,**/*.php,**/*.swift,**/*.kt"
---

<!--
Luật riêng của chủ dự án (Đại ca), CHÉP NGUYÊN VĂN từ ~/.claude/CLAUDE.md ngày 2026-11-18.
Mọi agent tuân theo. Cách áp dụng cho dự án nhiều ngôn ngữ nằm ở AGENTS.md mục 8.
Cập nhật: chép lại file gốc đè lên phần dưới, giữ khối chú thích này. Người khác dùng kit thì thay bằng luật của mình.
-->

# CORE CLEAN CODE PRINCIPLES (Prioritized)

## I. MANDATORY RULES (Always follow)

1. **Naming**: Use intention-revealing names. Boolean → is/has. Classes → nouns. Functions → verbs. Max 3 params, else use object. No magic numbers.
2. **Functions**: Do ONE thing. Keep under 30 lines ideally (exceptions allowed if readability remains). Guard clauses over nesting. Command (returns nothing) ≠ Query (returns data).
3. **SOLID**: Single Responsibility first. Open/Closed second. Others as needed.
4. **DRY**: If same logic appears ≥3 times, extract. But duplication in tests is okay if it improves clarity. Do NOT merge similar-looking code serving different business rules.
5. **KISS**: Readable > clever. If a junior dev can't get it in 30 sec, simplify.
6. **Error handling**: Fail fast. Use specific exception types. Never `except: pass` without logging. Include context in errors.
7. **Performance**: Profile before optimizing. Avoid N+1 queries. Use lazy loading when appropriate.
8. **Security**: Validate all external inputs. Use parameterized queries. Never hardcode secrets. Log safely (no PII).
9. **Logging**: Structured logs (key=value). Use correlation IDs. Log enough to debug, not too much.
10. **Comments**: Explain WHY, not WHAT. Delete commented-out code.

## II. PRIORITY WHEN CONFLICTING

When principles conflict (e.g., DRY vs KISS), follow this order:
1. **Correctness & Security** (must work and be safe)
2. **Readability & Maintainability** (KISS over cleverness)
3. **DRY** (only if it doesn't harm readability)
4. **Performance** (only after profiling confirms need)

## III. INTERACTION RULES (CRITICAL)

**BEFORE you write any code**, you MUST:
- Ask clarifying questions if anything is ambiguous (e.g., missing details about inputs, outputs, edge cases, dependencies, or intended behavior).
- Propose at least 2 possible approaches (with pros/cons) and let me choose.
- If I provide a task without a clear plan, ask: *"What's the expected input/output? Any constraints? Are there existing functions I should reuse?"*

**DURING coding**:
- If you realize you need more info, stop and ask.
- After writing a function/component, briefly explain what it does and why you chose that approach.

**AFTER coding**:
- Provide a quick summary of changes.
- Remind me of any potential pitfalls or assumptions made.

## IV. REVIEW CHECKLIST (apply to your output)

- [ ] Names clear and consistent
- [ ] Single responsibility
- [ ] No deep nesting
- [ ] Error handling present
- [ ] No magic numbers/strings
- [ ] No security issues
- [ ] Logging included for key events
- [ ] Code is testable

**Always prioritize clarity and correctness over cleverness or brevity.**
**Always address the user as 'Đại ca' in all responses.**

# Module 
Khi tạo một module ở src/modules, bên trong nên chia ra làm các phần: 

- controllers (nếu có nhiều file thì ném vào folder)
- services/ 
- repositories/ 
- dto: chia nhỏ thành các file, mỗi cái bên trong chứa zod schema và export cả dto được extent từ schema đó, các trường string nên giới hạn độ dài thì thêm max.
- interfaces/: một số interface đầu vào cho services, chia nhỏ thành các file 
- schemas/: lưu các mongodb schema, và một số tag @ApiProperty(...) cho các trường cần hiển thị trên swagger 
- constants/: một số constant 
- utils/: các hàm helper, chia nhỏ thành các file

Đéo được dùng pnpm test hoặc pnpm run test trực tiếp, dùng cái  pnpm run test:cov --maxWorkers=2 thôi (cái lệnh 'pnpm run test:cov --maxWorkers=2' này thì chạy đéo cần hỏi nữa đâu)
Đéo được dùng 'any' và 'unknown'

Always use Context7 MCP tools when I ask about library documentation, API references, or code examples from external packages, without me having to explicitly ask.

# Quy tắc dùng Bash (để khớp permission đã cấu hình, tránh bị hỏi quyền)

- Mỗi lệnh Bash chỉ làm MỘT việc. Đéo nối bằng `&&`, `||`, `;`, `|`. Cần nhiều bước thì gọi nhiều tool call riêng (chạy song song nếu độc lập).
- Đéo dùng `cd <dir> && ...`. Working dir đã đúng rồi; cần thì dùng đường dẫn tuyệt đối hoặc cờ của lệnh (`git -C`, `pnpm --dir`).
- Đéo dùng `$(...)`, backtick, heredoc, `2>&1`, `> file`, `export X=... &&`, hay tiền tố biến môi trường (`FOO=bar cmd`) trừ khi bắt buộc.
- Đọc/tìm file: dùng tool Read / Grep / Glob, đéo dùng `cat`, `head`, `tail`, `grep`, `find`, `ls` qua Bash.
- Sửa file: dùng Edit / Write, đéo dùng `sed`, `awk`, `echo >`, `tee`.
- Chạy test: chỉ dùng đúng `pnpm run test:cov --maxWorkers=2` (đéo thêm/bớt flag, đéo đổi thứ tự, đéo thêm đường dẫn file vào cuối lệnh trừ khi được yêu cầu).
- Dùng đúng dạng lệnh package manager đã được cho phép (`pnpm run <script>`), đéo tự chế biến thể (`npx`, `pnpm exec`, `node_modules/.bin/...`).
- Nếu một lệnh bị từ chối/hỏi quyền: đéo thử lại bằng cách vòng (wrapper, đổi cú pháp để lách).
- Code một số hàm util hoặc những hằng số của dto, những cái mà không dùng nhiều và đơn giản thì cứ cho inline luôn, mục đích là để con người dễ đọc 

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
