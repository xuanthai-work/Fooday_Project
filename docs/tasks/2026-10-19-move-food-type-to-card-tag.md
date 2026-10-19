# Task Archive: Move Food Type to Top-Left Tag on Food Cards

**Trạng thái**: ✅ QA PASS  
**Ngày hoàn thành**: 2026-10-19  
**Người thực hiện**: OpenCode (Developer Agent)  
**QA / Reviewer**: Gemini (QA / Technical Auditor)

---

## 1. Mục tiêu
Tái cấu trúc hiển thị thông tin trên các Card món ăn tại trang chủ (`HomeView.tsx`):
- Chuyển loại món ăn (`item.name` như Buffet, Xôi, Phở,...) thành Tag Pill thủy tinh mờ (Glassmorphism) đặt ở góc trên bên trái của ảnh, ngang hàng với nút tim yêu thích ở góc trên bên phải.
- Loại bỏ dòng chữ loại món ăn lặp lại bên dưới tên quán, giúp tên quán (`item.restaurant`) nổi bật làm tiêu đề chính, tạo bố cục sạch sẽ, thoáng mắt và hiện đại.

---

## 2. Thay đổi chi tiết

### Frontend (`fooday_frontend/src/components/HomeView.tsx`)
- Thêm tag `.card-type-tag`:
  - Đặt trong `.card-media`: `{item.name && <span className="card-type-tag">{item.name}</span>}`.
  - Vị trí: `top: 8px; left: 8px; z-index: 2`, ngang hàng với nút tim `.fav` (`top: 8px; right: 8px; z-index: 2`).
  - Styling: nền glassmorphism `rgba(15, 23, 42, 0.65)` kèm `backdrop-filter: blur(8px)`, viền `1px solid rgba(255, 255, 255, 0.2)`, bo góc `var(--r-full)`, chữ trắng đậm sắc nét.
  - Xử lý xếp lớp `.card-type-tag + .card-tag { top: 38px; }` ngăn chặn đè lấn nếu có thẻ phụ.
  - Thiết lập `pointer-events: none` để bấm vào vùng tag vẫn kích hoạt mở modal chi tiết món ăn.
- Phần thân `.card-body`:
  - Loại bỏ `<p className="card-place">{item.name}</p>`.
  - Tên quán `.card-name` bổ sung `margin-bottom: 8px` giúp cân đối khoảng cách tới rating và nút Hỏi AI.

---

## 3. QA Audit & Verification Gates

| Hạng mục kiểm tra | Lệnh thực thi | Kết quả |
| :--- | :--- | :--- |
| **Frontend Lint** | `npm --prefix fooday_frontend run lint` | ✅ PASS (0 errors, 0 warnings) |
| **Frontend Typecheck** | `.\fooday_frontend\node_modules\.bin\tsc.cmd --project fooday_frontend\tsconfig.json --noEmit` | ✅ PASS |
| **Backend Compile** | `python -m compileall -q fooday_backend/app` | ✅ PASS |
| **Dev Server Safety** | Tuyệt đối không chạy `npm run build` | ✅ Đảm bảo tiến trình dev an toàn |
