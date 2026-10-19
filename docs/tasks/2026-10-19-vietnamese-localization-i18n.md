# Implementation Task: Full Vietnamese Localization & i18n System with Language Settings

- **Date Completed**: 2026-10-19
- **Status**: QA PASS
- **Reviewer**: Gemini (BA + QA Technical Auditor)
- **Developer Agent**: OpenCode

---

### 1. Objective
- Chuyển đổi toàn bộ ngôn ngữ giao diện của Fooday sang **Tiếng Việt** làm mặc định.
- Xây dựng hệ thống quốc tế hóa (i18n) nhẹ, độc lập (Zero-dependency), type-safe với React Context (`LanguageProvider`, `useTranslation`).
- Giữ lại bản dịch **Tiếng Anh (English)** song song và tích hợp bộ chuyển đổi ngôn ngữ (Language Switcher) trực quan trong phần Cài đặt / Profile (`ProfileView`).
- Lưu trạng thái ngôn ngữ đã chọn vào `localStorage` (`fooday-lang`) để giữ nguyên lựa chọn sau khi tải lại trang.

---

### 2. Changes Delivered
1. **i18n Core Module**:
   - `src/i18n/translations.ts`: Bộ từ điển song ngữ hoàn chỉnh cho `vi` (Tiếng Việt) và `en` (English), bao phủ toàn bộ các màn hình (nav, home, chat, random, profile, addDish, auth).
   - `src/i18n/LanguageContext.tsx`: Cung cấp `LanguageProvider` sử dụng `useSyncExternalStore` chống lỗi hydration mismatch giữa client và server, lưu trạng thái vào `localStorage` (`fooday-lang`), phát sự kiện `fooday-lang-change` để đồng bộ tức thì.
2. **Vietnamese Default Across All Views**:
   - `AppShell.tsx`: Navigation bar hiển thị tiếng Việt (*Trang chủ*, *AI Chat*, *Ngẫu nhiên*, *Cá nhân*, *Thêm món*).
   - `HomeView.tsx`: Tiêu đề, ô tìm kiếm, danh mục món ăn (*Tất cả*, *Món ăn*, *Đồ uống*, *Ăn vặt*).
   - `ChatView.tsx`: Lời chào tiếng Việt của Foodie AI, các nút gợi ý nhanh (*Món gì cay cay 🌶️*, *Thanh đạm nhé*, *Gợi ý bất ngờ đi!*).
   - `RandomView.tsx`: Giao diện chọn món ngẫu nhiên tiếng Việt.
   - `AddDishModal.tsx`: Form thêm món tiếng Việt.
   - `AuthScreen.tsx`: Màn hình xác thực tài khoản tiếng Việt.
3. **Language Switcher in Settings (ProfileView)**:
   - Thêm Card "Cài đặt & Tùy chọn" trong `ProfileView.tsx` với bộ chọn ngôn ngữ giữa `🇻🇳 Tiếng Việt` và `🇬🇧 English`.
   - Chuyển đổi ngôn ngữ tức thì, không giật lag, không cần reload trang.

---

### 3. QA Verification Results
- `npm --prefix fooday_frontend run lint`: PASS (Exit 0)
- `tsc --project fooday_frontend/tsconfig.json --noEmit`: PASS (Exit 0)
- `npm --prefix fooday_frontend run build`: PASS (Exit 0, 7 static pages compiled in 1.6s)
- `python -m compileall -q fooday_backend/app`: PASS (Exit 0)
