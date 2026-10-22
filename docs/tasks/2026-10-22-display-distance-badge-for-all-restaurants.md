# Task Archive: Display Distance Badge for All Restaurants on Home Cards

- **Date**: 2026-10-22
- **Status**: COMPLETED (QA PASS)
- **Session Mode**: fresh

---

### 1. Goal & Context
Trước đây, thẻ khoảng cách `.card-branch-badge` (`📍 Cách bạn X km`) ngoài trang chủ chỉ được kích hoạt hiển thị cho các quán ăn có từ 2 chi nhánh trở lên. Các quán chỉ có 1 cơ sở duy nhất không được hiển thị khoảng cách.

**Mục tiêu**:
1. Hiển thị thẻ khoảng cách `📍 Cách bạn X km` cho **tất cả các quán ăn** (bao gồm cả quán 1 cơ sở duy nhất) khi người dùng bật định vị GPS và tính được khoảng cách.
2. Nếu chưa có GPS (hoặc không tính được khoảng cách):
   - Quán nhiều cơ sở: Hiển thị `📍 Đa chi nhánh`.
   - Quán 1 cơ sở: Ẩn thẻ để giữ giao diện gọn gàng.
3. Đảm bảo toàn bộ các link Google Maps rút gọn trên feed được tự động resolve tọa độ nền để thẻ khoảng cách hiển thị mượt mà.

---

### 2. Implementation Summary

#### Frontend (`fooday_frontend`)
- **Home Feed Card** ([`src/components/HomeView.tsx`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/components/HomeView.tsx)):
  - **Tự động resolve tọa độ nền**: Thêm `useEffect` duyệt toàn bộ danh sách `foods`, gọi `resolveBranchCoords(allBranches)` để giải mã tọa độ ngầm trong nền cho các link rút gọn `maps.app.goo.gl` và kích hoạt re-render qua `coordsRevision`.
  - **Cập nhật điều kiện hiển thị thẻ**:
    ```tsx
    const hasDistance = branchSummary?.distanceKm != null;
    const isMultiBranch = Boolean(branchSummary && branchSummary.total > 1);
    const showDistanceBadge = hasDistance || isMultiBranch;
    ```
    - Nếu `hasDistance`: Luôn hiển thị `📍 Cách bạn {khoảng cách}` cho tất cả các quán ăn.
    - Nếu `!hasDistance` (chưa có GPS): Chỉ hiển thị `📍 Đa chi nhánh` cho quán nhiều cơ sở. Quán 1 cơ sở không hiển thị thẻ.

---

### 3. Verification & QA Results
- **Frontend Lint**: `npm --prefix fooday_frontend run lint` -> **PASS** (0 errors)
- **Frontend Typecheck**: `.\fooday_frontend\node_modules\.bin\tsc.cmd --project fooday_frontend\tsconfig.json --noEmit` -> **PASS** (0 errors)
- **Backend Compile**: `python -m compileall -q fooday_backend/app` -> **PASS** (0 errors)
