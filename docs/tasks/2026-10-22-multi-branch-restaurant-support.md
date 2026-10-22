# Task Archive: Multi-Branch Restaurant Support & Nearest Branch Prioritization

- **Date**: 2026-10-22
- **Status**: COMPLETED (QA PASS)
- **Session Mode**: fresh

---

### 1. Goal & Context
Với các quán ăn có nhiều chi nhánh (như Phở Thìn, Pizza 4P's, Phúc Long,...), việc tạo nhiều card riêng ngoài Home feed hay Random Roulette sẽ làm loãng feed và mất cân đối xác suất.
Mục tiêu:
1. **1 Card duy nhất ngoài Feed**: Mỗi món/quán chỉ có 1 card đại diện. Khi quán có nhiều chi nhánh, hiển thị badge: `📍 Cách 1.2km · 3 cơ sở` (nếu có GPS) hoặc `📍 3 cơ sở`.
2. **Ưu tiên cơ sở gần nhất trong Modal Chi Tiết (`DishDetailModal.tsx`)**:
   - Dòng địa chỉ chính bên ngoài tự động hiển thị **cơ sở gần nhất với vị trí người dùng** (kèm badge khoảng cách).
   - Khi quán có > 1 cơ sở, hiển thị nút `[📍 Đổi cơ sở (N cơ sở) ▾]` để mở danh sách chi nhánh, cho phép người dùng đổi sang cơ sở khác hoặc bấm chỉ đường Google Maps tới từng nơi.
3. **Thêm / Sửa Chi nhánh (`AddDishModal.tsx` & `EditDishModal.tsx`)**:
   - Cho phép thêm/sửa/xóa các cơ sở phụ kèm tính năng tự động phân tích địa chỉ khi dán link Google Maps.
   - Lưu trữ dạng `branches: jsonb` trên Supabase với cơ chế graceful fallback.

---

### 2. Implementation Summary

#### Frontend (`fooday_frontend`)
- **New Module** ([`src/lib/geo.ts`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/lib/geo.ts)):
  - Trích xuất tọa độ (`lat, lng`) từ các định dạng link Google Maps (`!3d!4d`, `@lat,lng`, `?ll=`).
  - Tính khoảng cách bằng công thức Haversine (`calculateDistanceKm`) và định dạng khoảng cách thân thiện (`formatDistance`: `< 1km` dạng `850m`, `>= 1km` dạng `1.2 km`).
  - Quản lý vị trí người dùng qua `useUserLocation()` hook (dùng `useSyncExternalStore` + `sessionStorage` cache, không crash khi bị từ chối quyền).
  - Helper `getAllBranches` gộp cơ sở chính và các cơ sở phụ trong `food.branches`.
- **New Component** ([`src/components/BranchEditor.tsx`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/components/BranchEditor.tsx)):
  - Form thêm/sửa/xóa chi nhánh phụ trong `AddDishModal` và `EditDishModal`.
  - Tự động gọi API `/api/resolve-maps-url` khi paste link Google Maps để auto-fill địa chỉ chi nhánh với cơ chế debounce 500ms.
- **Home Feed Card** ([`src/components/HomeView.tsx`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/components/HomeView.tsx)):
  - Hiển thị chip `.card-branch-badge` nhỏ gọn khi quán có `total > 1` chi nhánh: hiển thị khoảng cách đến cơ sở gần nhất + tổng số cơ sở.
- **Dish Detail Modal** ([`src/components/DishDetailModal.tsx`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/components/DishDetailModal.tsx)):
  - Tự động xác định và hiển thị cơ sở gần nhất ở dòng địa chỉ chính.
  - Tích hợp bộ chọn chi nhánh `.branch-switcher`: bấm mở accordion danh sách chi nhánh kèm badge `Gần bạn nhất`, khoảng cách, giờ mở cửa và nút mở Maps riêng.
- **Data Layer & Fallback** ([`src/hooks/useFoods.ts`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/hooks/useFoods.ts)):
  - Bổ sung interface `Branch` và `branches?: Branch[] | null` vào `Food`.
  - Truy vấn `branches` kèm fallback query `COLUMNS_WITHOUT_BRANCHES` an toàn.
- **i18n** ([`src/i18n/translations.ts`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/i18n/translations.ts)):
  - Bổ sung bộ translation đầy đủ cho `branches` ở cả 2 ngôn ngữ `vi` và `en`.

---

### 3. Verification & QA Results
- **Frontend Lint**: `npm --prefix fooday_frontend run lint` -> **PASS** (0 errors)
- **Frontend Typecheck**: `.\fooday_frontend\node_modules\.bin\tsc.cmd --project fooday_frontend\tsconfig.json --noEmit` -> **PASS** (0 errors)
- **Backend Compile**: `python -m compileall -q fooday_backend/app` -> **PASS** (0 errors)
