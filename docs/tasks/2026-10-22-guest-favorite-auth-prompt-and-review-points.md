# Task Archive: Tích hợp Auth Prompt khi Khách bấm Yêu thích & Nâng cấp Hệ thống Điểm thưởng Review + Ảnh

- **Ngày hoàn thành**: 2026-10-22
- **Người thực thi**: OpenCode (Developer Agent)
- **Kiểm định & Audit**: Gemini (QA / Technical Auditor)
- **Trạng thái**: PASS (Đạt toàn bộ tiêu chí)

---

## 1. Yêu cầu & Mục tiêu
1. **Guest Favorite Auth Prompt**:
   - Khi người dùng ở chế độ Khách (Guest / Anonymous user: `user?.is_anonymous || !user?.email`) bấm nút Yêu thích (Tim) trên bất kỳ món ăn nào, hệ thống chặn lưu và hiển thị `AuthPromptModal`.
   - Cung cấp 2 lựa chọn: `[Đăng nhập / Đăng ký]` (chuyển sang màn hình AuthScreen) và `[Để sau]` (đóng modal, tiếp tục duyệt món).
2. **Cơ chế tính điểm thưởng mới (Reviews & Photos)**:
   - Điểm đánh giá (review): Mỗi bài review được **+5 điểm**.
   - Thưởng ảnh trong review:
     - 1 ảnh: **+3 điểm** (tổng review = 8 điểm).
     - 2 ảnh: **+5 điểm** (tổng review = 10 điểm).
     - Từ ảnh thứ 3 trở lên (>2 ảnh): **+1 điểm/ảnh** (với $N \ge 2$, thưởng ảnh $= 5 + (N - 2) \times 1$).
   - Hỗ trợ đính kèm nhiều ảnh (tối đa 5 ảnh) khi viết review, có xem trước và lightbox phóng to.
   - Thống kê realtime số lượng đánh giá và tổng điểm thưởng trên trang Cá nhân (`ProfileView`).

---

## 2. Chi tiết Triển khai

### Frontend (`fooday_frontend`)
- **`src/lib/reviewPhotos.ts`**:
  - `MAX_REVIEW_PHOTOS = 5`, `REVIEW_POINTS_BASE = 5`.
  - `parseReviewPhotos`: Xử lý an toàn chuỗi URL đơn, chuỗi phân cách phẩy, và JSON array string.
  - `serializeReviewPhotos`: Tự động serialize tương thích cột `image_url text` của Supabase mà không cần thay đổi schema DB.
  - `calculateReviewPoints`: Tính điểm thưởng chuẩn xác theo yêu cầu đề bài.
- **`src/components/AuthPromptModal.tsx`**:
  - Modal thông báo đăng nhập thiết kế theo chuẩn Glassmorphism của Fooday.
  - Hỗ trợ React Portal, bẫy phím Escape, khóa scroll body, tích hợp nút `signOut()` để chuyển mượt về `AuthScreen`.
- **`src/hooks/useFavorites.tsx`**:
  - Kiểm tra `isGuest` ngay tại `toggleFavorite()`.
  - Quản lý state `showAuthPrompt` tập trung và nhúng `AuthPromptModal` trực tiếp trong `FavoritesProvider` giúp bảo vệ mọi màn hình (`HomeView`, `RandomView`, `DishDetailModal`) với 0 trùng lặp code.
- **`src/hooks/useReviews.ts` & `src/components/DishDetailModal.tsx`**:
  - Nâng cấp composer đánh giá: hỗ trợ chọn nhiều ảnh `multiple`, hiển thị preview dạng lưới, nút xóa từng ảnh, đếm số ảnh và gợi ý điểm thưởng.
  - Render thư viện ảnh review dạng lưới responsive, hỗ trợ lightbox phóng to xem ảnh sắc nét.
- **`src/hooks/useUserReviews.ts` & `src/components/ProfileView.tsx`**:
  - Lắng nghe realtime các bài review của user qua Supabase channel.
  - Bổ sung cột thống kê `Đánh giá` vào thanh Stats.
  - Tính tổng điểm thưởng `points = favorites * 5 + dishesAdded * 25 + reviewPoints`.
  - Tối ưu CSS responsive cho màn hình điện thoại nhỏ (`max-width: 420px`).
- **`src/i18n/translations.ts`**:
  - Bổ sung đầy đủ nhãn song ngữ (Việt - Anh) cho `authPromptModal`, `statReviews`, và các thông điệp gợi ý ảnh review.

---

## 3. Kết quả QA Verification Gates
- **Frontend Lint**: `npm --prefix fooday_frontend run lint` $\rightarrow$ PASS (0 warning, 0 error).
- **TypeScript Check**: `tsc --noEmit` $\rightarrow$ PASS (0 lỗi kiểu dữ liệu).
- **Backend Syntax Check**: `compileall` $\rightarrow$ PASS.
- **Kiến trúc & Bảo mật**: Không phá vỡ RLS Supabase, tương thích ngược 100% dữ liệu cũ, không rò rỉ token.
