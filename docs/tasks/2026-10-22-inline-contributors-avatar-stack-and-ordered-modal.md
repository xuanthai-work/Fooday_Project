# Task Archive: Chuyển Avatar Stack Contributors ngang hàng tên món & Modal danh sách đóng góp xếp theo thứ tự

- **Ngày hoàn thành**: 2026-10-22
- **Người thực thi**: OpenCode (Developer Agent)
- **Kiểm định & Audit**: Gemini (QA / Technical Auditor)
- **Trạng thái**: PASS (Đạt toàn bộ tiêu chí)

---

## 1. Yêu cầu & Mục tiêu
1. **Xóa bỏ khối Contributors lớn**: Xóa bỏ box riêng biệt cồng kềnh (`NGƯỜI KHỞI TẠO / Cộng đồng Fooday`) nằm giữa thông tin cơ sở và phần review.
2. **Avatar Stack ngang hàng với loại / tên món**: Đặt các avatar tròn nhỏ xếp chồng nhẹ nhàng (như GitHub contributors) ngay cạnh tên món ăn (`detail-sub`) trên header của [`DishDetailModal`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/components/DishDetailModal.tsx).
3. **Modal xem chi tiết danh sách tài khoản đóng góp**: Khi bấm vào Avatar Stack, mở modal danh sách người đóng góp:
   - 👑 **Người tạo (Creator)**: Luôn đứng ở vị trí đầu tiên kèm icon vương miện. Nếu là món do chính user tạo, hiển thị tên tài khoản kèm badge `(Bạn)`.
   - 🛠️ **Người đóng góp (Contributors)**: Xếp từ trên xuống dưới theo thứ tự người đóng góp gần nhất (`updated_at` mới nhất lên đầu).
4. **Lưu vĩnh viễn thông tin Creator khi thêm món mới**: Trong [`AddDishModal.tsx`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/components/AddDishModal.tsx), lưu thông tin tác giả với `role: 'creator'` vào mảng `contributors` để luôn có tên và avatar của người tạo.

---

## 2. Chi tiết Triển khai

### Frontend (`fooday_frontend`)
- **`src/hooks/useFoods.ts`**:
  - Bổ sung `ContributorRole = 'creator' | 'contributor'`.
  - Cập nhật hàm `parseContributors` nhận diện `role`.
- **`src/components/DishDetailModal.tsx`**:
  - Xóa bỏ khối `<section className="contributors">` lớn.
  - Thêm cụm Avatar Stack inline (`.stack-trigger`) ngay trong `.detail-sub-row` cạnh tên món ăn.
  - Tích hợp Modal danh sách đóng góp (`.contrib-modal`):
    - Người khởi tạo đứng đầu với avatar + vương miện 👑 + nhãn `Người khởi tạo` + nhãn `(Bạn)` nếu là chính mình.
    - Danh sách người chỉnh sửa xếp theo thời gian mới nhất $\rightarrow$ cũ nhất (`updated_at` desc).
    - Hỗ trợ phím `Escape`, backdrop blur, khóa scroll body khi mở modal.
- **`src/components/AddDishModal.tsx`**:
  - Khi người dùng đăng món mới, tự động khởi tạo `initialContributors` với `role: 'creator'` kèm tên, avatar và timestamp, lưu vào payload của `foods`.
- **`src/components/EditDishModal.tsx`**:
  - Bảo tồn thông tin `creator` ban đầu khi người khác chỉnh sửa món, đồng thời ghi nhận người chỉnh sửa mới với `role: 'contributor'` và timestamp cập nhật mới nhất.
- **`src/i18n/translations.ts`**:
  - Bổ sung các nhãn `you` (Bạn), `close` (Đóng).

---

## 3. Kết quả QA Verification Gates
- **Frontend Lint**: `npm --prefix fooday_frontend run lint` $\rightarrow$ PASS (0 warning, 0 error).
- **TypeScript Check**: `tsc --noEmit` $\rightarrow$ PASS (0 error).
- **Backend Syntax Check**: `compileall` $\rightarrow$ PASS.
