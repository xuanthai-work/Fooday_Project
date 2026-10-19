# Task Archive: Install 'motion' & Upgrade Modals with Spring Physics & Drag-to-Dismiss

- **Date:** 2026-10-19
- **Status:** PASS
- **Auditor:** Gemini (BA + QA Technical Auditor)
- **Implementer:** OpenCode (Developer Agent)

---

## 1. Yêu cầu & Mục tiêu
- Cài đặt thư viện animation chuẩn công nghiệp `motion` (Motion for React / Framer Motion).
- Nâng cấp hai modal chính (`DishDetailModal` và `AddDishModal`):
  - Tích hợp `<AnimatePresence>` quản lý vòng đời đóng/mở tự động, loại bỏ code `setTimeout` thủ công.
  - Sử dụng cơ chế vật lý lò xo (Spring Physics: `stiffness: 320, damping: 28`) cho hiệu ứng đàn hồi nảy nhẹ tự nhiên.
  - Bổ sung thanh kéo (Drag Handle) và tính năng **Drag-to-dismiss (vuốt xuống để đóng)** cho Bottom Sheet trên mobile.
  - Phản hồi xúc giác `whileTap={{ scale: 0.94 }}` cho các nút tương tác.

---

## 2. Chi tiết Triển khai
1. **`fooday_frontend/package.json`**:
   - Cài đặt thành công `motion` (`^12.x`).
2. **[fooday_frontend/src/components/DishDetailModal.tsx](fooday_frontend/src/components/DishDetailModal.tsx)**:
   - Sử dụng `<motion.div>` cho overlay và sheet.
   - Thêm `drag="y" dragConstraints={{ top: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}` và bắt `onDragEnd` tự đóng modal khi vuốt qua ngưỡng vận tốc/khoảng cách.
   - Bổ sung thanh kéo `.drag-handle` trên mobile.
   - Chuyển đổi linh hoạt giữa Bottom-sheet Spring trên mobile và Dialog Zoom & Fade trên desktop.
   - Thêm `whileTap={{ scale: 0.92 }}` cho các nút CTA, icon tim, share và close.
3. **[fooday_frontend/src/components/AddDishModal.tsx](fooday_frontend/src/components/AddDishModal.tsx)**:
   - Nâng cấp modal thêm món ăn sang `motion.div` với Spring physics mở/đóng.
4. **[fooday_frontend/src/components/HomeView.tsx](fooday_frontend/src/components/HomeView.tsx) & [fooday_frontend/src/components/ProfileView.tsx](fooday_frontend/src/components/ProfileView.tsx)**:
   - Bọc `DishDetailModal` trong `<AnimatePresence>` để kích hoạt exit animation mượt mà khi người dùng đóng.
5. **[fooday_frontend/src/components/AppShell.tsx](fooday_frontend/src/components/AppShell.tsx)**:
   - Bọc `AddDishModal` trong `<AnimatePresence>`.

---

## 3. QA Verification Gates
- [x] `npm --prefix fooday_frontend run lint`: PASSED (0 errors, 0 warnings)
- [x] `tsc --noEmit`: PASSED (0 errors)
- [x] `python -m compileall -q fooday_backend/app`: PASSED (0 errors)
- [x] Tuân thủ quy định: **KHÔNG chạy `npm run build`**.

---

## 4. Kết luận
Thư viện `motion` đã được tích hợp thành công, mang lại trải nghiệm mở/đóng và vuốt chạm chuẩn Native App. Chuyển trạng thái sang PASS và lưu trữ.
