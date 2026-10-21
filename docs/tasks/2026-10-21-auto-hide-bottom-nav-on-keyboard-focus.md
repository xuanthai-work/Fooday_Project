# Task Archive: Auto-Hide Bottom Navigation Bar on Mobile Keyboard Focus (ChatView)

- **Date**: 2026-10-21
- **Status**: COMPLETED (QA PASS)
- **Session Mode**: fresh

---

### 1. Goal & Context
On mobile devices (specifically iOS Safari and PWA), when the virtual keyboard pops up in ChatView, the keyboard pushed up the Bottom Navigation Bar, which in turn pushed up the Chat Composer input, sandwiching the navigation bar between the keyboard and the input field and taking up half the screen.

The solution (Option B) automatically hides the Bottom Navigation Bar whenever the virtual keyboard opens or the chat input is focused, allowing the Chat Composer to sit directly on top of the keyboard. When the keyboard is dismissed, the navigation bar smoothly reappears.

---

### 2. Implementation Summary

#### Frontend (`fooday_frontend`)
- In `fooday_frontend/src/app/globals.css`:
  - Added responsive CSS rule under `@media (max-width: 1023px)`:
    Hides `nav.bottom-nav` when `body.keyboard-open`, `.app-shell:has(.chat-composer-focused)`, or `.app-shell:has(.chat .input:focus)`.
- In `fooday_frontend/src/components/ChatView.tsx`:
  - Added `onFocus` and `onBlur` listeners to the chat input to toggle `body.keyboard-open` and component focus state.
  - Added `window.visualViewport` resize listener to reliably catch keyboard dismissals without blur events on iOS Safari / PWA.
  - Added `onMouseDown={(e) => e.preventDefault()}` on the Send and Attach buttons to prevent input from prematurely blurring on button clicks, eliminating layout bounce.
  - Automatically scrolls the messages column to the bottom 150ms after input focus, ensuring latest messages stay visible above the keyboard.

---

### 3. Verification & QA Results
- **Frontend Lint**: `npm --prefix fooday_frontend run lint` -> **PASS** (0 errors)
- **Frontend Typecheck**: `tsc --noEmit` -> **PASS** (0 errors)
- **Backend Compile**: `python -m compileall -q fooday_backend/app` -> **PASS** (0 errors)
