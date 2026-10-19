# Implementation Task: Fix Bottom Navigation Styling & Layout (Vertical Icon + Label)

- **Date Completed**: 2026-10-19
- **Status**: QA PASS
- **Reviewer**: Gemini (BA + QA Technical Auditor)
- **Developer Agent**: OpenCode

---

### 1. Objective
Sửa lỗi hiển thị trên thanh Bottom Navigation Bar:
- Chuyển layout của các tab điều hướng (`Home`, `AI Chat`, `Random`, `Profile`) sang dạng chuẩn App Mobile: Icon 22px nằm trên, chữ nhãn 11px nằm ngay dưới theo chiều dọc (`flex-direction: column`).
- Loại bỏ hoàn toàn gạch chân (`text-decoration: underline`) và giữ màu sắc theo token hệ thống.
- Cấu hình Next.js `devIndicators` để nút badge đen ("N") không che mất nút Home ở góc dưới bên trái.

---

### 2. Changes Delivered
1. **Global Link Reset**:
   - Thêm quy tắc `a { text-decoration: none; color: inherit; }` vào [fooday_frontend/src/app/globals.css](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/app/globals.css).
2. **Vertical Navigation Layout**:
   - Cập nhật [fooday_frontend/src/components/AppShell.tsx](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/components/AppShell.tsx) với layout dọc rõ ràng:
     - `.nav-item`: `display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; text-decoration: none !important;`
     - `.nav-label`: `font-size: 11px; font-weight: 600; line-height: 1; text-decoration: none !important;`
     - Responsive desktop: Sử dụng `.app-shell--app .bottom-nav .nav-item` có độ ưu tiên cao với `!important` để chuyển mượt mà sang dạng thanh bên (sidebar row).
3. **Ẩn Next.js Dev Indicator Badge**:
   - Cấu hình `devIndicators: false` trong [fooday_frontend/next.config.ts](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/next.config.ts) để badge "N" đen không che khuất góc màn hình.

---

### 3. QA Verification Results
- `npm --prefix fooday_frontend run lint`: PASS (No lint errors)
- `tsc --project fooday_frontend/tsconfig.json --noEmit`: PASS (Exit 0, no type errors)
- `npm --prefix fooday_frontend run build`: PASS (Exit 0, all static pages generated)
- `python -m compileall -q fooday_backend/app`: PASS (Exit 0)
