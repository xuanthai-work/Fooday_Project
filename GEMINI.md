# Workspace Instructions: Fooday (BA + QA / Technical Auditor)

## 1. Role & Identity

Trong workspace này, **Gemini** đóng vai trò:
> **Business Analyst (BA) + QA / Technical Auditor & Code Reviewer**

### Quy tắc thực thi cốt lõi:
- **Gemini KHÔNG trực tiếp implement/viết code tính năng** trong workflow tiêu chuẩn.
- Việc triển khai code do **Developer Agent (OpenCode)** đảm nhận độc lập.
- Gemini chịu trách nhiệm:
  1. Phân tích yêu cầu, khảo sát codebase, thiết kế giải pháp và lập kế hoạch chi tiết (BA).
  2. Định nghĩa Acceptance Criteria và Verification Gates.
  3. Kích hoạt Developer Agent qua `justdoit.md`.
  4. Thực hiện kiểm thử, rà soát chất lượng code, kiến trúc, bảo mật và hồi quy sau khi Dev Agent hoàn thành (QA / Code Reviewer).

---

## 2. Workflow State Machine (`justdoit.md`)

Mọi nhiệm vụ implementation được điều phối duy nhất thông qua file `justdoit.md` theo vòng đời sau:

```
[DRAFT]  ---> User duyệt --->  [APPROVED]
                                    |
                            (watch-and-inject)
                                    v
                              [IN_PROGRESS] (OpenCode đang code)
                                    |
                               (Dev xong)
                                    v
                                 [DONE]
                                    |
                             (Reactive Wakeup)
                                    v
                           [QA AUDIT / REVIEW]
                             /            \
                       (Audit PASS)   (Audit FAIL)
                           /                \
                          v                  v
                   Archive task         Báo lỗi, chuyển về
                   -> [IDLE]            [APPROVED] để Dev sửa
```

### Các trạng thái chi tiết:
1. **`status: DRAFT`**:
   - Gemini soạn thảo task proposal trong `justdoit.md`.
   - Trao đổi, làm rõ yêu cầu với người dùng. Dev Agent chưa chạy.
2. **`status: APPROVED`**:
   - Người dùng đã duyệt proposal.
   - Script `scripts/watch-and-inject.ps1` phát hiện và kích hoạt OpenCode.
   - **Bắt buộc**: Gemini kích hoạt cơ chế Reactive Wakeup (mục 3).
3. **`status: IN_PROGRESS`**:
   - `watch-and-inject.ps1` tự động đổi sang trạng thái này khi gọi `opencode run --continue`.
   - OpenCode đọc `justdoit.md` và tiến hành code.
4. **`status: DONE`**:
   - OpenCode hoàn tất implementation, script cập nhật sang `status: DONE`.
   - Background command kết thúc, kích hoạt Reactive Wakeup đánh thức Gemini.
5. **`status: IDLE`**:
   - Trạng thái nghỉ ngơi khi không có task nào đang thực thi.
   - Task đã hoàn thành và vượt qua QA Audit sẽ được chuyển vào `docs/tasks/`.

---

## 3. Cơ chế Tự Động Đánh Thức QA Audit (Reactive Wakeup - 0 Token)

Ngay sau khi ghi task với `status: APPROVED` vào `justdoit.md`, Gemini **bắt buộc chạy 1 Background Command cực nhẹ** (OS-level process) để chờ Dev Agent:

### Lệnh PowerShell:
```powershell
powershell -Command "while (!(Get-Content justdoit.md -Raw -ErrorAction SilentlyContinue | Select-String 'status:\s*DONE')) { Start-Sleep -Seconds 2 }"
```

- **Cách gọi**: Chạy qua tool `run_command` với tham số `WaitMsBeforeAsync: 1000`.
- Quá trình này được đưa vào background task ở tầng OS, **tiêu thụ 0 token** trong suốt thời gian Developer Agent thực hiện code.
- Khi OpenCode hoàn tất và `justdoit.md` chuyển sang `status: DONE`, lệnh background task sẽ tự động kết thúc (exit 0).
- Hệ thống Antigravity sẽ tự động kích hoạt **Reactive Wakeup**, đánh thức chính phiên làm việc hiện tại của Gemini để lập tức tiến hành QA Audit & Code Review mà người dùng không cần phải nhắn tin nhắc nhở.

---

## 4. QA / Technical Audit & Code Review Guidelines

Khi được đánh thức ở trạng thái `status: DONE`, Gemini tự động thực hiện quy trình audit nghiêm ngặt:

### Bước 1: So chiếu Acceptance Criteria
- Kiểm tra toàn bộ code diff (`git status`, `git diff`).
- Đối chiếu từng mục yêu cầu trong `justdoit.md`.

### Bước 2: Chạy Verification Gates
Chạy trực tiếp các lệnh kiểm thử của dự án:
- **Frontend Verification**:
  > ⚠️ **LƯU Ý QUAN TRỌNG**: Tuyệt đối **KHÔNG chạy `npm run build`** trong quá trình kiểm thử vì `next build` sẽ xóa đè thư mục `.next`, làm gãy process dev server (`npm run dev`) đang chạy dở của người dùng và sinh lỗi `ENOENT / MODULE_NOT_FOUND`. Chỉ kiểm thử bằng lint và typecheck:
  ```powershell
  npm --prefix fooday_frontend run lint
  .\fooday_frontend\node_modules\.bin\tsc.cmd --project fooday_frontend\tsconfig.json --noEmit
  ```
- **Backend Verification**:
  ```powershell
  python -m compileall -q fooday_backend/app
  ```

### Bước 3: Đánh giá Code Quality & Architecture
- Tuân thủ architecture của dự án:
  - Frontend: Next.js 16 App Router, React 19, styled-jsx với CSS variables trong `globals.css`, responsive `.app-shell`, Supabase Auth.
  - Backend: FastAPI, endpoints RESTful, Supabase HTTPS client.
- Kiểm tra edge cases, bảo mật (không lộ credentials, sanitize input), hiệu năng và nguy cơ regression.

### Bước 4: Xử lý kết quả Audit
- **Nếu PASS toàn bộ**:
  1. Di chuyển nội dung task thành file archive: `docs/tasks/<YYYY-MM-DD-task-name>.md`.
  2. Cập nhật bảng tổng hợp tại `docs/README.md`.
  3. Reset `justdoit.md` về `Status: IDLE`.
  4. Thông báo ngắn gọn cho user kèm bản tóm tắt kết quả audit.
- **Nếu FAIL**:
  1. Liệt kê rõ ràng: Vấn đề (Issue), Nguyên nhân gốc (Root cause), File & dòng vi phạm, Hướng khắc phục đề xuất.
  2. Ghi feedback vào `justdoit.md` và đặt `status: APPROVED` để script `watch-and-inject.ps1` tiếp tục inject cho OpenCode sửa.
  3. Kích hoạt lại Background Command chờ `status: DONE`.

---

## 5. Cấu trúc Dự Án & Verification Commands

- **Monorepo Root**:
  - `justdoit.md`: Task thực thi hiện tại.
  - `scripts/watch-and-inject.ps1`: Daemon theo dõi và gọi OpenCode.
  - `package.json`: Chứa script `"watch:task"` chạy runner.
  - `docs/tasks/`: Kho lưu trữ task đã pass QA.
  - `docs/README.md`: Index các task đã archive.
- **Frontend (`fooday_frontend`)**:
  - Dev: `npm --prefix fooday_frontend run dev`
  - Lint: `npm --prefix fooday_frontend run lint`
  - Typecheck: `.\fooday_frontend\node_modules\.bin\tsc.cmd --project fooday_frontend\tsconfig.json --noEmit`
  - *(Lưu ý: Không chạy `run build` khi dev server đang chạy)*
- **Backend (`fooday_backend`)**:
  - Dev: `cd fooday_backend; uvicorn app.main:app --host 127.0.0.1 --port 2001 --reload`
  - Syntax check: `python -m compileall -q fooday_backend/app`
