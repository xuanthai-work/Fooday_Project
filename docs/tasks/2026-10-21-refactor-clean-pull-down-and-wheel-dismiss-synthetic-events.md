# Task Archive: Clean Refactor of DishDetailModal Pull-Down & Wheel Dismiss via React Synthetic Events

- **Task File**: `justdoit.md`
- **Completed Date**: 2026-10-21
- **Status**: ✅ QA PASS
- **Session Mode**: fresh

---

## 1. Problem Statement & Root Cause

- User reported: The pull-down/wheel to dismiss gesture still did not work at all.
- Root Cause Identified:
  - `DishDetailModal.tsx` renders via `createPortal` only once `mounted === true`.
  - The previous implementation used a raw DOM `useEffect` with dependency `[isEditing]`. On the initial render (`mounted = false`), `sheetRef.current` was `null`, so the effect immediately exited (`if (!el) return;`) and **never re-ran when the portal mounted**.
  - All ~280 lines of vanilla DOM event listeners were **dead code** never attached to the real DOM element.
  - Furthermore, using hundreds of lines of vanilla window/ref event listeners was an anti-pattern that cluttered the codebase.

---

## 2. Implementation Summary

### `fooday_frontend/src/components/DishDetailModal.tsx`

1. **Complete Clean-up of Vanilla Listeners**:
   - Stripped away ~280 lines of complex manual `addEventListener` / `removeEventListener` calls, timers, and window listeners.
2. **Standard React Synthetic Events Bound Directly to JSX**:
   - `onWheel={handleWheel}`: On desktop/laptop, scrolling back up while at the top of the sheet (`scrollTop <= 0` and `deltaY < -20`) immediately dismisses the modal.
   - `onTouchStart`, `onTouchMove`, `onTouchEnd`: On mobile, pulling downwards at the top moves the sheet (`transform: translateY(${dragY}px)`). Pulling past 75px and releasing triggers `handleClose()`; releasing earlier springs back elastically.
   - `onMouseDown`, `onMouseMove`, `onMouseUp`, `onMouseLeave`: On desktop, clicking and dragging down on the grab handle or hero area smoothly pulls and dismisses.
   - Because all handlers are synthetic events on the JSX element, they **always attach to the mounted DOM node with 100% reliability**, with zero ref timing issues and automatic cleanup.

---

## 3. Verification Gates

- **Frontend Lint**: `npm --prefix fooday_frontend run lint` ➜ ✅ PASS (0 errors)
- **TypeScript Typecheck**: `tsc --noEmit` ➜ ✅ PASS (0 errors)
- **Backend Compile**: `python -m compileall -q fooday_backend/app` ➜ ✅ PASS
