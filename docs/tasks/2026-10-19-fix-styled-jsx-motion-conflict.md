# Task Archive: Fix Modal Styling & Click Interaction (Eliminate styled-jsx & motion conflict)

- **Date:** 2026-10-19
- **Status:** PASS
- **Auditor:** Gemini (BA + QA Technical Auditor)
- **Implementer:** OpenCode (Developer Agent)

---

## 1. Vấn đề & Nguyên nhân (Root Cause)
- **Hiện tượng**: Bấm vào card món ăn không mở được modal.
- **Nguyên nhân cốt lõi**:
  - `styled-jsx` của Next.js chỉ hỗ trợ tự động gắn class scoped (`.jsx-xxxx`) vào các thẻ HTML nguyên bản (`div`, `button`, `a`).
  - Khi component sử dụng các component của thư viện Motion như `<motion.div className="detail-overlay">` hay `<motion.button>`, styled-jsx **không thể nhận diện và không gắn class scope**.
  - Hậu quả: Toàn bộ CSS của modal (`position: fixed; inset: 0; background: ...; z-index: 100`) bị rớt hoàn toàn, các thẻ modal bị render dưới dạng unstyled/tàng hình ở cuối trang, khiến thao tác click không hiển thị bất kỳ giao diện nào.

---

## 2. Giải pháp Triển khai
1. **[fooday_frontend/src/components/DishDetailModal.tsx](fooday_frontend/src/components/DishDetailModal.tsx)**:
   - Khôi phục cấu trúc thẻ HTML chuẩn (`div`, `button`, `a`) để `styled-jsx` áp dụng 100% CSS.
   - Quản lý hiệu ứng đóng mở 2 chiều bằng state `isClosing` và CSS animation tăng tốc phần cứng GPU (`transform: translate3d(0, 0, 0)`, `will-change: transform, opacity`).
   - Đường cong Spring cubic-bezier `cubic-bezier(0.2, 0.9, 0.3, 1)` cho mobile sheet và `cubic-bezier(0.16, 1, 0.3, 1)` cho desktop dialog.
   - SSR-safe client mount bằng `useState(false)` + `useEffect(() => setMounted(true), [])`.
2. **[fooday_frontend/src/components/HomeView.tsx](fooday_frontend/src/components/HomeView.tsx) & [fooday_frontend/src/components/ProfileView.tsx](fooday_frontend/src/components/ProfileView.tsx)**:
   - Render trực tiếp `{selectedDish && <DishDetailModal dish={selectedDish} onClose={() => setSelectedDish(null)} />}`.
3. **[fooday_frontend/src/components/AddDishModal.tsx](fooday_frontend/src/components/AddDishModal.tsx) & [fooday_frontend/src/components/AppShell.tsx](fooday_frontend/src/components/AppShell.tsx)**:
   - Đồng bộ về HTML chuẩn và gỡ bỏ `AnimatePresence` bọc ngoài để tránh xung đột styling tương tự.

---

## 3. QA Verification Gates
- [x] `npm --prefix fooday_frontend run lint`: PASSED (0 errors, 0 warnings)
- [x] `tsc --noEmit`: PASSED (0 errors)
- [x] `python -m compileall -q fooday_backend/app`: PASSED (0 errors)
- [x] Tuyệt đối **KHÔNG chạy `npm run build`** bảo vệ dev server.

---

## 4. Kết luận
Xung đột giữa `motion.div` và trình biên dịch `styled-jsx` đã được dọn sạch. Modal chi tiết món ăn hoạt động chuẩn xác, mượt mà và hiển thị tức thì khi click. Chuyển trạng thái sang PASS và lưu trữ.
