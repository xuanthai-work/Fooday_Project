# Task Archive: Integrate Fooday Brand Logo and Foodie AI Mascot Avatar

- **Date**: 2026-10-21
- **Status**: ✅ PASS (QA Verified)
- **Executor**: Developer Agent (OpenCode)
- **Reviewer / Technical Auditor**: Gemini

---

## 1. Objective & Overview
Tích hợp bộ nhận diện hình ảnh chính thức vào giao diện ứng dụng Fooday:
1. **Logo Web Fooday** (`/fooday-mark.png` / `/logo_fooday.png` - bé bánh bao dumpling mascot):
   - Cài đặt làm Favicon / App Icon trong `fooday_frontend/src/app/layout.tsx` và `favicon.ico`.
   - Hiển thị trên thanh thương hiệu (Brand Header / Sidebar) trong `fooday_frontend/src/components/AppShell.tsx`.
   - Hiển thị trên màn hình đăng nhập/đăng ký `fooday_frontend/src/components/AuthScreen.tsx` và màn hình Splash screen.
2. **Avatar Trợ lý ảo Foodie AI** (`/foodie-avatar.png` / `/avt_fooday.png` - chú robot đầu bếp đeo tạp dề cute):
   - Hiển thị làm avatar chính thức trên Header của màn hình Chat `fooday_frontend/src/components/ChatView.tsx`.
   - Hiển thị avatar mini bên cạnh mỗi bong bóng tin nhắn trả lời và hiệu ứng typing của Foodie AI trong `ChatView.tsx`.

---

## 2. Target Files & Key Changes
- `fooday_frontend/public/fooday-mark.png` & `foodie-avatar.png`: Asset hình ảnh chính thức.
- `fooday_frontend/src/app/layout.tsx`: Cấu hình favicon và shortcut icons.
- `fooday_frontend/src/components/AppShell.tsx`: Logo thương hiệu trên sidebar và splash loader.
- `fooday_frontend/src/components/AuthScreen.tsx`: Logo sắc nét trên card đăng nhập.
- `fooday_frontend/src/components/ChatView.tsx`: Avatar tròn trên header và avatar mini bên cạnh tin nhắn AI.

---

## 3. Verification & QA Audit
- **Frontend Lint**: `npm --prefix fooday_frontend run lint` -> **PASS (0 errors)**
- **Frontend Typecheck**: `tsc --noEmit` -> **PASS (0 errors)**
- **UI/UX Testing**:
  - Logo và avatar hiển thị sắc nét, chuẩn tỷ lệ và bo góc mềm mại.
  - Căn lề tin nhắn bot và avatar mini thẳng hàng với bong bóng chat.

---

## 4. Dev Execution Telemetry
- **Exit Code**: 0 (DONE)
- **Session Mode**: fresh
- **Changed Files**:
```text
 M fooday_frontend/src/app/favicon.ico
 M fooday_frontend/src/app/layout.tsx
 M fooday_frontend/src/components/AppShell.tsx
 M fooday_frontend/src/components/AuthScreen.tsx
 M fooday_frontend/src/components/ChatView.tsx
?? fooday_frontend/public/fooday-mark.png
?? fooday_frontend/public/foodie-avatar.png
```
