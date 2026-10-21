# Task Archive: Prioritize Restaurant Name as Primary Heading in DishDetailModal

- **Task File**: `justdoit.md`
- **Completed Date**: 2026-10-21
- **Status**: ✅ QA PASS
- **Session Mode**: fresh

---

## 1. Problem Statement & User Feedback

- User feedback (Screenshot 2026-10-21 172214.png):
  - "The wrong text was highlighted. Since the app is built around discovering food places (restaurants), the Restaurant Name must be at the top as the primary heading, and the Dish/Food type name should be underneath."
- Previously:
  - `h2.detail-title` rendered the dish name (e.g. "Bánh mì") as the giant heading.
  - Subtitle rendered the restaurant name (e.g. "Bánh mì Long Khánh") in small muted text.

---

## 2. Implementation Summary

### `fooday_frontend/src/components/DishDetailModal.tsx`

1. **Heading Hierarchy Aligned with Core Product Value**:
   - `h2.detail-title`: Prominently renders **Restaurant Name** (`currentDish.restaurant`) as the bold main title.
   - `p.detail-sub`: Renders **Dish / Food Name** (`currentDish.name`) with an inline culinary icon (`<UtensilsCrossed size={14} />`).
2. **Sticky Bar & Accessibility**:
   - Sticky header title formatted as `${currentDish.restaurant} · ${currentDish.name}`.
   - Modal `aria-label` updated to `currentDish.restaurant`.

---

## 3. Verification Gates

- **Frontend Lint**: `npm --prefix fooday_frontend run lint` ➜ ✅ PASS (0 errors)
- **TypeScript Typecheck**: `tsc --noEmit` ➜ ✅ PASS (0 errors)
- **Backend Compile**: `python -m compileall -q fooday_backend/app` ➜ ✅ PASS
