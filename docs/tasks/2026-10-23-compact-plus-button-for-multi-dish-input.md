# Task Archive: Compact Plus Button for Multi-Dish Input

- **Task File**: `justdoit.md`
- **Completed Date**: 2026-10-23
- **Status**: ✅ QA PASS
- **Session Mode**: fresh

---

## 1. Problem Statement & User Requirements

Trong form Thêm món (`AddDishModal.tsx`) và Sửa quán (`EditDishModal.tsx`):
- Nút bấm thêm món bên cạnh ô nhập mang nhãn chữ dài: `"Thêm món"` (`padding: 0 14px`).
- Nút này chiếm quá nhiều diện tích bề ngang trên màn hình điện thoại, làm cho placeholder của ô nhập tên món bị cắt cụt thành `"Nhập tên món rồi nhấn Enter ho..."` (như trong ảnh screenshot `Screenshot 2026-10-23 101202.png`).
- **Yêu cầu của người dùng**:
  - Làm nút thêm món **bé gọn lại**:
    - Chuyển thành nút icon `Plus` (`+`) nhỏ gọn hình vuông bo góc (`width: 44px; height: 44px; padding: 0; display: grid; place-items: center;`).
    - Icon: `Plus` từ `lucide-react` (size 19px, strokeWidth 2.4).
    - Giữ đầy đủ `aria-label={t.addDish.addDishBtn}` và `title={t.addDish.addDishBtn}` để tối ưu accessibility.
    - Nhường toàn bộ không gian ngang còn lại cho ô input để hiển thị trọn vẹn placeholder.
  - Áp dụng đồng bộ cho cả `AddDishModal.tsx` và `EditDishModal.tsx`.

---

## 2. Implementation Summary

### Frontend (`fooday_frontend`)
- **`src/components/AddDishModal.tsx` & `src/components/EditDishModal.tsx`**:
  - Import icon `Plus` từ `lucide-react`.
  - Thay thế text nút `.tag-add-btn` bằng `<Plus size={19} strokeWidth={2.4} />` kèm `aria-label` và `title`.
  - Tinh chỉnh CSS `.tag-add-btn`: cố định kích thước `width: 44px; height: 44px; padding: 0; display: grid; place-items: center;`, hỗ trợ hiệu ứng active `scale(0.96)`.
  - Ô input mở rộng tối đa theo toàn bộ chiều ngang còn lại của hàng (`flex: 1; min-width: 0;`), đảm bảo placeholder hiển thị trọn vẹn và thoáng mắt.

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
