# Task Archive: Google Maps Place Deduplication & Instant View Modal

- **Task File**: `justdoit.md`
- **Completed Date**: 2026-10-22
- **Status**: ✅ QA PASS
- **Session Mode**: fresh

---

## 1. Problem Statement & User Requirements

Người dùng yêu cầu triển khai luồng **Chống trùng lặp quán ăn khi thêm món mới (Kịch bản A + C)**:
1. **Phát hiện trùng lặp qua Google Maps Link**:
   - Khi dán link Google Maps (dù là link rút gọn `maps.app.goo.gl` trên app điện thoại hay link web đầy đủ) vào ô "Link Google Maps" trong `AddDishModal`.
   - Backend phân giải link và bóc tách định danh duy nhất của địa điểm: **Hex CID / Place ID** (`!1s(0x...:0x...)` hoặc tham số `cid=...`).
   - Frontend đối chiếu với danh sách món/quán đã tồn tại trong hệ thống (`foods`).
2. **Cảnh báo và Điều hướng tức thì**:
   - Khi phát hiện quán đã tồn tại trong hệ thống:
     - Hiển thị ngay **Popup / Modal thông báo**: *"Quán này đã có trên Fooday!"*, kèm thông tin tên quán và món ăn đã được thêm trước đó.
     - Có nút bấm **"OK (Xem quán)"**.
   - Khi người dùng bấm nút **"OK (Xem quán)"**:
     - Tự động đóng `AddDishModal`.
     - Chuyển hướng về trang chủ (`/`) nếu đang ở route khác.
     - Tự động mở ngay **`DishDetailModal`** của quán/món bị trùng đó để người dùng xem thông tin chi tiết.
   - Vô hiệu hóa submit và chặn người dùng tạo trùng lặp tại `AddDishModal`.

---

## 2. Implementation Summary

### Backend (`fooday_backend`)
- **`app/models.py`**:
  - Mở rộng `ParseMapResponse` với trường `place_id: str | None = None`.
- **`app/api.py`**:
  - Bổ sung hàm `_extract_place_id(url: str, html: str = "") -> str | None`:
    - Regex quét chuỗi Hex thực thể: `!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)`.
    - Fallback quét tham số query `cid=...` và trong payload script HTML (`APP_INITIALIZATION_STATE`).
  - Endpoint `GET /api/v1/parse-map-link`: trích xuất `place_id` và trả về cho client.

### Frontend (`fooday_frontend`)
- **`src/app/api/parse-map-link/route.ts`**: Cập nhật BFF proxy chuyển tiếp `place_id` an toàn.
- **`src/services/api.ts`**: Mở rộng `ParsedMapInfo` với `place_id?: string | null`.
- **`src/lib/maps.ts`**:
  - `extractPlaceId(url)`: chuẩn hóa bóc tách Place/CID ID từ chuỗi URL dạng lowercase.
  - `normalizeMapsLink(url)` & `mapsLinksMatch(a, b)`: hàm so khớp link đa tầng (Place ID -> Canonical Host+Path).
- **`src/components/AddDishModal.tsx`**:
  - Bổ sung hàm `findDuplicateFood(foods, info, rawUrl)` quét toàn bộ quán chính và các chi nhánh (`branches`) trong hệ thống.
  - Quản lý state `duplicateDish` và `showDuplicatePopup`.
  - Khóa `canSubmit` khi có `duplicateDish`.
  - Render popup cảnh báo chuẩn thiết kế Fooday (icon 📍, tiêu đề, mô tả kèm tên quán & món cũ, 2 nút hành động).
  - Hàm `handleViewExisting`: đóng modal, điều hướng về `/`, dispatch event `fooday:open-dish` và router push `/?dish=<id>`.
- **`src/components/HomeView.tsx`**:
  - Lắng nghe event `fooday:open-dish` và query parameter `?dish=<id>` từ `useSearchParams()` để mở ngay `DishDetailModal`.
- **`src/app/page.tsx`**: Bọc `HomeView` trong `<Suspense fallback={null}>` để tối ưu SSR/prerender cho `useSearchParams`.
- **`src/i18n/translations.ts`**: Bổ sung đầy đủ chuỗi bản địa hóa song ngữ (vi/en) cho tính năng cảnh báo trùng.

---

## 3. QA Audit & Verification Gates

```powershell
# 1. Backend Verification
python -m compileall -q fooday_backend/app
# -> Exit code: 0

# 2. Frontend Verification
npm --prefix fooday_frontend run lint
# -> Exit code: 0

.\fooday_frontend\node_modules\.bin\tsc.cmd --project fooday_frontend\tsconfig.json --noEmit
# -> Exit code: 0
```
