# Task Archive: Streamline Image Picker UI in EditDishModal and AddDishModal

- **Date**: 2026-10-20
- **Status**: ✅ PASS (QA Verified)
- **Executor**: Developer Agent (OpenCode)
- **Reviewer / Technical Auditor**: Gemini

---

## 1. Objective & Overview
Sau khi toàn bộ ảnh món ăn đã được chuyển sang Supabase Storage (S3), ô nhập văn bản "Đường dẫn ảnh" (`imageUrl`) với URL dài ngoằng hiển thị mặc định khiến form bị rối và kém thân thiện.
Nhiệm vụ:
- Tinh gọn khu vực chọn ảnh trong cả **`EditDishModal.tsx`** và **`AddDishModal.tsx`**:
  1. Giữ khung xem trước ảnh (Preview) rõ ràng, sắc nét.
  2. Đặt nút **"Tải ảnh lên" / "Đổi ảnh khác"** (`upload-btn`) làm hành động chính trực quan dưới ảnh preview để người dùng tải ảnh từ máy / điện thoại trực tiếp lên S3.
  3. Hiển thị hàng ảnh gợi ý tự động (`candidates / thumbs`) khi có.
  4. Thu gọn ô nhập URL: Ẩn trường nhập input text `urlInput` theo mặc định, thay bằng một nút chữ nhỏ thanh lịch *"Hoặc dán URL ảnh"* (`orPasteUrl`). Khi người dùng bấm vào thì mới mở ra trường nhập URL (toggle `showUrlInput`).
  5. Cập nhật i18n cho cả tiếng Việt và tiếng Anh trong `fooday_frontend/src/i18n/translations.ts`.

---

## 2. Target Files & Key Changes
1. `fooday_frontend/src/components/EditDishModal.tsx`:
   - Thêm state `showUrlInput` (mặc định `false`).
   - Mặc định ẩn ô input text URL dài ngoằng.
   - Ưu tiên hiển thị cụm nút Upload ảnh lên S3 và danh sách gợi ý ảnh Unsplash.
   - Cung cấp nút toggle `toggle-url-btn` dạng text link nhỏ *"Hoặc dán link ảnh từ web"* để mở ra khi cần.
2. `fooday_frontend/src/components/AddDishModal.tsx`:
   - Tinh gọn tương tự `EditDishModal`, ẩn ô text input URL mặc định.
   - Đưa nút Upload và gợi ý ảnh lên vị trí nổi bật, trực quan.
3. `fooday_frontend/src/i18n/translations.ts`:
   - Bổ sung các bản dịch `orPasteUrl` và `hidePasteUrl` cho cả tiếng Việt và tiếng Anh.

---

## 3. Verification & QA Audit
- **Frontend Lint**: `npm --prefix fooday_frontend run lint` -> **PASS (0 errors)**
- **Frontend Typecheck**: `tsc --noEmit` -> **PASS (0 errors)**
- **UI/UX Review**:
  - Giao diện form thêm/sửa món trở nên tinh gọn, sạch sẽ, không còn các chuỗi link URL dài chiếm diện tích.
  - Vẫn giữ khả năng dán URL linh hoạt cho người dùng nâng cao thông qua nút toggle mở rộng.

---

## 4. Dev Execution Telemetry
- **Timestamp**: 2026-10-20 11:45:15
- **Exit Code**: 0 (DONE)
- **Session Mode**: fresh
- **Changed Files**:
```text
 M fooday_frontend/src/components/AddDishModal.tsx
 M fooday_frontend/src/components/EditDishModal.tsx
 M fooday_frontend/src/i18n/translations.ts
```
