# Task Archive: Fix Supabase Realtime Favorites Channel Collision

- **Date:** 2026-10-19
- **Status:** PASS
- **Auditor:** Gemini (BA + QA Technical Auditor)
- **Implementer:** OpenCode (Developer Agent)

---

## 1. Vấn đề & Nguyên nhân (Root Cause)
- **Lỗi Runtime**: `cannot add 'postgres_changes' callbacks for realtime:favorites:<user_id> after subscribe()`.
- **Nguyên nhân**: Khi người dùng mở `DishDetailModal` trên trang chủ, cả `HomeView` và `DishDetailModal` đều thực thi hook `useFavorites()`. Mỗi instance hook tạo một `useEffect` gọi `supabase.channel('favorites:<user_id>')` và `.subscribe()`. Vì channel trong `@supabase/supabase-js` là singleton theo tên topic, instance thứ hai gọi `.on('postgres_changes', ...)` sau khi channel đã được subscribe bởi instance đầu tiên, dẫn tới việc Supabase throw runtime error. Khi modal đóng, `removeChannel` còn làm ngắt luôn kết nối Realtime của trang chủ.

---

## 2. Giải pháp Triển khai
1. **[fooday_frontend/src/hooks/useFavorites.tsx](fooday_frontend/src/hooks/useFavorites.tsx)**:
   - Chuyển đổi quản lý state favorites thành `FavoritesProvider` (React Context).
   - Duy trì duy nhất **1 Realtime channel subscription** cho toàn bộ app trong suốt phiên đăng nhập của người dùng.
   - Sử dụng `useRef` và `useMemo` để tối ưu render, hàm `toggleFavorite` không bị re-create liên tục.
   - Hook `useFavorites()` tiếp tục cung cấp cùng interface `{ favorites, toggleFavorite, ready }`, đảm bảo 100% tương thích ngược với các components đang gọi (`HomeView`, `ProfileView`, `RandomView`, `ChatView`, `DishDetailModal`).
2. **[fooday_frontend/src/components/AppShell.tsx](fooday_frontend/src/components/AppShell.tsx)**:
   - Tích hợp `<FavoritesProvider>` bao bọc `<ShellInner>` bên trong `<AuthProvider>`.

---

## 3. QA Verification Gates
- [x] `npm --prefix fooday_frontend run lint`: PASSED (0 errors, 0 warnings)
- [x] `tsc --noEmit`: PASSED (0 errors)
- [x] `python -m compileall -q fooday_backend/app`: PASSED (0 syntax errors)
- [x] Tuân thủ quy tắc mới: **KHÔNG chạy `npm run build`** trong suốt quá trình QA.

---

## 4. Kết luận
Lỗi xung đột channel Supabase Realtime đã được giải quyết triệt để và kiến trúc quản lý state favorites được tối ưu hóa thành singleton context. Chuyển trạng thái sang PASS và lưu trữ.
