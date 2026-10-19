# Task: Full-App Redesign — Warm Culinary Color Palette & Tactile UX/UI Overhaul

## Status: PASS
## Completed Date: 2026-10-19
## Role: Business Analyst (BA) + QA Technical Auditor & Code Reviewer

---

## 1. Objective & Overview
Thay thế toàn bộ hệ màu tím công nghệ (Lavender/Violet `#8E97FD`) của Fooday bằng bảng màu ẩm thực ấm áp, kích thích vị giác (**Warm Culinary Palette**):
- **Primary Brand**: Tangerine / Warm Amber (`#FF6B35` / `#F59E0B`), Terracotta / Coral (`#E0533C`), Golden Saffron (`#FBBF24`).
- **Surfaces & Neutrals**: Nền kem sữa ấm (`#FAF7F2`) ở Light Mode và nền than nâu trầm/espresso (`#12100E` / `#1C1815`) ở Dark Mode.
- **Tactile UX/UI**: Nâng cao độ tương phản, đổ bóng ấm tự nhiên, tỷ lệ thẻ món ăn ngon mắt (edge-to-edge), và đồng bộ trải nghiệm trên toàn bộ các màn hình chính.

---

## 2. Changed Files & Scope
- `fooday_frontend/src/app/globals.css`: Cập nhật toàn bộ Design Tokens (:root Light & Dark mode, shadow, ring, borders, surfaces).
- `fooday_frontend/src/app/layout.tsx`: Cập nhật themeColor meta sang `#FF6B35`.
- `fooday_frontend/src/components/AppShell.tsx`: Brand text gradient, active nav indicator warm glow.
- `fooday_frontend/src/components/HomeView.tsx`: Glass tag backdrop, search focus, category chips.
- `fooday_frontend/src/components/RandomView.tsx`: Roulette turntable warm gradient, center ticker golden needle, winner spotlight.
- `fooday_frontend/src/components/DishDetailModal.tsx`: Warm backdrop, AI pill button warm glow & hover shadow.
- `fooday_frontend/src/components/AddDishModal.tsx`: Warm backdrop blur.
- `fooday_frontend/src/components/AuthScreen.tsx`: Submit button warm shadow.

---

## 3. QA Audit & Verification Results
- **Acceptance Criteria**:
  - [x] Bảng màu toàn bộ ứng dụng chuyển hoàn toàn sang Warm Culinary Palette, 0 mã màu tím cũ sót lại.
  - [x] Cả Light Mode và Dark Mode đạt tương phản WCAG AA, không bị chìm nền.
  - [x] Thẻ món ăn, CS:GO Roulette, Modals, Chat, Profile đồng bộ 100%.
  - [x] Impeccable Design Detector: 0 violations.
- **Verification Gates**:
  - `npm --prefix fooday_frontend run lint`: PASS (0 errors, 0 warnings).
  - `tsc --project fooday_frontend/tsconfig.json --noEmit`: PASS (0 type errors).
  - `python -m compileall -q fooday_backend/app`: PASS.
