# Task Archive: Artistic Blurred Backdrop with Contain Fit in DishDetailModal Hero Carousel

- **Date**: 2026-10-22
- **Status**: COMPLETED (QA PASS)
- **Session Mode**: fresh

---

### 1. Goal & Context
Trong modal chi tiết món ăn ([`DishDetailModal.tsx`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/components/DishDetailModal.tsx)), các bức ảnh món ăn trong hero carousel trước đây dùng `objectFit: 'cover'`. Do khung ảnh có tỷ lệ cố định 16:9, các bức ảnh chụp bằng điện thoại dạng dọc (3:4, 9:16) hoặc vuông (1:1) bị crop mất mép trên/dưới.
Tuy nhiên, nếu chỉ đơn thuần chuyển sang `objectFit: 'contain'`, ảnh sẽ để lại hai dải trống màu xám chết ở hai bên, làm các nút bấm nổi (Heart, Badge số trang, Drag handle) bị trôi nổi rời rạc.

**Giải pháp**: Triển khai hiệu ứng **Blurred Backdrop (Nền mờ nghệ thuật)** chuẩn phong cách YouTube/TikTok/Instagram:
- Lớp nền (`.carousel-backdrop`): Dùng chính ảnh đó hiển thị `cover` kết hợp `filter: blur(22px) brightness(0.68) saturate(1.25)` và `transform: scale(1.08)` để lấp đầy toàn bộ khung 16:9 một cách mượt mà, không bị vệt xám.
- Lớp chính (`.carousel-fg`): Hiển thị ở trên với `contain`, giúp toàn bộ món ăn được nhìn thấy trọn vẹn 100% không bị crop.

---

### 2. Implementation Summary

#### Frontend (`fooday_frontend`)
- **Modified Component** ([`src/components/DishDetailModal.tsx`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/components/DishDetailModal.tsx)):
  - **Structure Upgrade**: Tách mỗi slide ảnh thành 2 lớp:
    1. `.carousel-backdrop` với `<Image fill style={{ objectFit: 'cover' }} draggable={false} aria-hidden="true" />`
    2. `.carousel-fg` với `<Image fill style={{ objectFit: 'contain' }} draggable={false} />`
  - **CSS Styling**:
    - `.carousel-slide`: Thêm `overflow: hidden` để clip viền mờ của backdrop, tránh tràn sang các slide kế tiếp.
    - `.carousel-backdrop`: Định vị `inset: -12px`, áp dụng `filter: blur(22px) brightness(0.68) saturate(1.25); transform: scale(1.08); pointer-events: none; z-index: 1;`.
    - `.carousel-fg`: `position: absolute; inset: 0; z-index: 2;`.
    - Chuẩn hóa phân tầng `z-index`:
      - `.carousel-backdrop`: `z-index: 1`
      - `.carousel-fg`: `z-index: 2`
      - `.carousel-badge`: `z-index: 3`
      - `.hero-shade`: `z-index: 3`
      - `.hero-top`: `z-index: 4`
      - `.drag-handle`: `z-index: 4`
  - **Bugfix**: Sửa lỗi typo `sizes="(max-width: 640px) 100vw, 560px)"` dư dấu ngoặc đóng thành `"560px"`.

---

### 3. Verification & QA Results
- **Frontend Lint**: `npm --prefix fooday_frontend run lint` -> **PASS** (0 errors)
- **Frontend Typecheck**: `.\fooday_frontend\node_modules\.bin\tsc.cmd --project fooday_frontend\tsconfig.json --noEmit` -> **PASS** (0 errors)
- **Backend Compile**: `python -m compileall -q fooday_backend/app` -> **PASS** (0 errors)
