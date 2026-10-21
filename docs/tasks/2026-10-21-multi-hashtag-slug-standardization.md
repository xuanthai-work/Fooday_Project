# Task Archive: Multi-Hashtag System with Lowercase Unaccented Format (#slug)

- **Task File**: `docs/tasks/2026-10-21-multi-hashtag-slug-standardization.md`
- **Completed Date**: 2026-10-21
- **Status**: ✅ QA PASS
- **Session Mode**: fresh

---

## 1. Problem Statement & User Requirements

1. **Support Multiple Hashtags**:
   - Previously, a dish only supported a single tag string.
   - Requirement: Allow assigning multiple hashtags per dish (e.g. `#trending #viewdep #andem`).
2. **Standardization Rule (Viết liền không dấu không viết hoa)**:
   - Must be strictly lowercase: `toLowerCase()`.
   - Strip all Vietnamese diacritics / accents (`đ/Đ` -> `d`, `á/à/ạ` -> `a`, `ê` -> `e`, `ơ` -> `o`, `ư` -> `u`, etc.).
   - Strip whitespace, commas, punctuation: keep only `[a-z0-9_]`.
   - Always prefixed with `#`.
   - Examples: `Trending` -> `#trending`, `View Đẹp` -> `#viewdep`, `Ăn Đêm` -> `#andem`, `Có Điều Hòa` -> `#codieuhoa`.

---

## 2. Implementation Summary

### Shared Hashtag Utilities (`src/lib/hashtags.ts`)
- Defined `TRENDING_HASHTAGS`: `['#trending', '#danghot', '#viewdep', '#andem', '#viahe', '#codieuhoa', '#giahocsinh', '#henho', '#buffet', '#songao']`.
- Implemented `stripVietnameseAccents(str)` with explicit handling for `đ/Đ` and NFD character decomposition.
- Implemented `normalizeSingleHashtag(raw)`: cleans, unaccents, lowercases, and prepends `#`.
- Implemented `parseHashtags(raw)`: parses space/comma-separated tags from Supabase `foods.tag` into a unique array.
- Implemented `serializeHashtags(tags)`: normalizes and joins selected tags into a space-separated string for 100% backward-compatible database storage.

### UI / Modals (`AddDishModal.tsx` & `EditDishModal.tsx`)
- Converted single-tag state into `selectedTags: string[]` + `tagInput: string`.
- Added multi-select toggle for trending presets (tap active chip to remove, tap inactive to add).
- Added multi-tag input with "Thêm" button and keyboard shortcut handling (`Enter`, `,`, `Space`).
- Rendered selected tags as dismissible chips with an `×` remove button.
- Submissions automatically serialize `selectedTags` and any pending `tagInput`.

### Display & Interaction (`DishDetailModal.tsx` & `HomeView.tsx`)
- **`DishDetailModal.tsx`**: Renders all hashtags in `.detail-tags` as a flex-wrap row of `.detail-tag` pills.
- **`HomeView.tsx`**: Renders up to 2 hashtag buttons in `.card-tags-group` on the food card, plus a `+N` badge with tooltip if there are more. Tapping any hashtag filters the home feed by that hashtag.

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

### Code Review Findings:
- Database Compatibility: Space-separated format stores directly into existing `foods.tag` column without requiring DB migration or breaking existing records.
- Accent Normalization: Correctly strips all Vietnamese vowels and consonants (`đ`, `Đ`), guaranteeing uniform `#slug` hashtags across iOS, Android, and Web keyboards.
- Click Isolation: Tag buttons inside cards properly execute `e.stopPropagation()` so tapping tags filters search without inadvertently opening the detail sheet.

---

## 4. Acceptance Criteria Checklist
- [x] Standardize hashtags to lowercase unaccented format (`#slug`).
- [x] Update trending presets to standardized `#slug` format.
- [x] Support multiple hashtags selection & custom tag entry in `AddDishModal` and `EditDishModal`.
- [x] Render selected hashtags as chips with delete buttons.
- [x] Render all hashtags in `DishDetailModal`.
- [x] Render compact multi-tag group with `+N` indicator on food cards in `HomeView`.
- [x] All verification gates pass (lint, tsc, compileall).
