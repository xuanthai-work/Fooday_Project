# Task Archive: Fix DishDetailModal Pull-Down & Wheel-Down to Dismiss Across Desktop and Mobile

- **Task File**: `justdoit.md`
- **Completed Date**: 2026-10-21
- **Status**: ✅ QA PASS
- **Session Mode**: fresh

---

## 1. Problem Statement & User Feedback

- User reported: "The modal currently cannot be pulled/dragged down to dismiss at all."
- Root Causes Identified:
  1. **No Wheel Listener for Mouse / Touchpad**: Desktop users naturally scroll up/backwards with mouse wheel or touchpad at the top of the modal, but no `wheel` listener was attached.
  2. **Touch Action Conflict & Inactive Handle**: `.drag-handle` had `pointer-events: none` and was un-grabbable; inside `.hero`, `.carousel-track` claimed horizontal gestures, making vertical pull down `cancelable: false` on mobile browsers.
  3. **Desktop Mouse Drag Blocked by Selection & Image Ghosting**: Dragging the hero area triggered native browser image drag (`<img>`) or text selection instead of the sheet gesture.

---

## 2. Implementation Summary

### `fooday_frontend/src/components/DishDetailModal.tsx`

1. **Wheel / Touchpad Scroll-Down to Dismiss**:
   - Added passive: false `wheel` listener on the sheet.
   - When resting at the top (`scrollTop <= 0`) and scrolling downwards (`deltaY < 0`), it cancels native scroll, paints elastic travel (`translateY(wheelAccum * 0.6)`), and triggers `handleClose()` as soon as `wheelAccum > 75px`.
   - Springs back smoothly if scrolling stops before reaching the threshold.

2. **Dedicated Drag-Zone Hit-Boxes**:
   - Re-engineered `.drag-handle` with a generous 44x5px pill inside a comfortable `padding: 16px 40px` touch/click target with `pointer-events: auto`, `cursor: grab`, and `touch-action: none`.
   - `.hero-top` also acts as a primary drag zone for empty space clicks/touches around the action buttons.
   - Dynamically switches cursor to `grabbing` during active drags.

3. **Disabled Native Image Drag & Text Selection**:
   - Added `-webkit-user-drag: none` on all hero images, `draggable={false}`, and clears text ranges on drag start so mouse dragging on desktop never triggers browser ghosting.
   - Added `overscroll-behavior: none` so mobile browsers do not fight the sheet gesture with rubber-band bounces.

---

## 3. Verification Gates

- **Frontend Lint**: `npm --prefix fooday_frontend run lint` ➜ ✅ PASS (0 errors)
- **TypeScript Typecheck**: `tsc --noEmit` ➜ ✅ PASS (0 errors)
- **Backend Compile**: `python -m compileall -q fooday_backend/app` ➜ ✅ PASS
