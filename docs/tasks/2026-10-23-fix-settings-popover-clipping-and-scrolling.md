# Task: Fix Settings Popover Clipping and Scrolling in ProfileView

- **Status**: Completed & Verified
- **Date**: 2026-10-23
- **Component**: `fooday_frontend/src/components/ProfileView.tsx`

---

## 1. Mục tiêu & Vấn đề
- **Vấn đề**: Người dùng báo lỗi giao diện khi mở popup Cài đặt (Settings Popover) tại trang Profile (`/profile`). Phần dưới cùng của popover (nút switch và dòng chú thích của mục "Hiệu ứng vui (mưa emoji)") bị cắt cụt ngang và không thể cuộn (scroll) để xem đầy đủ (như ảnh chụp `Screenshot 2026-10-23 103826.png`).
- **Mục tiêu**: Loại bỏ hiện tượng cắt xén do xung đột stacking context giữa `.banner-top` và `.segment-wrap`, đồng thời bổ sung khả năng scroll nội bộ có giới hạn chiều cao tối đa cho popover trên các thiết bị màn hình ngắn/di động.

---

## 2. Nguyên nhân Gốc rễ
1. **Xung đột Z-Index Stacking Context**:
   - `.profile-aside` sử dụng `display: contents`, khiến `.banner` (chứa `.banner-top`, `.banner-actions`) và `.segment-wrap` nằm cùng một stacking context.
   - `.banner-top` trước đó có `z-index: 5`, `.banner-actions` có `z-index: 3`.
   - Trong khi đó, `.segment-wrap` có `position: sticky; top: 0; z-index: 10; background: var(--bg);`.
   - Do đó, `.segment-wrap` (z-index 10) đè lên trên `.settings-pop` (nằm trong context z-index 5/3), cắt ngang nửa dưới popover khi nó vươn dài xuống dưới.
2. **Thiếu Max-Height & Internal Scrolling**:
   - `.lang-pop` / `.settings-pop` không có `max-height` và `overflow-y: auto`, khiến popover tràn ngoài viewport khi màn hình không đủ chiều cao mà không thể cuộn được.

---

## 3. Các thay đổi đã thực hiện
Trong file `fooday_frontend/src/components/ProfileView.tsx`:
- Nâng `z-index` của `.banner-top` và `.banner-actions` từ `5` và `3` lên `25` (cao hơn `.segment-wrap` có z-index `10`, nhưng thấp hơn `.bottom-nav` có z-index `30`).
- Thêm `max-height: min(380px, calc(100dvh - 120px));` cho `.lang-pop`.
- Bổ sung `overflow-y: auto`, `overscroll-behavior: contain`, `-webkit-overflow-scrolling: touch;`.
- Thêm scrollbar thanh mảnh `4px` với `border-radius: var(--r-full)` để giữ thẩm mỹ giao diện.

---

## 4. Verification Gates Kết quả
- `npm --prefix fooday_frontend run lint`: PASS (0 errors, 0 warnings).
- `tsc --noEmit`: PASS (0 errors).
- `python -m compileall -q fooday_backend/app`: PASS (0 errors).
