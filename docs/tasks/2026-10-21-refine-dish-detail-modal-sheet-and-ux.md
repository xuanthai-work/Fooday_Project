# Task Archive: Refine DishDetailModal Sheet UX, Smooth Scrolling, and De-duplicate Content

- **Task File**: `justdoit.md`
- **Completed Date**: 2026-10-21
- **Status**: ✅ QA PASS
- **Session Mode**: fresh

---

## 1. Problem Statement & User Feedback

1. **Gap / White artifact at the top of the hero image**:
   - The `.drag-handle` was rendered as a block element *above* the `.hero`, taking up ~20px of modal surface background and pushing the hero image down.
2. **Oversensitive scroll expanding & losing buttons**:
   - `scrollTop > 24` violently jumped `.detail-sheet` from `85dvh` to `100dvh` mid-swipe, breaking momentum scrolling and sending the user flying past the content.
   - The hero action buttons were scrolled away, and no persistent Close button was reachable.
3. **Duplicate restaurant name**:
   - Restaurant name was repeated 3 times in a row (sticky bar, h2 title, address direction text). The actual dish name was relegated to a tiny subtitle.
4. **Duplicate "Ask AI" button**:
   - Two "Ask AI" buttons appeared simultaneously: a sticky magic-star button in the header and a big pill button next to the rating.

---

## 2. Implementation Summary

### `fooday_frontend/src/components/DishDetailModal.tsx`

1. **Seamless Hero & Floating Grab Handle**:
   - Transformed `.drag-handle` into an absolute floating overlay (`top: 8px; left: 50%; transform: translateX(-50%); z-index: 6;`) styled with `rgba(255, 255, 255, 0.8)` and `backdrop-filter: blur(4px)`.
   - Hero photo now bleeds directly to the rounded top edges of the sheet (`24px 24px 0 0`) with zero white gap.

2. **Fixed Height & Butter-Smooth Scrolling**:
   - Replaced layout-jumping `expanded` state with a fixed mobile sheet height of `90dvh` (`max-height: 90dvh; overscroll-behavior: contain;`).
   - Sticky header bar (`.sheet-sticky-bar`) slides down smoothly only when the hero image scrolls past (`scrollTop > heroHeight`), without altering sheet height.
   - Added an explicit Close (X) button on `hero-top-left` alongside the Heart button, and a persistent Close (X) button on the sticky header bar.

3. **Clear Information Hierarchy (De-duplicate)**:
   - `h2.detail-title`: Prominently displays the dish name (`currentDish.name`).
   - `p.detail-sub`: Shows the restaurant name (`currentDish.restaurant`) preceded by an inline `<Store size={14} />` icon.
   - Sticky header displays `currentDish.name`.

4. **Single Unified "Ask AI" Entry Point**:
   - Removed the duplicate `sticky-ask-btn` from the sticky header.
   - Kept the refined, tactile `ask-ai-pill` in `detail-head-actions`.

---

## 3. Verification Gates

- **Frontend Lint**: `npm --prefix fooday_frontend run lint` ➜ ✅ PASS (0 errors)
- **TypeScript Typecheck**: `tsc --noEmit` ➜ ✅ PASS (0 errors)
- **Backend Compile**: `python -m compileall -q fooday_backend/app` ➜ ✅ PASS
