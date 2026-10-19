# Task Archive: Redesign Dashboard Categories by Real-World Food Mood & Task

**Trạng thái**: ✅ QA PASS  
**Ngày hoàn thành**: 2026-10-19  
**Người thực hiện**: OpenCode (Developer Agent)  
**QA / Reviewer**: Gemini (QA / Technical Auditor)

---

## 1. Mục tiêu
Tái cấu trúc danh mục tại Trang Chủ (`HomeView.tsx`):
- **Loại bỏ cả 2 hàng cũ**: Xóa sạch hàng tag gợi ý nhanh và hàng category cũ (Foods/Drinks/Snacks), giải phóng hoàn toàn không gian màn hình, tránh chiếm chỗ và gây rối mắt.
- **Thay thế bằng DUY NHẤT 1 HÀNG Danh mục theo "Mục đích & Nhu cầu thực tế (Mood & Task)"**:
  1. 🌟 **Tất cả** (`All`)
  2. 💼 **Cơm trưa văn phòng** (`OfficeLunch`: Cơm, bún, phở, mì, bánh mì, hủ tiếu, xôi)
  3. 🍻 **Lẩu nướng & Tụ tập** (`Gathering`: Lẩu, nướng, bbq, buffet, nhậu, hải sản)
  4. 🥗 **Chay & Healthy** (`Healthy`: Đồ chay, thuần chay, eat clean, salad, thanh đạm)
  5. ☕ **Cà phê & Làm việc** (`WorkCafe`: Cà phê, trà, yên tĩnh, làm việc)
  6. 🧋 **Ăn vặt & Trà chiều** (`AfternoonTea`: Trà sữa, chè, ăn vặt, bánh ngọt, ốc)
  7. 🍷 **Hẹn hò lãng mạn** (`Romantic`: Không gian ấm cúng, view đẹp, hẹn hò, bít tết, sushi)
- **Giữ nguyên 100% Engine Search thông minh không dấu**: Cho phép người dùng gõ tìm bất kỳ món cụ thể nào (`bun`, `chay`, `nuong`, `pizza`, tên quán, địa chỉ...).

---

## 2. Thay đổi chi tiết

### Giao diện & Xử lý Bộ lọc (`fooday_frontend/src/components/HomeView.tsx`)
- Định nghĩa mảng `MOOD_TASKS` chứa 7 mục tiêu ăn uống kèm icon, label và từ khóa ngữ nghĩa tương ứng.
- Hàm `itemMatchesMood(item, mood)`:
  - Nếu chọn `'All'`: Hiển thị tất cả.
  - Tự động chuẩn hóa không dấu và quét đối chiếu các từ khóa trên `item.name`, `item.restaurant`, `item.tag` và `item.review_note`.
- Kết hợp với engine search: Quán hiển thị vừa phải thỏa mãn Mood đã chọn, vừa khớp từ khóa tìm kiếm (nếu có gõ vào ô search).
- Giao diện `.mood-categories`:
  - 1 hàng cuộn ngang duy nhất, mỗi chip có icon emoji và nhãn chữ rõ ràng.
  - Xóa bỏ hoàn toàn `.quick-tags-wrap` và `.categories` cũ.

### Đa ngôn ngữ (`fooday_frontend/src/i18n/translations.ts`)
- Thêm namespace `moods` trong `home` cho cả tiếng Việt và tiếng Anh.

---

## 3. QA Audit & Verification Gates

| Hạng mục kiểm tra | Lệnh thực thi | Kết quả |
| :--- | :--- | :--- |
| **Frontend Lint** | `npm --prefix fooday_frontend run lint` | ✅ PASS (0 errors, 0 warnings) |
| **Frontend Typecheck** | `.\fooday_frontend\node_modules\.bin\tsc.cmd --project fooday_frontend\tsconfig.json --noEmit` | ✅ PASS |
| **Backend Compile** | `python -m compileall -q fooday_backend/app` | ✅ PASS |
| **Dev Server Safety** | Tuyệt đối không chạy `npm run build` | ✅ Đảm bảo an toàn tiến trình dev |
