# Task Archive: Fix Modal Mounting and Style JSX Placement

- **Date:** 2026-10-19
- **Status:** PASS
- **Auditor:** Gemini (BA + QA Technical Auditor)
- **Implementer:** OpenCode (Developer Agent)

---

## 1. Vấn đề & Nguyên nhân (Root Cause)
- **Hiện tượng**: Bấm vào card món ăn không mở được modal.
- **Nguyên nhân cốt lõi**:
  1. `useMounted()` trước đó sử dụng `useSyncExternalStore` với hàm subscribe rỗng `() => () => {}`. Khi React nạp trang trên client (hydration), nó dùng server snapshot (`false`) và không bao giờ nhận được thông báo thay đổi để chuyển sang `true`. Do đó `mounted` bị đóng băng ở `false`, khiến component luôn `return null`.
  2. `document.body.style.overflow = 'hidden'` bị gọi ngay khi mount mà không kiểm tra `dish`, khiến toàn bộ trang chủ bị khóa cuộn ngay khi vừa tải trang.
  3. `<style jsx>` bị nhét vào bên trong block điều kiện `{dish && (...)}`. Khi `dish === null`, styled-jsx không bao giờ bơm CSS vào `<head>`.

---

## 2. Giải pháp Triển khai
1. **[fooday_frontend/src/components/DishDetailModal.tsx](fooday_frontend/src/components/DishDetailModal.tsx)**:
   - Thay thế `useMounted` bằng chuẩn `useState(false)` + `useEffect(() => setMounted(true), [])`, bảo đảm 100% chuyển sang `true` ngay khi mount trên client.
   - Thay thế `useMediaQuery` bằng chuẩn `useState` + `useEffect` lắng nghe `window.matchMedia`.
   - Chỉ khóa cuộn body khi `dish !== null`:
     ```typescript
     useEffect(() => {
       if (!dish) return;
       // Khóa cuộn và lắng nghe Escape...
     }, [dish, onClose]);
     ```
   - Sử dụng React Fragment `<>` bên trong `createPortal` để đặt `<style jsx>` ra ngoài `<AnimatePresence>`. Nhờ đó CSS variables và animation keyframes luôn luôn tồn tại trong `<head>`.

---

## 3. QA Verification Gates
- [x] `npm --prefix fooday_frontend run lint`: PASSED (0 errors, 0 warnings)
- [x] `tsc --noEmit`: PASSED (0 errors)
- [x] `python -m compileall -q fooday_backend/app`: PASSED (0 errors)
- [x] Tuân thủ quy tắc an toàn: **KHÔNG chạy `npm run build`**.

---

## 4. Kết luận
Lỗi treo `mounted` và thất lạc CSS của modal đã được khắc phục hoàn toàn. Chuyển trạng thái sang PASS và lưu trữ.
