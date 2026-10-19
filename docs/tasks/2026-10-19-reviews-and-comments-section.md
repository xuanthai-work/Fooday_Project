# Task Archive: Expandable Full-Screen Modal & YouTube-Style Reviews/Comments Section

**Trạng thái**: ✅ QA PASS  
**Ngày hoàn thành**: 2026-10-19  
**Người thực hiện**: OpenCode (Developer Agent)  
**QA / Reviewer**: Gemini (QA / Technical Auditor)

---

## 1. Mục tiêu
Triển khai tính năng Đánh giá & Bình luận (Reviews & Comments) cho từng món ăn bên trong `DishDetailModal`, kết hợp trải nghiệm cuộn mở rộng tràn toàn màn hình (Expandable Full-Screen Bottom Sheet phong cách YouTube/ShopeeFood):
- Modal mở dạng bottom sheet (~85dvh trên mobile).
- Khi người dùng cuộn tiếp xuống xem bình luận, modal tự động lướt mở rộng trọn vẹn màn hình (`100dvh`, bo góc chuyển phẳng) kèm thanh mini header sticky hiển thị tên quán và nút đóng.
- Khách hàng (đăng nhập hoặc ẩn danh) có thể chấm sao (1-5 ⭐) và gửi bình luận.
- Đồng bộ Realtime thời gian thực qua Supabase publication và channel chuyên biệt `reviews:food_id=eq.<id>`.
- Hỗ trợ đầy đủ ngôn ngữ tiếng Việt mặc định và tiếng Anh.

---

## 2. Thay đổi chi tiết

### Database (Supabase)
- **`fooday_frontend/supabase/0006_reviews.sql`** & **`fooday_frontend/supabase/init_all.sql`**:
  - Tạo bảng `public.reviews` với các cột: `id`, `food_id`, `user_id`, `user_name`, `rating`, `comment`, `created_at`.
  - Thiết lập RLS policies: cho phép đọc công khai (anon & authenticated), insert cho tài khoản đăng ký/khách, và xóa bình luận của chính mình (`user_id = auth.uid()`).
  - Đăng ký bảng `public.reviews` vào `supabase_realtime` publication.

### Hook & State Management
- **`fooday_frontend/src/hooks/useReviews.ts`**:
  - Hook chuyên biệt quản lý review cho từng món ăn: fetch theo `food_id`, subscribe Supabase Realtime channel độc lập, unsubscribe khi unmount.
  - Cung cấp `addReview`: optimistic update ngay lập tức và tự động rollback nếu gặp lỗi mạng.
  - Cung cấp `deleteReview`, tính toán `totalCount` và `averageRating`.

### Đa ngôn ngữ (i18n)
- **`fooday_frontend/src/i18n/translations.ts`**:
  - Bổ sung namespace `reviews` cho cả `vi` và `en` (tiêu đề, số lượng đánh giá, placeholder, mốc thời gian tương đối `justNow`, `hoursAgo`, `daysAgo`, v.v.).

### Giao diện Modal
- **`fooday_frontend/src/components/DishDetailModal.tsx`**:
  - Tích hợp thanh kéo `.drag-handle` trên mobile và nhận diện trạng thái cuộn để mở rộng `.expanded` (`100dvh`).
  - Sticky header bar trượt vào khi cuộn sâu xuống danh sách bình luận.
  - Bộ chọn số sao tương tác (1-5 ⭐), khung soạn thảo bình luận kèm avatar chữ cái đầu người dùng.
  - Danh sách bình luận hiển thị chi tiết: tên, thời gian tương đối, số sao, nội dung và nút xóa cho chủ sở hữu bình luận.
  - Tuân thủ 100% scoped styling với `styled-jsx` và quy tắc `react-hooks/purity` của React 19.

---

## 3. QA Audit & Verification Gates

| Hạng mục kiểm tra | Lệnh thực thi | Kết quả |
| :--- | :--- | :--- |
| **Frontend Lint** | `npm --prefix fooday_frontend run lint` | ✅ PASS (0 errors, 0 warnings) |
| **Frontend Typecheck** | `.\fooday_frontend\node_modules\.bin\tsc.cmd --project fooday_frontend\tsconfig.json --noEmit` | ✅ PASS |
| **Backend Compile** | `python -m compileall -q fooday_backend/app` | ✅ PASS |
| **Dev Server Safety** | Tuyệt đối không chạy `npm run build` | ✅ Đảm bảo an toàn tiến trình dev |
