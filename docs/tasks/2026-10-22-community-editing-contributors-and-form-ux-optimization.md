# Task Archive: Mở quyền sửa món cộng đồng, Contributors kiểu GitHub & Tối ưu Form Thêm/Sửa Món Ăn

- **Ngày hoàn thành**: 2026-10-22
- **Người thực thi**: OpenCode (Developer Agent)
- **Kiểm định & Audit**: Gemini (QA / Technical Auditor)
- **Trạng thái**: PASS (Đạt toàn bộ tiêu chí)

---

## 1. Yêu cầu & Mục tiêu
1. **Mở quyền Chỉnh sửa cộng đồng**: Cho phép bất kỳ người dùng nào đã đăng nhập (`authenticated`, không phải guest) đều có quyền cập nhật thông tin quán / món ăn.
2. **Cơ chế Contributors kiểu GitHub**:
   - Ghi nhận người khởi tạo (`created_by`) và danh sách những người đã từng chỉnh sửa (`contributors`).
   - Hiển thị khối Contributors (👑 Người khởi tạo + 🤝 Avatar stack người đóng góp) trên thẻ chi tiết món [`DishDetailModal`](file:///D:/work/Stuff/Fooday_Project/fooday_frontend/src/components/DishDetailModal.tsx).
3. **Tối ưu UX Form Thêm & Chỉnh sửa món (`AddDishModal` & `EditDishModal`)**:
   - Sắp xếp lại thứ tự trường: `Tên quán` $\rightarrow$ `Tên món` $\rightarrow$ `Danh mục` $\rightarrow$ `Giờ mở cửa` $\rightarrow$ `Địa chỉ chính` $\rightarrow$ `Các cơ sở khác` $\rightarrow$ `Ghi chú` $\rightarrow$ `Hashtags` $\rightarrow$ `Đánh giá & Ảnh`.
   - Đổi nhãn: Giữ "Ghi chú", bỏ chữ "& Đánh Giá" (`reviewNote: 'Ghi chú'` / `'Notes'`).
   - Xóa bỏ dòng chữ phụ đề *"Thêm các cơ sở khác của quán — dán link Google Maps để tự động điền địa chỉ."*.
   - Trong `BranchEditor`: Bỏ trường "Tên chi nhánh", quy ước các cơ sở dùng chung tên quán và đánh số `Cơ sở 1`, `Cơ sở 2`...
   - Tích hợp cơ chế tự động thu gọn (Accordion): Khi dán xong link Maps hoặc bấm thêm cơ sở mới, các cơ sở trước tự động thu gọn thành 1 dòng tóm tắt duy nhất có nút Sửa/Xóa.

---

## 2. Chi tiết Triển khai

### Database & RLS Policy (`fooday_frontend/supabase/`)
- **`0011_contributors_and_edit_policy.sql`**:
  - Cập nhật RLS Policy `foods_update_authenticated`: Mọi user authenticated (không phải anonymous guest) được update bảng `foods`.
  - Bổ sung cột `contributors jsonb default '[]'::jsonb` cho bảng `foods`.
  - Cập nhật đồng bộ vào `init_all.sql`.

### Frontend (`fooday_frontend`)
- **`src/hooks/useFoods.ts`**:
  - Định nghĩa interface `Contributor` (`id`, `name`, `avatar_url`, `updated_at`).
  - Cập nhật `Food.contributors`.
  - Viết hàm `parseContributors` an toàn.
  - Cơ chế truy vấn 2 tầng fallback: `COLUMNS_WITHOUT_CONTRIBUTORS` và `COLUMNS_WITHOUT_BRANCHES` đảm bảo an toàn 100% ngay cả khi DB chưa chạy migration.
- **`src/components/BranchEditor.tsx`**:
  - Bỏ hoàn toàn input `Tên chi nhánh`.
  - Accordion state `activeBranchId`: Mỗi lần thêm mới hoặc dán xong link Maps, cơ sở tự động gấp gọn thành 1 hàng tóm tắt: `📍 Cơ sở 1: <Địa chỉ/Link> [Sửa] [X]`.
  - Giao diện form luôn giữ được sự gọn gàng, không bị cuộn dài.
- **`src/components/DishDetailModal.tsx`**:
  - Hiển thị khối **Contributors** đẹp mắt trước phần đánh giá.
  - Hàng Creator với icon vương miện 👑 + Avatar + Tên.
  - Hàng Avatar Stack chồng nhau kiểu GitHub cho những người đã từng chỉnh sửa quán.
- **`src/components/AddDishModal.tsx` & `EditDishModal.tsx`**:
  - Sắp xếp lại thứ tự trường theo luồng thông tin quán $\rightarrow$ món $\rightarrow$ giờ mở cửa $\rightarrow$ địa chỉ $\rightarrow$ chi nhánh $\rightarrow$ ghi chú $\rightarrow$ tag $\rightarrow$ rating.
  - Xóa dòng phụ đề thừa.
  - Đổi nhãn `reviewNote` thành `Ghi chú`.
  - Tự động lưu `contributors` khi người dùng chỉnh sửa quán.
- **`src/i18n/translations.ts`**:
  - Bổ sung các bản dịch tiếng Việt và tiếng Anh cho các nhãn `createdBy`, `contributors`, `community`, `branchTitle`, `editBranch`, `collapseBranch`, `doneBranch`, v.v.

---

## 3. Kết quả QA Verification Gates
- **Frontend Lint**: `npm --prefix fooday_frontend run lint` $\rightarrow$ PASS (0 errors, 0 warnings).
- **TypeScript Check**: `tsc --noEmit` $\rightarrow$ PASS (0 type errors).
- **Backend Syntax Check**: `compileall` $\rightarrow$ PASS.
- **Tương thích ngược**: An toàn tuyệt đối, không làm hỏng dữ liệu món ăn hiện có.
