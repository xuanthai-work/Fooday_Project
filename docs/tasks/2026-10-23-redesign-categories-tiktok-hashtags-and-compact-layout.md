# Task Archive: Redesign Categories, TikTok-Style Hashtags, and Streamlined Form Layout

- **Task File**: `justdoit.md`
- **Completed Date**: 2026-10-23
- **Status**: ✅ QA PASS
- **Session Mode**: continue

---

## 1. Problem Statement & User Requirements

Người dùng yêu cầu tái thiết kế các thành phần trong modal Thêm quán/món (`AddDishModal.tsx`) và Chỉnh sửa quán/món (`EditDishModal.tsx`):
1. **Danh mục (Categories)**:
   - Đổi tên:
     - `Món ăn` $\rightarrow$ **Ăn chính**
     - `Đồ uống` $\rightarrow$ **Nước nôi**
     - `Ăn vặt` $\rightarrow$ **Ăn vặt**
   - Đổi cơ chế sang **Chọn nhiều (Multi-select)**: Cho phép chọn 1, 2 hoặc cả 3 danh mục (ví dụ quán vừa bán ăn chính vừa có nước nôi). Yêu cầu giữ ít nhất 1 danh mục được chọn.
2. **Hashtag kiểu TikTok (TikTok-style Hashtags)**:
   - Bỏ toàn bộ lưới chip hashtag gợi ý dàn trải chiếm diện tích màn hình.
   - Thiết kế thành **1 ô input duy nhất**: Người dùng gõ cách ra là 1 hashtag (tự động gắn `#`).
   - Tích hợp **Dropdown gợi ý dạng list dọc** xuất hiện bên dưới ô input khi đang gõ hashtag, click vào là chèn thẳng hashtag vào ô và sẵn sàng gõ tiếp.
3. **Bỏ hẳn Đánh giá ban đầu**:
   - Xóa bỏ hoàn toàn cụm chọn 5 sao ("Đánh giá ban đầu") khỏi cả `AddDishModal` và `EditDishModal`.
   - Mặc định khởi tạo `rating = 5` khi thêm mới hoặc giữ rating cũ khi sửa.
4. **Ghi chú nhỏ gọn ở cuối cùng**:
   - Di chuyển trường Ghi chú xuống vị trí cuối cùng của form (trước các nút Hủy / Lưu).
   - Thiết kế thành ô compact gọn gàng (chiều cao 44px), không chiếm diện tích màn hình.

---

## 2. Implementation Summary

### Frontend (`fooday_frontend`)
- **`src/components/AddDishModal.tsx` & `src/components/EditDishModal.tsx`**:
  - `selectedCategories`: Quản lý danh mục dạng mảng `FoodCategory[]`. Nút danh mục toggle chọn/bỏ chọn, luôn đảm bảo giữ ít nhất 1 danh mục.
  - Loại bỏ hoàn toàn khối JSX `{/* Rating */}` và các icon `Star`.
  - Tích hợp ô hashtag TikTok: Quản lý `tagText` và `tagWord` để lọc gợi ý từ `TRENDING_HASHTAGS`, hiển thị dropdown nổi `.tag-suggest-list` với danh sách dọc thanh lịch.
  - Ô Ghi chú `.note-textarea` được chuyển xuống đáy form với chiều cao 44px, padding 10px 14px compact.
- **`src/components/HomeView.tsx` & `src/components/RandomView.tsx`**:
  - Hỗ trợ đối chiếu đa danh mục: một quán có thể xuất hiện ở tất cả các danh mục mà nó thuộc về (`f.categories?.includes(category) || f.category === category`).
- **`src/hooks/useFoods.ts`**:
  - Thêm `categories?: FoodCategory[] | null` vào interface `Food`.
  - Bổ sung `categories` vào câu truy vấn Supabase kèm fallback graceful nếu DB chưa migrate cột.
- **`src/i18n/translations.ts`**:
  - Cập nhật bản dịch danh mục: `Foods: 'Ăn chính'`, `Drinks: 'Nước nôi'`, `Snacks: 'Ăn vặt'`.
  - Bổ sung các nhãn tiếng Việt & tiếng Anh cho hashtag TikTok và ghi chú compact.

---

## 3. QA Audit & Verification Gates

```powershell
# 1. Backend Verification
python -m compileall -q fooday_backend/app
# -> Exit code: 0

# 2. Frontend Lint & Typecheck
npm --prefix fooday_frontend run lint
# -> Exit code: 0

.\fooday_frontend\node_modules\.bin\tsc.cmd --project fooday_frontend\tsconfig.json --noEmit
# -> Exit code: 0
```
