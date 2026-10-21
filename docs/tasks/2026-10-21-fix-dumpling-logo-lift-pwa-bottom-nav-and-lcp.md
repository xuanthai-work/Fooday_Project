# Task Archive: Fix Dumpling Logo Cropping, Lift iOS PWA Bottom Nav & Fix LCP Warning

- **Date**: 2026-10-21
- **Status**: ✅ PASS (QA Verified)
- **Executor**: Developer Agent (OpenCode) + Gemini QA
- **Reviewer / Technical Auditor**: Gemini

---

## 1. Objective & Overview
Giải quyết đồng bộ 3 vấn đề:
1. **Căn chỉnh lại Logo Bánh bao (`icon.png`, `fooday-mark.png`, `apple-icon.png`)**:
   - Khắc phục tình trạng logo bị crop quá sát làm mất chỏm đầu và khăn bandana.
   - Resize toàn bộ từ file gốc `assets/logo_fooday.png` (1024x1024), giữ trọn vẹn toàn bộ nhân vật bánh bao (đỉnh đầu, khăn bandana, đôi đũa, làn khói và chút viền nền nhẹ) để khi hiển thị tròn, vuông hay squircle đều thấy trọn vẹn toàn bộ khuôn mặt dễ thương.
2. **Nâng Navigation Bottom Bar lên cao hơn cho iPhone (iOS PWA)**:
   - Thêm `viewportFit: "cover"` vào `viewport` trong `fooday_frontend/src/app/layout.tsx` để iOS kích hoạt `env(safe-area-inset-bottom)`.
   - Trong `fooday_frontend/src/components/AppShell.tsx`:
     - Tăng padding đáy và chiều cao thanh `.bottom-nav`:
       `padding: 10px 12px calc(18px + env(safe-area-inset-bottom, 16px));`
     - Nâng các icon và nút FAB dấu `+` lên cao hơn để không bị thanh gạt (Home Indicator) của iPhone che khuất hay bị cấn ở 2 góc bo tròn của màn hình điện thoại.
3. **Sửa cảnh báo Next.js LCP Warning**:
   - Trong `fooday_frontend/src/components/HomeView.tsx`, thêm `priority={index < 4}` vào thẻ `<Image>` của các card món ăn ở đầu danh sách để Next.js ưu tiên tải trước ảnh above-the-fold, loại bỏ cảnh báo `Largest Contentful Paint`.

---

## 2. Target Files & Key Changes
- `fooday_frontend/src/app/icon.png`, `apple-icon.png`, `favicon.ico`, `fooday-mark.png`: Tái tạo lại chuẩn tỷ lệ, căn giữa hoàn hảo.
- `fooday_frontend/src/app/layout.tsx`: Thêm `viewportFit: "cover"` và cấu hình icons.
- `fooday_frontend/src/components/AppShell.tsx`: Nâng cao thanh bottom navigation bar, tăng khoảng cách an toàn với thanh gạt iPhone.
- `fooday_frontend/src/components/HomeView.tsx`: Thêm `priority={index < 4}` vào thẻ Image các card hàng đầu.

---

## 3. Verification & QA Audit
- **Frontend Lint**: `npm --prefix fooday_frontend run lint` -> **PASS (0 errors)**
- **Frontend Typecheck**: `tsc --noEmit` -> **PASS (0 errors)**
- **Rule Check**: Tuyệt đối KHÔNG tự động `git push`. Chỉ commit cục bộ.

---

## 4. Dev Execution Telemetry
- **Exit Code**: 0 (DONE)
- **Session Mode**: fresh
- **Changed Files**:
```text
 M fooday_frontend/public/fooday-mark.png
 M fooday_frontend/src/app/favicon.ico
 M fooday_frontend/src/app/icon.png
 M fooday_frontend/src/app/layout.tsx
 M fooday_frontend/src/components/AppShell.tsx
 M fooday_frontend/src/components/HomeView.tsx
?? fooday_frontend/src/app/apple-icon.png
```
