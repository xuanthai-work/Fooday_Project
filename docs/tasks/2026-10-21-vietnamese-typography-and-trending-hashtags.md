# Task Archive: Upgrade Vietnamese Typography (Plus Jakarta Sans) & Social-Style Hashtag System

- **Task File**: `docs/tasks/2026-10-21-vietnamese-typography-and-trending-hashtags.md`
- **Completed Date**: 2026-10-21
- **Status**: ✅ QA PASS
- **Session Mode**: fresh

---

## 1. Problem Statement & User Requirements

1. **Vietnamese Typography ("Nhảy Font")**:
   - The app's display font (`Outfit` from Google Fonts) only contained `subsets: ["latin"]` and lacked Vietnamese glyph coverage.
   - Any Vietnamese characters with diacritics (dấu huyền, sắc, hỏi, ngã, nặng, ư, ơ, đ) were failing to render in `Outfit` and falling back to system generic fonts (Arial/Segoe UI/Times), causing a glaring visual inconsistency where letters in the same word had different weights, x-heights, and kerning.
2. **Tag Field Redesign (Hashtag Direction A)**:
   - The previous `tag` field in `AddDishModal` and `EditDishModal` was an unguided free-text input with ambiguous utility.
   - The user approved **Direction A**: Transform this field into a social-media / TikTok style `#hashtag` feature:
     - Provide quick one-tap trending hashtag pills (`#Trending`, `#ĐangHot`, `#ViewĐẹp`, `#ĂnĐêm`, `#VỉaHè`, `#CóĐiềuHòa`, `#GiáHọcSinh`, `#HẹnHò`, `#Buffet`, `#SốngẢo`).
     - Auto-normalize custom tags to always start with `#`.
     - Make hashtag tags on food cards clickable to filter dishes by that tag instantly.

---

## 2. Implementation Summary

### Frontend (`fooday_frontend`)
- **`src/app/layout.tsx`**:
  - Replaced `Outfit` with `Plus_Jakarta_Sans` configured with `subsets: ["latin", "vietnamese"]` and `variable: "--font-display"`.
  - Added `vietnamese` subset to `Inter` (`--font-sans`).
- **`src/lib/hashtags.ts`**:
  - Created shared module exporting `TRENDING_HASHTAGS` (10 presets) and `normalizeHashtag(raw: string): string` to clean and prepend `#`.
- **`src/i18n/translations.ts`**:
  - Added i18n keys for `trendingHashtagsLabel`, `filterByTag`, `suggestionsTitle`, and updated `tagLabel` and `tagPlaceholder`.
- **`src/components/AddDishModal.tsx` & `src/components/EditDishModal.tsx`**:
  - Added trending hashtag preset buttons below the tag input. Tapping a preset selects or toggles it off.
  - Form submission applies `normalizeHashtag()` before saving to Supabase.
- **`src/components/HomeView.tsx`**:
  - Converted `.card-tag` into an interactive `<button>` with accessible labels and hover/active transitions.
  - Clicking a tag calls `e.stopPropagation()` and populates `searchQuery` with the clean tag name to trigger the instant multi-field search engine.

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
- Accessibility: Tags on cards include `title` and `aria-label` localized via `t.home.filterByTag`.
- Event Bubbling: Clicking `#hashtag` stops event propagation to prevent triggering card click or opening detail modal.
- Font Loading: `Plus_Jakarta_Sans` uses `display: 'swap'` and `--font-display` CSS variable for optimal Web Vitals (LCP/CLS).

---

## 4. Acceptance Criteria Checklist
- [x] Replace `Outfit` with `Plus_Jakarta_Sans` supporting `vietnamese` subset.
- [x] Update `Inter` with `vietnamese` subset.
- [x] Create hashtag utility `src/lib/hashtags.ts` with presets and normalizer.
- [x] Add trending hashtag chips to `AddDishModal` and `EditDishModal`.
- [x] Ensure custom tags are normalized with `#` prefix upon saving.
- [x] Make tags on dish cards clickable to filter items by hashtag without opening dish detail.
- [x] All verification gates pass (lint, tsc, compileall).
