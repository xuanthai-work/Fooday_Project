# Task Archive: Remove Redundant Close Button from Hero Section in DishDetailModal

- **Date**: 2026-10-20
- **Status**: ✅ PASS (QA Verified)
- **Executor**: Developer Agent (OpenCode)
- **Reviewer / Technical Auditor**: Gemini

---

## 1. Objective & Overview
Khi modal chi tiết quán/món ăn (`DishDetailModal.tsx`) ở trạng thái trượt lên (sheet/modal chưa full màn hình), người dùng có thể nhấp ra ngoài khoảng trống (backdrop overlay) để đóng modal.
Việc để nút X trong cụm nút góc trên bên phải của hero (`hero-top-right`) làm cho cụm nút bị chật chội (có 3 nút: Sửa, Chia sẻ, Đóng).
Nhiệm vụ:
- Bỏ nút `[X]` (Close) trong `hero-top-right` của `DishDetailModal.tsx`.
- Giữ lại nút `[X]` trong `sticky-bar` khi cuộn trang lên full-screen (vì lúc đó nội dung modal che phủ toàn màn hình).
- Cụm nút `hero-top-right` chỉ còn 2 nút gọn gàng: nút Chỉnh sửa (`Pencil`) và nút Chia sẻ (`Share2`).

---

## 2. Target File & Key Changes
- `fooday_frontend/src/components/DishDetailModal.tsx`:
  - Loại bỏ nút close `<button className="icon-btn" onClick={handleClose} ...><X size={20} /></button>` khỏi `hero-top-right`.
  - Giữ nguyên sự kiện click backdrop overlay và nút close trong `sticky-bar`.

---

## 3. Verification & QA Audit
- **Frontend Lint**: `npm --prefix fooday_frontend run lint` -> **PASS (0 errors)**
- **Frontend Typecheck**: `tsc --noEmit` -> **PASS (0 errors)**

---

## 4. Dev Execution Telemetry
- **Exit Code**: 0 (DONE)
- **Session Mode**: fresh
- **Changed Files**:
```text
 M fooday_frontend/src/components/DishDetailModal.tsx
```
