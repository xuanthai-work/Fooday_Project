# Task Archive: Remove [X] Buttons & Add Pull-Down to Dismiss Gesture in DishDetailModal

- **Task File**: `justdoit.md`
- **Completed Date**: 2026-10-21
- **Status**: ✅ QA PASS
- **Session Mode**: fresh

---

## 1. Problem Statement & User Request

- Since the modal can already be dismissed by tapping the overlay backdrop or pressing `Escape`, having explicit [X] close buttons cluttered the UI.
- The user requested:
  1. Remove all explicit [X] close buttons from the hero header and the sticky bar.
  2. Implement an intuitive mobile **pull-down / drag-down to dismiss gesture**: dragging the sheet downwards past a reasonable threshold (~80px) or flicking it downwards closes the modal, with natural elastic spring physics when released early.

---

## 2. Implementation Summary

### `fooday_frontend/src/components/DishDetailModal.tsx`

1. **Removed all [X] Close Buttons**:
   - Removed `<X />` button from `hero-top-left` (only favorite `<Heart />` is kept, clean and spacious).
   - Removed `<X />` button from `sheet-sticky-bar` (balanced with a matching spacer, title in the center, and share button on the right).

2. **Native Touch & Pointer Pull-Down to Dismiss**:
   - Embedded gesture listeners on the modal sheet element:
     - Damped resistance (`RESISTANCE = 0.85`) for tactile elasticity.
     - Velocity fling detection (`FLING_SPEED = 0.45 px/ms`, `FLING_MIN = 24px`) so a fast downward flick closes immediately.
     - Threshold distance (`THRESHOLD = 80px`) triggers `closeRef.current()`.
     - Releases below threshold smoothly spring back via `cubic-bezier(0.22, 1, 0.36, 1)`.
   - Content scroll guard: When `scrollTop > 0`, touch inputs scroll the content normally without triggering the dismiss gesture.

3. **Grab Handle Affordance**:
   - The floating grab handle (`.drag-handle`) features a subtle breathing pulse animation (`handleBreathe`) to subtly hint that the sheet can be pulled down.

---

## 3. Verification Gates

- **Frontend Lint**: `npm --prefix fooday_frontend run lint` ➜ ✅ PASS (0 errors)
- **TypeScript Typecheck**: `tsc --noEmit` ➜ ✅ PASS (0 errors)
- **Backend Compile**: `python -m compileall -q fooday_backend/app` ➜ ✅ PASS
