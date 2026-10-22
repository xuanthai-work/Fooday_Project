# Task Archive: Căn chỉnh Avatar Stack Contributors sát phải (mở rộng dần ra giữa) trong DishDetailModal

- **Ngày hoàn thành**: 2026-10-22
- **Người thực thi**: OpenCode (Developer Agent)
- **Kiểm định & Audit**: Gemini (QA / Technical Auditor)
- **Trạng thái**: PASS (Đạt toàn bộ tiêu chí)

---

## 1. Yêu cầu & Mục tiêu
- Căn chỉnh vị trí của Avatar Stack Contributors trên modal chi tiết món (`DishDetailModal`):
  - Tách `.detail-sub-row` thành hàng riêng biệt full-width ngay dưới header quán.
  - Tên món ăn (`detail-sub`) nằm ở bên trái.
  - Avatar Stack (`stack-trigger`) căn **sát lề phải** (`margin-left: auto; justify-content: flex-end;`).
  - Khi có nhiều contributors, hàng avatar tự động nở rộng dần về phía bên trái (hướng ra giữa) mà không đè lên tên món.

---

## 2. Chi tiết Triển khai
- **`fooday_frontend/src/components/DishDetailModal.tsx`**:
  - Di chuyển `.detail-sub-row` ra khỏi `.detail-head-text` thành hàng ngang độc lập full-width (`width: 100%`).
  - Cập nhật CSS:
    - `.detail-sub-row`: `display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 6px; width: 100%;`
    - `.detail-sub`: `flex: 0 1 auto; min-width: 0; overflow: hidden;` kèm `text-overflow: ellipsis` đảm bảo an toàn nếu tên món dài.
    - `.stack-trigger`: `margin-left: auto; display: inline-flex; align-items: center; justify-content: flex-end; flex-shrink: 0;`

---

## 3. Kết quả QA Verification Gates
- **Frontend Lint**: `npm --prefix fooday_frontend run lint` $\rightarrow$ PASS (0 warning, 0 error).
- **TypeScript Check**: `tsc --noEmit` $\rightarrow$ PASS (0 error).
- **Backend Syntax Check**: `compileall` $\rightarrow$ PASS.
