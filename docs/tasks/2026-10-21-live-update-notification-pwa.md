# Task Archive: Live Update Notification for Fooday PWA

- **Date**: 2026-10-21
- **Status**: ✅ PASS (QA Verified)
- **Executor**: Developer Agent (OpenCode)
- **Reviewer / Technical Auditor**: Gemini

---

## 1. Objective & Overview
Triển khai tính năng **Tự động phát hiện và thông báo phiên bản mới (Live Update Prompt)** cho ứng dụng Fooday:
- Khi có bản build mới được deploy lên Vercel (`VERCEL_GIT_COMMIT_SHA`), client PWA trên điện thoại và máy tính sẽ tự động kiểm tra định kỳ (và khi user quay lại app).
- Nếu phát hiện phiên bản mới hơn phiên bản đang chạy trong bundle, hiển thị banner thông báo nhỏ gọn tinh tế ở cạnh dưới màn hình:
  - Text: *"Đã có bản cập nhật mới của Fooday."*
  - Nút bấm: *"Cập nhật"* (icon Refresh).
  - Khi bấm, gọi `window.location.reload()` để nạp ngay bản cập nhật mới nhất mà không bị kẹt cache.

---

## 2. Target Files & Key Changes
- `fooday_frontend/next.config.ts`: Nhúng biến môi trường `NEXT_PUBLIC_APP_VERSION = process.env.VERCEL_GIT_COMMIT_SHA || "dev"` vào bundle lúc build.
- `fooday_frontend/src/app/api/version/route.ts`: Endpoint GET `/api/version` trả về commit SHA hiện tại trên Vercel với `Cache-Control: no-store, max-age=0`.
- `fooday_frontend/src/components/UpdatePrompt.tsx`: Component kiểm tra phiên bản ngầm mỗi 60s và khi `document.visibilityState === 'visible'`. Hiển thị thanh thông báo nổi kính mờ Warm Culinary Palette khi phát hiện bản mới.
- `fooday_frontend/src/components/AppShell.tsx`: Nhúng `<UpdatePrompt />` vào shell toàn app.
- `fooday_frontend/src/i18n/translations.ts`: Thêm bản dịch song ngữ VI/EN cho thông báo cập nhật.

---

## 3. Verification & QA Audit
- **Frontend Lint**: `npm --prefix fooday_frontend run lint` -> **PASS (0 errors)**
- **Frontend Typecheck**: `tsc --noEmit` -> **PASS (0 errors)**
- **Rule Check**: Không chạy tự động `git push`. Chỉ commit cục bộ để user kiểm soát.

---

## 4. Dev Execution Telemetry
- **Exit Code**: 0 (DONE)
- **Session Mode**: continue
- **Changed Files**:
```text
 M fooday_frontend/next.config.ts
 M fooday_frontend/src/components/AppShell.tsx
 M fooday_frontend/src/i18n/translations.ts
?? fooday_frontend/src/app/api/version/route.ts
?? fooday_frontend/src/components/UpdatePrompt.tsx
```
