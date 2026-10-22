# Task Archive: Remove Branch Count Display from Home Cards and Detail Modal

- **Date**: 2026-10-22
- **Status**: COMPLETED (QA PASS)
- **Session Mode**: fresh

---

### 1. Goal & Context
Theo phản hồi người dùng (`Screenshot 2026-10-22 110029.png` & `110034.png`), việc hiển thị số lượng cơ sở (`· 2 cơ sở` ngoài card hoặc `(1 cơ sở)` trong dropdown) làm text bị dài, dễ tràn viền và không cần thiết.

**Mục tiêu**:
1. Bỏ toàn bộ việc đếm và hiển thị số lượng cơ sở.
2. Ngoài Card Home feed:
   - Có GPS: Chỉ hiển thị `📍 Cách bạn {khoảng cách}` (ví dụ: `📍 Cách bạn 4.3 km`).
   - Chưa có GPS: Hiển thị ngắn gọn `📍 Đa chi nhánh` (tiếng Anh: `📍 Multiple locations`).
3. Trong Modal chi tiết (`DishDetailModal`):
   - Nút dropdown đổi cơ sở hiển thị ngắn gọn `📍 Đổi sang cơ sở khác ▾` (không kèm `(1 cơ sở)`).

---

### 2. Implementation Summary

#### Frontend (`fooday_frontend`)
- **Translations** ([`src/i18n/translations.ts`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/i18n/translations.ts)):
  - Thêm `multiBranch`: `'Đa chi nhánh'` / `'Multiple locations'`.
  - Giữ `changeBranch`: `'Đổi sang cơ sở khác'` / `'Switch to another branch'`.
  - Xóa `branchesCount` không còn sử dụng.
- **Home Feed Card** ([`src/components/HomeView.tsx`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/components/HomeView.tsx)):
  - Cập nhật `.card-branch-badge`: hiển thị `t.branches.distanceAway(...)` nếu tính được khoảng cách, hoặc `t.branches.multiBranch` nếu chưa có GPS.
- **Dish Detail Modal** ([`src/components/DishDetailModal.tsx`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/components/DishDetailModal.tsx)):
  - Rút gọn nút `.branch-toggle` chỉ còn `<span>{t.branches.changeBranch}</span>`, loại bỏ hoàn toàn phần ghép chuỗi số lượng cơ sở.

---

### 3. Verification & QA Results
- **Frontend Lint**: `npm --prefix fooday_frontend run lint` -> **PASS** (0 errors)
- **Frontend Typecheck**: `.\fooday_frontend\node_modules\.bin\tsc.cmd --project fooday_frontend\tsconfig.json --noEmit` -> **PASS** (0 errors)
- **Backend Compile**: `python -m compileall -q fooday_backend/app` -> **PASS** (0 errors)
