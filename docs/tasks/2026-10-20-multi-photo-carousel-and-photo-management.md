# Task Archive: Multi-Photo Carousel (Google Maps Style) and Photo Management (Add/Delete)

- **Date**: 2026-10-20
- **Status**: ✅ PASS (QA Verified)
- **Executor**: Developer Agent (OpenCode)
- **Reviewer / Technical Auditor**: Gemini

---

## 1. Objective & Overview
Triển khai tính năng **Album nhiều ảnh lướt ngang kiểu Google Maps** cho quán/món ăn và **Quản lý ảnh (Thêm / Xóa ảnh)** trong modal Chỉnh sửa và Thêm món:
1. **Model & Database**:
   - Bổ sung trường `images?: string[] | null` vào interface `Food` trong `useFoods.ts`.
   - Cập nhật câu lệnh query `COLUMNS` để select `images`.
   - Fallback an toàn: nếu `images` null hoặc rỗng, luôn fallback về `[dish.image_url]`.
   - Cập nhật `fooday_frontend/supabase/init_all.sql` bổ sung cột `images text[] default '{}'`.
2. **Modal Chi tiết Quán (`DishDetailModal.tsx`)**:
   - Chuyển đổi hero header thành **Horizontal Swipe Carousel (Google Maps style)**:
     - Hỗ trợ vuốt chạm (swipe trên mobile) và cuộn ngang (`scroll-snap-type: x mandatory`).
     - Badge đếm số ảnh ở góc dưới (vd: `1 / 4`, `2 / 4`) khi có nhiều hơn 1 ảnh.
     - Lớp phủ gradient và các nút chức năng (Nút Tim, Nút Sửa, Nút Chia sẻ) luôn ghim cố định ở trên cùng với `z-index` phù hợp.
3. **Modal Chỉnh sửa Quán (`EditDishModal.tsx`)**:
   - Hiển thị danh sách ảnh hiện tại dạng lưới thumbnail:
     - Ảnh đầu tiên có badge "Ảnh bìa" (Cover).
     - Mỗi ảnh có nút ✕ đỏ ở góc để **Xóa ảnh**.
     - Cảnh báo hoặc chặn xóa nếu chỉ còn 1 ảnh duy nhất.
   - Nút **"+ Thêm ảnh"** cho phép chọn nhiều ảnh (`multiple`) từ thiết bị để upload thẳng lên Supabase Storage (S3) và thêm vào danh sách ảnh.
   - Bấm vào ảnh gợi ý từ Unsplash sẽ **thêm ảnh đó vào danh sách** (append).
   - Khi lưu: cập nhật cả `images: imageList` và `image_url: imageList[0]`.
4. **Modal Thêm món (`AddDishModal.tsx`)**:
   - Hỗ trợ thêm nhiều ảnh tương tự, lưu cả `image_url` và `images`.
5. **Đa ngôn ngữ (`translations.ts`)**:
   - Hỗ trợ đầy đủ từ khóa tiếng Việt và tiếng Anh.

---

## 2. Target Files & Key Changes
- `fooday_frontend/src/hooks/useFoods.ts`: Cập nhật interface `Food` và query `COLUMNS` với `images`.
- `fooday_frontend/src/components/DishDetailModal.tsx`: Tích hợp horizontal swipe carousel với scroll-snap, đồng bộ counter badge `1 / N`.
- `fooday_frontend/src/components/EditDishModal.tsx`: Quản lý album ảnh, xóa từng ảnh (nút ✕), upload nhiều ảnh cùng lúc, thêm ảnh gợi ý Unsplash.
- `fooday_frontend/src/components/AddDishModal.tsx`: Hỗ trợ thêm nhiều ảnh khi tạo món mới.
- `fooday_frontend/src/i18n/translations.ts`: Thêm các nhãn dịch `coverBadge`, `addMorePhotos`, `deletePhoto`, `minOnePhoto`.
- `fooday_frontend/supabase/init_all.sql`: Cập nhật schema với cột `images text[]`.

---

## 3. Verification & QA Audit
- **Frontend Lint**: `npm --prefix fooday_frontend run lint` -> **PASS (0 errors)**
- **Frontend Typecheck**: `tsc --noEmit` -> **PASS (0 errors)**
- **UI/UX Testing**:
  - Carousel cuộn mượt mà không thanh cuộn vướng víu.
  - Xóa ảnh cập nhật real-time và chặn xóa nếu còn 1 ảnh duy nhất.
  - Phản ánh tức thì vào `DishDetailModal` ngay khi lưu thay đổi.

---

## 4. Dev Execution Telemetry
- **Exit Code**: 0 (DONE)
- **Session Mode**: fresh
- **Changed Files**:
```text
 M fooday_frontend/src/components/AddDishModal.tsx
 M fooday_frontend/src/components/DishDetailModal.tsx
 M fooday_frontend/src/components/EditDishModal.tsx
 M fooday_frontend/src/hooks/useFoods.ts
 M fooday_frontend/src/i18n/translations.ts
 M fooday_frontend/supabase/init_all.sql
```
