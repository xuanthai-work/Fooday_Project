# Task Archive: Smart Chain Detection & Multi-Branch Merge Workflow

- **Task File**: `justdoit.md`
- **Completed Date**: 2026-10-23
- **Status**: ✅ QA PASS
- **Session Mode**: fresh

---

## 1. Problem Statement & User Requirements

Trong hệ thống Fooday, nhiều quán ăn có **nhiều cơ sở / chi nhánh** (ví dụ: *Phở Thìn, Katinat, Phúc Long, Pizza 4P's...*):
- Khi một quán đã tồn tại trên Fooday (ở cơ sở 1), nếu người dùng bấm nút **`+`** (Thêm món mới) và dán link Google Maps của một **cơ sở mới chưa từng có trên hệ thống**:
  - Link Maps này có Place ID mới nên bộ lọc chống trùng Place ID không phát hiện.
  - Nếu để tạo mới tự do, hệ thống sẽ sinh ra nhiều quán rời rạc cùng tên, làm phân mảnh dữ liệu, review và phá vỡ cấu trúc chi nhánh (`branches`).
- **Yêu cầu (Đề xuất 1 đã duyệt)**:
  1. Khi dán link Maps hoặc nhập tên quán trong `AddDishModal`, hệ thống tự động nhận diện thương hiệu / chuỗi quán ăn đã có sẵn trong cơ sở dữ liệu (`foods`).
  2. Nếu phát hiện địa chỉ mới thuộc về một quán / chuỗi đã có:
     - Hiển thị ngay **Smart Modal / Dialog gợi ý**: *"Phát hiện quán này thuộc hệ thống [Tên Quán]!"*.
     - Cung cấp các lựa chọn thông minh:
       - **Lựa chọn 1 (Khuyên dùng - Nút chính)**: **"Gộp làm cơ sở mới của quán"**
         - Tự động thêm cơ sở mới (tên cơ sở, địa chỉ, google_map_url, tọa độ) vào mảng `branches` của quán đó trong Supabase.
         - Ghi nhận người dùng hiện tại vào danh sách `contributors` (role: `contributor`).
         - Đóng `AddDishModal`, refresh catalog và tự động mở ngay `DishDetailModal` của quán đó để người dùng thấy ngay chi nhánh mới.
       - **Lựa chọn 2**: **"Tiếp tục thêm món cho cơ sở này"**
         - Tự động điền chuẩn hóa `Tên quán = [Tên Quán]`, lưu cơ sở mới này vào danh sách chi nhánh và cho phép người dùng tiếp tục nhập tên món, ảnh món mới.
       - **Lựa chọn 3**: **"Đây là quán riêng biệt (Tạo mới)"**
         - Đóng modal gợi ý, cho phép người dùng tiếp tục tạo quán độc lập bình thường.

---

## 2. Implementation Summary

### Frontend (`fooday_frontend`)
- **`src/lib/brandMatch.ts`** (new):
  - `normalizeBrandName(raw)`: bóc tách tiền tố cửa hàng (`quán, tiệm, nhà hàng...`), loại bỏ các hậu tố/ghi chú chi nhánh (`- Cơ sở ...`, `(Chi nhánh ...)`, `- Quận ...`), chuẩn hóa bỏ dấu tiếng Việt để so khớp chuỗi thương hiệu.
  - `findBrandMatch(rawName, foods)`: tìm kiếm thương hiệu trong catalog và nhóm toàn bộ các món thuộc cùng thương hiệu.
  - `isBranchAlreadyExists(...)`: đối chiếu link, Place ID và địa chỉ chuẩn hóa để kiểm tra chi nhánh đã tồn tại trong quán hay chưa.
  - `suggestBranchName(...)`: tự động đề xuất tên chi nhánh dựa trên tên Maps hoặc đánh số thứ tự (`Cơ sở N+1`).
- **`src/components/AddDishModal.tsx`**:
  - Tích hợp bước nhận diện thương hiệu `findBrandMatch` sau khi parse link Google Maps thành công.
  - Hiển thị Smart Modal với badge `Gợi ý chuỗi quán`, hiển thị tên cơ sở & địa chỉ mới.
  - Xử lý 3 hành động:
    1. Gộp chi nhánh mới vào quán: cập nhật `branches` cho các món thuộc chuỗi trên Supabase, ghi nhận `contributors`, refresh store và mở ngay `DishDetailModal`.
    2. Tiếp tục thêm món cho cơ sở: tự động chuẩn hóa tên chuỗi quán, lưu cơ sở mới vào danh sách chi nhánh và giữ nguyên form.
    3. Quán riêng biệt: đóng dialog và tiếp tục tạo quán độc lập.
- **`src/components/EditDishModal.tsx`**: Xuất hàm `buildContributors` để tái sử dụng nhất quán giữa các modal.
- **`src/i18n/translations.ts`**: Bổ sung đầy đủ chuỗi bản dịch song ngữ (vi/en) cho `chainDetectedTitle`, `mergeBranchBtn`, `addDishForBranchBtn`, `separateRestaurantBtn`,...

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
