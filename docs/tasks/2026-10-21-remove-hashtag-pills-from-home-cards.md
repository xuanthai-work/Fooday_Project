# Task Archive: Remove Hashtag Pills from Home Food Card Media

- **Task File**: `docs/tasks/2026-10-21-remove-hashtag-pills-from-home-cards.md`
- **Completed Date**: 2026-10-21
- **Status**: ✅ QA PASS
- **Session Mode**: fresh

---

## 1. Problem Statement & User Requirements

- On the home feed food cards, the hashtag tag pill was rendered immediately below the dish name tag (`.card-type-tag`) on top of the food photo.
- This created visual clutter, overlapped the food image, and was often redundant when the hashtag and dish name coincided (e.g. `Buffet` and `#buffet`).
- Requirement: Remove the hashtag pill from the food card exterior, and keep the hashtag display exclusively within `DishDetailModal`.

---

## 2. Implementation Summary

### Frontend (`fooday_frontend`)
- **`src/components/HomeView.tsx`**:
  - Removed the hashtag pill button (`.card-tag`) from the `.card-media` container.
  - The card header on top of the image now cleanly contains only the dish name badge (`.card-type-tag`) at top-left and the favorite heart button (`.fav`) at top-right.
  - Cleaned up obsolete CSS selectors (`.card-tags-group`, `.card-tag`, `.card-tag-more`, `.card-type-tag + .card-tag`).
  - Search filtering by hashtag remains fully supported via search bar input.
- **`src/components/DishDetailModal.tsx`**:
  - Retained full multi-hashtag rendering (`.detail-tags`) inside the detail modal.

---

## 3. QA Audit & Verification Gates

### Verification Commands Run:
1. **Frontend Lint**:
   ```powershell
   npm --prefix fooday_frontend run lint
   # Output: Exit Code 0 (clean, no warnings)
   ```
2. **Frontend Typecheck**:
   ```powershell
   .\fooday_frontend\node_modules\.bin\tsc.cmd --project fooday_frontend\tsconfig.json --noEmit
   # Output: Exit Code 0 (0 type errors)
   ```
3. **Backend Syntax Check**:
   ```powershell
   python -m compileall -q fooday_backend/app
   # Output: Exit Code 0 (0 errors)
   ```

---

## 4. Acceptance Criteria Checklist
- [x] Remove hashtag pill from home food card media overlay.
- [x] Remove unused `.card-tag` styles from `HomeView.tsx`.
- [x] Retain hashtag display in `DishDetailModal.tsx`.
- [x] Retain hashtag search support in `HomeView.tsx`.
- [x] All verification gates pass (lint, tsc, compileall).
