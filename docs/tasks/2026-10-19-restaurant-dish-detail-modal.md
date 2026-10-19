# Task Archive: Restaurant / Dish Detail Modal & Interaction

- **Date:** 2026-10-19
- **Status:** PASS
- **Auditor:** Gemini (BA + QA Technical Auditor)
- **Implementer:** OpenCode (Developer Agent)

---

## 1. Yêu cầu & Mục tiêu
- Khi người dùng bấm vào bất kỳ card món ăn nào trên trang chủ hoặc trong danh sách yêu thích (`ProfileView`), hiển thị modal chi tiết (Bottom sheet trên mobile, Dialog trên desktop).
- Modal hiển thị:
  - Ảnh đại diện lớn (hero 16:9), nút Thả tim đồng bộ với `useFavorites`, nút Chia sẻ (Web Share API + copy link toast).
  - Tên quán (tiêu đề chính), tên món (phụ đề), Tag, Rating sao vàng.
  - Khối thông tin chi tiết:
    - 📍 Địa chỉ cụ thể + link mở Google Maps 1-click (`https://www.google.com/maps/search/?api=1&query=...`).
    - ⏰ Giờ mở cửa.
    - 💡 Mẹo & Đánh giá (Review note).
  - Khối nút hành động:
    - Nút chính: "Hỏi Foodie AI về quán này" (chuyển sang `/chat` kèm nội dung hỏi tự động).
    - Nút phụ: "Chỉ đường" mở Google Maps.
- Hỗ trợ đa ngôn ngữ đầy đủ (cả tiếng Việt mặc định và tiếng Anh) thông qua hệ thống i18n mới.

---

## 2. Các thay đổi đã thực hiện
1. **[fooday_frontend/src/hooks/useFoods.ts](fooday_frontend/src/hooks/useFoods.ts)**:
   - Mở rộng interface `Food` thêm `address`, `opening_time`, `review_note`.
   - Cập nhật biến `COLUMNS` truy vấn Supabase để lấy các trường chi tiết này.
2. **[fooday_frontend/src/i18n/translations.ts](fooday_frontend/src/i18n/translations.ts)**:
   - Thêm nhóm từ điển `detail` cho cả `vi` và `en`: nhãn địa chỉ, giờ mở cửa, ghi chú đánh giá, chỉ đường, hỏi AI, chia sẻ, sao chép liên kết, v.v.
3. **[fooday_frontend/src/components/DishDetailModal.tsx](fooday_frontend/src/components/DishDetailModal.tsx)**:
   - Tạo mới component Mobile-first Bottom Sheet modal.
   - Hỗ trợ đóng khi bấm nền mờ, bấm icon `X`, hoặc bấm phím `Escape`.
   - Khóa cuộn trang `body.style.overflow = 'hidden'` khi modal mở.
   - Nút thả tim phản hồi tương tác mượt mà với hoạt ảnh `heartPop`.
4. **[fooday_frontend/src/components/HomeView.tsx](fooday_frontend/src/components/HomeView.tsx)**:
   - Tích hợp `selectedDish` state. Thêm `role="button"` và `onKeyDown` (Enter/Space) cho accessibility.
   - Gọi `e.stopPropagation()` cho nút thả tim và nút Ask AI để tránh mở đè modal khi người dùng bấm trực tiếp vào các nút này.
5. **[fooday_frontend/src/components/ProfileView.tsx](fooday_frontend/src/components/ProfileView.tsx)**:
   - Tích hợp `DishDetailModal` khi click vào món ăn trong danh sách yêu thích.
6. **[fooday_frontend/supabase/0005_add_details.sql](fooday_frontend/supabase/0005_add_details.sql)**:
   - File migration mẫu hỗ trợ bổ sung các cột `address`, `opening_time`, `review_note` nếu áp dụng trên database mới.

---

## 3. QA Verification Gates
- [x] `npm --prefix fooday_frontend run lint`: PASSED (0 errors, 0 warnings)
- [x] `tsc --noEmit`: PASSED (0 errors)
- [x] `npm --prefix fooday_frontend run build`: PASSED (Compiled successfully in 1.7s, prerendered static pages)
- [x] `python -m compileall -q fooday_backend/app`: PASSED (0 syntax errors)

---

## 4. Kết luận
Task đã được kiểm thử, thẩm định chất lượng code và đạt đầy đủ tiêu chuẩn nghiệm thu. Chuyển trạng thái sang PASS và lưu trữ.
