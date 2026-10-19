# Task Archive: Fix DishDetailModal Position and Rendering with React Portal

- **Date:** 2026-10-19
- **Status:** PASS
- **Auditor:** Gemini (BA + QA Technical Auditor)
- **Implementer:** OpenCode (Developer Agent)

---

## 1. Vấn đề & Nguyên nhân (Root Cause)
- **Hiện tượng**: Khi người dùng bấm vào một card món ăn trên trang chủ, toàn bộ màn hình chỉ bị tối và mờ đi (backdrop) mà không nhìn thấy modal chi tiết ở đâu.
- **Nguyên nhân**:
  - `HomeView` sử dụng class `.animate-fade-in` có `animation: fadeInUp ... both;`. Do `transform: translateY(0)` giữ nguyên ở trạng thái sau animation, theo chuẩn CSS Transforms của W3C, thẻ `.home` đã trở thành **containing block** cho phần tử con có `position: fixed`.
  - Kết hợp với container cuộn `.app-content` có chiều cao thực tế lên đến 2000px - 3000px, `.detail-overlay` (`position: fixed; inset: 0`) bị ghim theo kích thước của `.home` thay vì viewport trình duyệt.
  - Khi modal áp dụng `align-items: flex-end`, phần sheet `.detail-sheet` bị đẩy xuống tận đáy của trang cuộn, hoàn toàn nằm ngoài tầm nhìn của người dùng (người dùng chỉ thấy lớp mờ ở đầu trang).

---

## 2. Giải pháp Triển khai
1. **[fooday_frontend/src/components/DishDetailModal.tsx](fooday_frontend/src/components/DishDetailModal.tsx)**:
   - Sử dụng `createPortal` từ `react-dom` để đưa trực tiếp cấu trúc DOM của modal ra ngoài `document.body`.
   - Sử dụng `useSyncExternalStore` để đảm bảo SSR / hydration-safe khi gắn portal trên client.
   - Thiết lập `.detail-overlay` với `position: fixed; inset: 0; width: 100vw; height: 100dvh; z-index: 100;`, đảm bảo luôn bám theo viewport màn hình bất kể người dùng đang cuộn trang ở đâu.
   - Bổ sung fallback an toàn cho rating: `Number(dish.rating ?? 0)` và `image_url`.

---

## 3. QA Verification Gates
- [x] `npm --prefix fooday_frontend run lint`: PASSED (0 errors, 0 warnings)
- [x] `tsc --noEmit`: PASSED (0 errors)
- [x] `python -m compileall -q fooday_backend/app`: PASSED (0 errors)
- [x] Tuyệt đối **KHÔNG chạy `npm run build`** theo đúng quy định an toàn.

---

## 4. Kết luận
Modal đã được đưa ra ngoài container cuộn bằng React Portal, hiển thị chính xác ở giữa màn hình (desktop) hoặc trượt từ đáy màn hình lên (mobile). Chuyển trạng thái sang PASS và lưu trữ.
