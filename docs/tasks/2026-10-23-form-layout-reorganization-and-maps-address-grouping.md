# Task Archive: Form Layout Reorganization, Maps/Address Grouping, and Compact Branch Button

- **Task File**: `justdoit.md`
- **Completed Date**: 2026-10-23
- **Status**: ✅ QA PASS
- **Session Mode**: fresh

---

## 1. Problem Statement & User Requirements

Người dùng yêu cầu điều chỉnh lại bố cục và chi tiết các trường trong `AddDishModal.tsx` và `EditDishModal.tsx`:
1. **Gộp Link Google Maps & Địa chỉ (Screenshot: `Screenshot 2026-10-23 101921.png`)**:
   - Tiêu đề nhãn chung: `"Link Google Maps * | Địa chỉ"`.
   - Giữa 2 ô input có dấu `|` căn giữa thanh mảnh, vẫn xếp dọc 2 ô (ô trên nhập link Google Maps, ô dưới là địa chỉ tự động bóc tách).
2. **Nút Thêm cơ sở khác nhỏ gọn (Screenshot: `Screenshot 2026-10-23 101812.png`)**:
   - Xóa bỏ dòng chữ label to `"Chi nhánh / Cơ sở khác"`.
   - Nút `+ Thêm cơ sở khác` chuyển thành nút compact pill nhỏ gọn (`height: 34px`, border nét đứt thanh mảnh), nằm sát ngay dưới ô Địa chỉ.
3. **Hàng ngang Giờ mở cửa & Ghi chú**:
   - Chuyển ô Giờ mở cửa xuống ngang hàng với ô Ghi chú (1 row gồm 2 cột đều nhau).
4. **Hashtag chuyển xuống cuối cùng**:
   - Khối Hashtag kiểu TikTok (kèm dropdown gợi ý) được đặt ở vị trí cuối cùng của các trường nhập liệu (ngay trên hàng nút Hủy / Lưu).

---

## 2. Implementation Summary

### Frontend (`fooday_frontend`)
- **`src/components/AddDishModal.tsx` & `src/components/EditDishModal.tsx`**:
  - Gộp trường Maps và Địa chỉ vào container `.maps-address-group`:
    - Label chung: `{t.map.googleMapLabel} * | {t.map.addressLabel}`.
    - Hai ô input xếp dọc với ký hiệu `.field-divider` (`|`) ở giữa.
    - Xóa bỏ thẻ label `{t.branches.branchesSection}` bao bọc `BranchEditor`.
  - Tạo hàng ngang 2 cột `.two-cols-row`:
    - Cột 1: Giờ mở cửa (`openingTime`).
    - Cột 2: Ghi chú (`reviewNote`).
    - Responsive thông minh trên mobile (`grid-template-columns: 1fr 1fr; gap: 8px;`).
  - Đưa khối Hashtag TikTok xuống vị trí cuối cùng của form.
- **`src/components/BranchEditor.tsx`**:
  - Tinh chỉnh nút `.add-branch`: `align-self: flex-start; height: 34px; padding: 0 14px; border-radius: var(--r-full); font-size: 12.5px;` kèm icon `Plus size={14}`. Nút nằm gọn gàng ngay dưới ô địa chỉ, không chiếm cả 1 ô to như trước.

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
