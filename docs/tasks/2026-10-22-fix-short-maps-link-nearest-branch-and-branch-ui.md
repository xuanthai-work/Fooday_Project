# Task Archive: Fix Nearest Branch Resolution for Short Maps Links & Refine Branch UI

- **Date**: 2026-10-22
- **Status**: COMPLETED (QA PASS)
- **Session Mode**: fresh

---

### 1. Goal & Context
Người dùng đang ở Hà Đông nhưng hệ thống lại chọn cơ sở Bà Triệu của King BBQ thay vì cơ sở Royal City (Thanh Xuân) gần hơn nhiều.

**Nguyên nhân gốc (Root Cause)**: Link Google Maps lưu trong DB là dạng link rút gọn (`https://maps.app.goo.gl/YN3yqFYRfr6U9yv26`, `https://maps.app.goo.gl/DRJ3EuLM45RmzmbDA`). Hàm `extractCoordsFromUrl` trong `geo.ts` chỉ bóc tách được tọa độ từ URL tĩnh (`!3d!4d`, `@lat,lng`, `?ll=`), nên cả 2 cơ sở đều trả về `null` → không tính được khoảng cách → fallback về cơ sở đầu tiên (Bà Triệu).

Ngoài ra, UI còn 3 điểm chưa ổn:
1. Giờ mở cửa bị nhập/hiển thị lặp lại ở từng chi nhánh — trong khi toàn bộ cơ sở dùng chung giờ mở cửa của quán.
2. Dropdown "Đổi cơ sở" vẫn hiển thị cả cơ sở đang được chọn (đã hiện nổi bật ở dòng địa chỉ chính).
3. Chi nhánh mới tạo chưa lưu tọa độ → mỗi lần mở modal lại phải resolve lại từ đầu.

Mục tiêu: tự động resolve tọa độ cho link rút gọn (có cache session), chọn đúng cơ sở gần nhất, và tinh chỉnh lại UI chi nhánh.

---

### 2. Implementation Summary

#### Frontend (`fooday_frontend`)
- **Geo Module** ([`src/lib/geo.ts`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/lib/geo.ts)):
  - Cache tọa độ theo URL: memory `Map<string, Coords>` + `sessionStorage` với prefix `fooday:url-coords:`.
  - `getBranchCoords(branch)` nâng cấp theo thứ tự: `branch.lat/lng` → cache theo `google_map_url` → `extractCoordsFromUrl` → `null` (kết quả bóc tách được cũng được ghi vào cache).
  - Hàm mới `resolveBranchCoords(branches): Promise<boolean>`: với mọi branch chưa có tọa độ, gọi BFF `/api/parse-map-link?url=...`, lấy `resolved_url`, bóc tách tọa độ và ghi vào cache. Trả `true` nếu có ít nhất 1 cặp tọa độ mới.
  - `getAllBranches`: cơ sở chính chỉ giữ `name`, `address`, `google_map_url` (bỏ `opening_time`); cơ sở phụ giữ nguyên `lat`/`lng`.
  - `hasBranchContent` không còn xét `opening_time`.
- **Data Layer** ([`src/hooks/useFoods.ts`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/hooks/useFoods.ts)):
  - Interface `Branch`: bỏ `opening_time`, thêm `lat?: number | null` / `lng?: number | null`.
- **Dish Detail Modal** ([`src/components/DishDetailModal.tsx`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/components/DishDetailModal.tsx)):
  - `useEffect` gọi `resolveBranchCoords(branches)` khi mở modal; khi có tọa độ mới, bump `coordsRevision` để `findNearestBranch` tính lại và tự chọn cơ sở gần nhất (Royal City thay vì Bà Triệu).
  - `otherBranches` loại bỏ cơ sở đang chọn khỏi dropdown; chọn 1 cơ sở → set index + đóng dropdown (cơ sở đó nhảy ra ngoài dòng địa chỉ chính).
  - Tiêu đề dropdown: `📍 Đổi sang cơ sở khác (N cơ sở) ▾`; ẩn hoàn toàn `.branch-switcher` khi không còn cơ sở nào khác.
  - Bỏ badge giờ mở cửa trùng lặp (`.branch-item-hours`) trong từng item; dòng `GIỜ MỞ CỬA` dùng chung `currentDish.opening_time`.
- **Branch Editor** ([`src/components/BranchEditor.tsx`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/components/BranchEditor.tsx)):
  - `BranchDraft` bỏ `openingTime`, thêm `lat`/`lng`; xoá ô input giờ mở cửa.
  - Khi `mapService.parseMapLink(url)` trả về `resolved_url` có tọa độ → lưu `lat`/`lng` vào draft của chi nhánh đó.
- **Add / Edit Dish Modal** ([`src/components/AddDishModal.tsx`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/components/AddDishModal.tsx), [`src/components/EditDishModal.tsx`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/components/EditDishModal.tsx)):
  - Payload `cleanBranches` lưu `{ name, address, google_map_url, lat, lng }`; khi load `dish.branches` cũng map `lat`/`lng`.
- **i18n** ([`src/i18n/translations.ts`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/i18n/translations.ts)):
  - `changeBranch`: `Đổi sang cơ sở khác` / `Switch to another branch`.
  - `distanceAway`: `Cách bạn X km` (vi).
  - Xoá các key giờ mở cửa riêng của chi nhánh (`branchOpeningTimeLabel`, `branchOpeningTimePlaceholder`).

---

### 3. Verification & QA Results
- **Short link resolution**: link `maps.app.goo.gl` được expand qua `/api/parse-map-link`, tọa độ bóc tách từ `resolved_url` và cache trong `sessionStorage` (`fooday:url-coords:<url>`).
- **Nearest branch**: sau khi resolve, `findNearestBranch` chọn cơ sở gần nhất (Royal City thay Bà Triệu với người dùng ở Hà Đông/Thanh Xuân) và hiển thị badge `Gần bạn nhất • Cách bạn X km`.
- **Dropdown**: chỉ hiển thị các cơ sở *khác* cơ sở đang hiển thị; chọn xong dropdown đóng và cơ sở đó nhảy ra dòng địa chỉ chính.
- **Opening hours**: không còn trường giờ mở cửa riêng ở từng chi nhánh (dùng chung giờ của quán).
- **Frontend Lint**: `npm --prefix fooday_frontend run lint` -> **PASS** (0 errors)
- **Frontend Typecheck**: `.\fooday_frontend\node_modules\.bin\tsc.cmd --project fooday_frontend\tsconfig.json --noEmit` -> **PASS** (0 errors)
- **Frontend Build**: `npm --prefix fooday_frontend run build` -> **PASS** (compile + TypeScript + static generation)
- **Backend Compile**: `python -m compileall -q fooday_backend/app` -> **PASS** (0 errors)
