# Implementation Task: Codebase Cleanup & Architecture Hardening

- **Date Completed**: 2026-10-19
- **Status**: QA PASS
- **Reviewer**: Gemini (BA + QA Technical Auditor)
- **Developer Agent**: OpenCode

---

### 1. Objective
Thực hiện dọn dẹp nợ kỹ thuật (technical debt), khai tử các thư viện thừa gây lỗ hổng bảo mật, chuẩn hóa Next.js App Router (tách route nhưng giữ nguyên Shell/Bottom Navigation), vá lỗi build Next.js khi thiếu ENV, và chuẩn hóa CORS / an toàn truy vấn tại Backend.

---

### 2. Changes Delivered
1. **Root Hygiene**:
   - Tạo file `.gitignore` ở monorepo root chặn `.codegraph/`, `.env*`, `node_modules/`, `.venv/`, `.next/`.
2. **Frontend Dependencies**:
   - Gỡ bỏ `@tailwindcss/postcss` và `tailwindcss` khỏi `fooday_frontend/package.json`.
   - Xóa `fooday_frontend/postcss.config.mjs`.
3. **Build Resilience**:
   - Sửa [fooday_frontend/src/lib/supabaseClient.ts](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/lib/supabaseClient.ts) sang fallback an toàn khi thiếu ENV ở build-time.
4. **App Router Standardization**:
   - Tạo [fooday_frontend/src/components/AppShell.tsx](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/components/AppShell.tsx) bao bọc layout bền vững với Navigation Bar (dùng `next/link` và `usePathname()`).
   - Tách thành 4 subpage:
     - `/` (`src/app/page.tsx`)
     - `/chat` (`src/app/chat/page.tsx`, hỗ trợ query param `?q=` bọc trong Suspense)
     - `/random` (`src/app/random/page.tsx`)
     - `/profile` (`src/app/profile/page.tsx`)
5. **Backend CORS & RAG Safety**:
   - Cập nhật [fooday_backend/app/main.py](file:///D:/work/Stuff/Fooday_Project/fooday_backend/app/main.py): Whitelist origin `["http://localhost:3000", "http://127.0.0.1:3000"]`, đổi title thành `"Fooday API"`.
   - Cập nhật [fooday_backend/app/api.py](file:///D:/work/Stuff/Fooday_Project/fooday_backend/app/api.py): Thêm `.order("rating", desc=True).limit(30)` cho RAG query.

---

### 3. QA Verification Results
- `npm --prefix fooday_frontend run lint`: PASS (No lint errors)
- `tsc --project fooday_frontend/tsconfig.json --noEmit`: PASS (Exit 0, no type errors)
- `npm --prefix fooday_frontend run build`: PASS (All routes prerendered statically: `/`, `/_not-found`, `/chat`, `/random`, `/profile`)
- `python -m compileall -q fooday_backend/app`: PASS (Exit 0)
