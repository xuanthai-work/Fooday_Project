# Task: Redesign Food Card Type Tag to Match AI Pill Styling

## Status: PASS
## Completed Date: 2026-10-19
## Role: Business Analyst (BA) + QA Technical Auditor & Code Reviewer

---

## 1. Objective & Overview
Nâng cấp thẻ loại món ăn (Food Type Tag - `.card-type-tag`) ở góc trên thẻ món ăn (`HomeView.tsx`) từ nền nâu tối cũ sang giao diện dạng Warm Frosted Pill tương tự nút "Hỏi AI" (`.ask-ai`), giải quyết vấn đề chữ bị chìm, tăng tính thẩm mỹ và độ dễ đọc.

---

## 2. Changed Files & Scope
- `fooday_frontend/src/components/HomeView.tsx`:
  - Cập nhật `.card-type-tag`:
    - Chữ: `var(--primary-strong)` (Light) & `var(--primary)` (Dark).
    - Nền: `color-mix(in srgb, var(--surface) 88%, var(--primary) 12%)` kết hợp `backdrop-filter: blur(8px)`.
    - Viền: `1px solid var(--primary-soft-2)`.
    - Bóng đổ: `box-shadow: 0 2px 8px rgba(0, 0, 0, 0.10), 0 0 12px var(--primary-soft)`.
    - Hỗ trợ đầy đủ Dark Theme và prefers-color-scheme.

---

## 3. QA Audit & Verification Results
- **Acceptance Criteria**:
  - [x] Tag loại món hiển thị phong cách pill ấm áp đồng bộ với nút "Hỏi AI".
  - [x] Chữ tương phản cao, nổi bật và dễ đọc trên mọi nền ảnh món ăn.
  - [x] Không làm vỡ layout các tag khác và nút favorite.
- **Verification Gates**:
  - `npm --prefix fooday_frontend run lint`: PASS (0 errors, 0 warnings).
  - `tsc --project fooday_frontend/tsconfig.json --noEmit`: PASS (0 type errors).
  - `impeccable detect --json`: PASS (0 violations).
