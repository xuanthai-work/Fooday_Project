# Task Archive: Remove Dummy Notification Bell Button from Home Header

- **Task File**: `docs/tasks/2026-10-21-remove-dummy-notification-bell-button.md`
- **Completed Date**: 2026-10-21
- **Status**: ✅ QA PASS
- **Session Mode**: fresh

---

## 1. Problem Statement & User Requirements

- The `Bell` button on the home header was a placeholder (dummy UI) with no `onClick` action and no functional backend.
- It displayed a permanent unread red dot (`.notif-dot`), creating cognitive clutter and leading to dead clicks for users.
- The user chose **Option A** to completely remove this button from the header.

---

## 2. Implementation Summary

### Frontend (`fooday_frontend`)
- **`src/components/HomeView.tsx`**:
  - Removed unused `Bell` import from `lucide-react`.
  - Removed `<button className="icon-button" aria-label={t.home.notifications}>` element from `header-actions`.
  - Cleaned up obsolete CSS rules: `.icon-button` and `.notif-dot`.
  - `header-actions` now cleanly houses only the `ThemeToggle` switch.

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
- [x] Remove dummy notification bell button from `HomeView.tsx`.
- [x] Remove unused `Bell` icon import.
- [x] Remove unused `.icon-button` and `.notif-dot` styled-jsx rules.
- [x] Verify layout of header and `ThemeToggle` remains aligned and functional.
- [x] All verification gates pass (lint, tsc, compileall).
