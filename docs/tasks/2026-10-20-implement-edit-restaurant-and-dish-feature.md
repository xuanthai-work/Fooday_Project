# Task Archive: Implement Edit Restaurant and Dish Feature (UI + Database Policy)

- **Date**: 2026-10-20
- **Status**: ✅ PASS (QA Verified)
- **Executor**: Developer Agent (OpenCode)
- **Reviewer / Technical Auditor**: Gemini

---

## 1. Objective & Overview
Triển khai tính năng **Chỉnh sửa thông tin quán ăn và món ăn** (Edit Restaurant & Dish) hoàn chỉnh trên Frontend Next.js và Database Supabase:
- Bổ sung nút bấm ✏️ (Chỉnh sửa) trên header của `DishDetailModal.tsx`.
- Tạo modal `EditDishModal.tsx` cho phép người dùng đã đăng nhập chỉnh sửa:
  - Tên quán (`restaurant`)
  - Tên món (`name`)
  - Danh mục (`category`: Foods, Drinks, Snacks)
  - Địa chỉ quán (`address`)
  - Giờ mở cửa (`opening_time`)
  - Tag (`tag`)
  - Ghi chú review (`review_note`)
  - Hình ảnh (`image_url` - hỗ trợ dán URL, chọn ảnh Unsplash hoặc upload lên Supabase Storage)
- Cập nhật dữ liệu vào Supabase `public.foods` bằng `.update(...).eq('id', dish.id)` và gọi `refreshFoods()` để đồng bộ toàn app mà không cần reload.
- Cập nhật chính sách RLS trong `fooday_frontend/supabase/init_all.sql` để cho phép người dùng đăng nhập chỉnh sửa các món của mình hoặc các món cộng đồng hiện có (`created_by is null`).
- Hỗ trợ đa ngôn ngữ đầy đủ (VI/EN) trong `fooday_frontend/src/i18n/translations.ts`.

---

## 2. Target Files & Key Changes
1. `fooday_frontend/src/components/EditDishModal.tsx` (Mới):
   - Tạo modal chỉnh sửa với đầy đủ các trường thông tin điền sẵn từ `dish`.
   - Hỗ trợ 3 cơ chế hình ảnh: URL, Upload ảnh lên Supabase Storage, và tìm kiếm thông minh từ Unsplash.
   - Validation dữ liệu, bắt lỗi và gọi `refreshFoods()` + `onUpdated(data)` khi lưu thành công.
2. `fooday_frontend/src/components/DishDetailModal.tsx`:
   - Bổ sung nút ✏️ (`Pencil` icon) tại hero header bên cạnh nút Share và Close.
   - Kiểm tra `isGuest`: nếu khách chưa đăng nhập, hiển thị toast nhắc đăng nhập; nếu đã đăng nhập, mở `EditDishModal`.
   - Đồng bộ state `currentDish` để modal chi tiết cập nhật ngay lập tức các thay đổi sau khi lưu.
3. `fooday_frontend/src/i18n/translations.ts`:
   - Thêm bản dịch song ngữ VI/EN cho các mục chỉnh sửa, nhãn form, thông báo thành công và nhắc đăng nhập.
4. `fooday_frontend/supabase/init_all.sql`:
   - Cập nhật policy RLS `foods_update_own` cho phép user authenticated cập nhật món của mình hoặc món cộng đồng (`created_by is null`).

---

## 3. Verification & QA Audit
- **Frontend Lint**: `npm --prefix fooday_frontend run lint` -> **PASS (0 errors)**
- **Frontend Typecheck**: `tsc --noEmit` -> **PASS (0 errors)**
- **Backend Syntax Check**: `python -m compileall -q fooday_backend/app` -> **PASS (0 errors)**
- **Architecture & UI/UX**:
  - Tuân thủ thiết kế Warm Culinary Palette (`--bg-surface`, `--color-primary`, `--border`, v.v.).
  - Hỗ trợ đầy đủ phím Escape, click outside overlay và animation mượt mà.

---

## 4. Dev Execution Telemetry
- **Timestamp**: 2026-10-20 11:20:07
- **Exit Code**: 0 (DONE)
- **Session Mode**: fresh
- **Changed Files**:
```text
 M fooday_frontend/src/components/DishDetailModal.tsx
 M fooday_frontend/src/i18n/translations.ts
 M fooday_frontend/supabase/init_all.sql
?? fooday_frontend/src/components/EditDishModal.tsx
```
