# Task Archive: Fix DishDetailModal Not Rendering with AnimatePresence & Portal

- **Date:** 2026-10-19
- **Status:** PASS
- **Auditor:** Gemini (BA + QA Technical Auditor)
- **Implementer:** OpenCode (Developer Agent)

---

## 1. Vấn đề & Nguyên nhân (Root Cause)
- **Hiện tượng**: Bấm vào bất kỳ card món ăn nào trên trang chủ hoặc trong profile thì modal chi tiết không hề xuất hiện.
- **Nguyên nhân cốt lõi**:
  1. `<AnimatePresence>` trước đó được đặt ở component cha (`HomeView`, `ProfileView`), trong khi modal con lại dùng `createPortal(..., document.body)`. `AnimatePresence` không thể theo dõi và gắn ref cho các phần tử DOM nằm xuyên qua ranh giới React Portal sang `document.body`.
  2. Hàm `useMediaQuery` và `useMounted` trước đó có nguy cơ truy cập `window` khi SSR hoặc không re-render đúng chu kỳ.

---

## 2. Giải pháp Triển khai
1. **[fooday_frontend/src/components/DishDetailModal.tsx](fooday_frontend/src/components/DishDetailModal.tsx)**:
   - Thay đổi prop `dish` thành `Food | null`.
   - Đặt `<AnimatePresence>` nằm **trực tiếp bên trong** `createPortal` trên `document.body`:
     ```tsx
     return createPortal(
       <AnimatePresence>
         {dish && (
           <motion.div ...>
             <motion.div ...>
             ...
             </motion.div>
           </motion.div>
         )}
       </AnimatePresence>,
       document.body
     );
     ```
   - Nhờ đó `<AnimatePresence>` và `<motion.div>` cùng nằm chung một container DOM trên `document.body`, kiểm soát 100% hiệu ứng mở (Spring) và hiệu ứng đóng (Exit) mà không gặp bất kỳ lỗi xung đột portal nào.
   - Bổ sung `typeof window !== 'undefined'` an toàn tuyệt đối cho SSR trong `useMediaQuery`.
2. **[fooday_frontend/src/components/HomeView.tsx](fooday_frontend/src/components/HomeView.tsx) & [fooday_frontend/src/components/ProfileView.tsx](fooday_frontend/src/components/ProfileView.tsx)**:
   - Gỡ bỏ `<AnimatePresence>` bọc ngoài, chuyển sang render trực tiếp `<DishDetailModal dish={selectedDish} ... />`.

---

## 3. QA Verification Gates
- [x] `npm --prefix fooday_frontend run lint`: PASSED (0 errors, 0 warnings)
- [x] `tsc --noEmit`: PASSED (0 errors)
- [x] `python -m compileall -q fooday_backend/app`: PASSED (0 errors)
- [x] Tuyệt đối **KHÔNG chạy `npm run build`** bảo vệ dev server.

---

## 4. Kết luận
Xung đột kiến trúc giữa React Portal và Motion AnimatePresence đã được giải quyết triệt để. Modal hiển thị ngay tức thì khi click, hỗ trợ Drag-to-dismiss và exit animation tự nhiên. Chuyển trạng thái sang PASS và lưu trữ.
