# Task Archive: Fix Preload Warning on Navigation Brand Image

- **Date**: 2026-10-22
- **Status**: COMPLETED (QA PASS)
- **Session Mode**: fresh

---

### 1. Goal & Context
Trình duyệt hiển thị cảnh báo hiệu năng trên Console:
```
The resource http://localhost:3000/_next/image?url=%2Ffooday-mark.png&w=32&q=75 was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.
```
Nguyên nhân: Trong `fooday_frontend/src/components/AppShell.tsx`, logo nhỏ `fooday-mark.png` (`width={28}`, Next.js sinh ra URL tối ưu `w=32`) trong `.nav-brand` gắn thuộc tính `preload`. Do `.nav-brand` có CSS `display: none` trên màn hình mobile (và khi app còn ở splash screen / auth check), ảnh được tải trước nhưng không có phần tử nào thực tế render để tiêu thụ, kích hoạt cảnh báo lãng phí tài nguyên mạng của Chrome.

Mục tiêu: Gỡ bỏ `preload` ở icon navigation brand để loại bỏ cảnh báo, tuân thủ best practice của Next.js (chỉ preload ảnh hero/LCP).

---

### 2. Implementation Summary

#### Frontend (`fooday_frontend`)
- **Modified Component** ([`src/components/AppShell.tsx`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/components/AppShell.tsx)):
  - Gỡ bỏ thuộc tính `preload` khỏi thẻ `<Image>` bên trong `.nav-brand-badge`:
    ```diff
    - preload
    ```
  - Giữ nguyên toàn bộ cấu trúc và styling của navigation bar.

---

### 3. Verification & QA Results
- **Git Diff**: Đã kiểm tra diff chỉ thay đổi đúng 1 dòng (xóa `preload` khỏi brand `<Image>`).
- **Frontend Lint**: `npm --prefix fooday_frontend run lint` -> **PASS** (0 errors)
- **Frontend Typecheck**: `.\fooday_frontend\node_modules\.bin\tsc.cmd --project fooday_frontend\tsconfig.json --noEmit` -> **PASS** (0 errors)
- **Backend Compile**: `python -m compileall -q fooday_backend/app` -> **PASS** (0 errors)
