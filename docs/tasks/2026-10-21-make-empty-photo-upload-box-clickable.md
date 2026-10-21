# Task Archive: Make Empty Photo Upload Box Clickable in AddDishModal and EditDishModal

- **Date**: 2026-10-21
- **Status**: COMPLETED (QA PASS)
- **Session Mode**: fresh

---

### 1. Goal & Context
In `AddDishModal` and `EditDishModal`, when no photos had been chosen yet (`imageList.length === 0`), the UI displayed a dashed box with the text *"Tải ảnh lên hoặc chỉ cần nhập tên món"*. However, this box was a static non-interactive `<div>` without an `onClick` handler, so users clicking on it could not trigger the file picker.

---

### 2. Implementation Summary
- In `fooday_frontend/src/components/AddDishModal.tsx` & `fooday_frontend/src/components/EditDishModal.tsx`:
  - Replaced the static `div.preview-empty` with an interactive `<button type="button" className="preview-empty" onClick={() => fileRef.current?.click()} disabled={uploading}>`.
  - Added `<Upload size={22} />` and `<Loader2 size={22} className="spin" />` for visual uploading feedback.
  - Added button styles: `cursor: pointer`, hover states with `border-color: var(--primary)` and `background: var(--surface-3)`, and disabled state styling.

---

### 3. Verification & QA Results
- **Frontend Lint**: `npm --prefix fooday_frontend run lint` -> **PASS** (0 errors)
- **Frontend Typecheck**: `tsc --noEmit` -> **PASS** (0 errors)
- **Backend Compile**: `python -m compileall -q fooday_backend/app` -> **PASS** (0 errors)
