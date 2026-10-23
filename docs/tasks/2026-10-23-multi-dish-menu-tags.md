# Task Archive: Multi-Dish Menu Tags for Diverse Restaurant Offerings

- **Task File**: `justdoit.md`
- **Completed Date**: 2026-10-23
- **Status**: ✅ QA PASS
- **Session Mode**: fresh

---

## 1. Problem Statement & User Requirements

Hiện tại trong Fooday, form thêm quán/món chỉ có 1 trường `name` duy nhất (1 tên món).  
Tuy nhiên, trong thực tế nhiều quán ăn tại Việt Nam bán nhiều món đa dạng (ví dụ: *quán ăn vặt bán cả xiên nướng, nước ép, chè bưởi...*).  
Người dùng không muốn phải tạo nhiều bài viết riêng cho từng món, cũng không muốn chia món chính/phụ rườm rà.

**Yêu cầu đã được người dùng duyệt**:
1. **Giao diện nhập đa món (Multi-Dish Input)** trong `AddDishModal.tsx` và `EditDishModal.tsx`:
   - Thay thế ô nhập tên món đơn lẻ bằng ô nhập danh sách món ăn:
     - Nhãn: *"Món ăn của quán \*"*
     - Placeholder: *"Nhập tên món rồi nhấn Enter hoặc dấu phẩy (vd: Xiên nướng, Nước ép dưa hấu...)"*
     - Vẫn giữ gợi ý tự động từ `DishNameAutocomplete`.
     - Khi gõ xong bấm **Enter**, dấu phẩy `,` hoặc nút **`+` (Thêm món)**: tên món biến thành một tag/chip có nút `✕` để xóa nhanh.
     - Cho phép thêm nhiều món linh hoạt.
     - Điều kiện submit form: Có **ít nhất 1 món** (`dishList.length > 0`).
2. **Lưu trữ dữ liệu & Tương thích ngược (Backward Compatibility)**:
   - Trong `Food` interface (`useFoods.ts`): Thêm trường `dishes?: string[] | null`.
   - Cột `name` vẫn lưu tên món đầu tiên (hoặc chuỗi nối các món) để các view hiện tại không bị lỗi.
   - Thêm cột `dishes` vào payload gửi lên Supabase. Có cơ chế fallback tự động nếu cột `dishes` chưa được migration trên Supabase (lưu chuỗi nối vào `name`).
3. **Hiển thị & Tìm kiếm**:
   - **Thẻ món ngoài Feed (`HomeView.tsx`)**:
     - Hiển thị tên món: nếu có nhiều món, hiển thị dạng nối tinh gọn: *"Xiên nướng · Nước ép dưa hấu · Chè bưởi"*.
     - Tìm kiếm thông minh: Tìm kiếm theo bất kỳ món nào trong danh sách `dishes` đều ra quán.
   - **Modal Chi tiết Quán (`DishDetailModal.tsx`)**:
     - Hiển thị danh sách các món của quán dưới dạng các pill/chips menu bắt mắt, trực quan.
   - **Backend & Foodie AI (`fooday_backend`)**:
     - Bổ sung `dishes` vào `CATALOG_COLUMNS` và context để AI nhận biết toàn bộ thực đơn của quán khi gợi ý cho người dùng.
4. **Bản địa hóa (i18n)**:
   - Bổ sung đầy đủ chuỗi tiếng Việt và tiếng Anh trong `translations.ts`.

---

## 2. Implementation Summary

### Frontend (`fooday_frontend`)
- **`src/hooks/useFoods.ts`**:
  - Mở rộng `Food` interface với `dishes?: string[] | null`.
  - Cập nhật select columns với `dishes` và cơ chế fallback nhiều tầng chống lỗi khi cột chưa migrate trên DB.
- **`src/components/DishNameAutocomplete.tsx`**:
  - Bổ sung prop `onCommit?: (value: string) => void`.
  - Hỗ trợ phím Enter và dấu phẩy `,` để chuyển cụm từ vừa nhập thành chip món ăn ngay tức thì.
- **`src/components/AddDishModal.tsx` & `EditDishModal.tsx`**:
  - Tích hợp chip list cho các món ăn (`dishList`).
  - Hỗ trợ xóa món nhanh bằng `✕`.
  - Validate form: `canSubmit` yêu cầu `dishList.length > 0`.
  - Lưu trữ `name: dishList.join(', ')` và `dishes: dishList` kèm cơ chế fallback an toàn.
- **`src/components/HomeView.tsx`**:
  - Nối danh sách món thành `Xiên nướng · Nước ép dưa hấu · Chè bưởi` trên tiêu đề thẻ quán.
  - Tìm kiếm toàn diện: Khách gõ bất kỳ món nào trong menu đều tìm thấy quán.
- **`src/components/DishDetailModal.tsx`**:
  - Render section *"Thực đơn món của quán"* với các badge pill phong cách ẩm thực đặc trưng.
- **`src/i18n/translations.ts`**: Thêm đầy đủ bản dịch vi/en (`dishesLabel`, `dishInputPlaceholder`, `addDishBtn`, `minOneDishRequired`, `menuSectionTitle`).

### Backend (`fooday_backend`)
- **`app/api.py`**:
  - Đưa `dishes` vào `CATALOG_COLUMNS` và hàm bóc tách `_parse_dishes`.
  - Cung cấp toàn bộ thực đơn cho system prompt của Foodie AI và tính điểm tìm kiếm thông minh (`_score_food`).
  - Đánh chỉ mục từng món trong thực đơn (`_build_food_index`) để AI có thể gợi ý trực tiếp bất kỳ món nào trong menu.

---

## 3. QA Audit & Verification Gates

```powershell
# 1. Backend Verification
python -m compileall -q fooday_backend/app
# -> Exit code: 0

# 2. Frontend Lint & Typecheck
npm --prefix fooday_frontend run lint
# -> Exit code: 0

.\fooday_frontend\node_modules\.bin\tsc.cmd --project fooday_frontend\tsconfig.json --noEmit
# -> Exit code: 0
```
