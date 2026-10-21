# Task Archive: Update Review Cooldown to 45 Days

- **Date**: 2026-10-21
- **Status**: COMPLETED (QA PASS)
- **Session Mode**: fresh

---

### 1. Goal & Context
Adjust the review cooldown period per user and per restaurant/dish from 3 months (90 days) down to 45 days. This allows users to re-evaluate dishes sooner while maintaining abuse and rating-manipulation prevention.

---

### 2. Implementation Summary
- In `fooday_frontend/src/hooks/useReviews.ts`:
  - Added `REVIEW_COOLDOWN_DAYS = 45`.
  - Added helper function `addDays(date, days)` and updated `cooldownUntil` to use `addDays(new Date(latest), REVIEW_COOLDOWN_DAYS)`.
- In `fooday_frontend/supabase/0007_review_average_photos_cooldown.sql`:
  - Updated cooldown trigger `enforce_review_cooldown()` checks from `interval '3 months'` to `interval '45 days'`.
- In `fooday_frontend/supabase/init_all.sql`:
  - Updated section 7 triggers to use `interval '45 days'`.

---

### 3. Verification & QA Results
- **Frontend Lint**: `npm --prefix fooday_frontend run lint` -> **PASS**
- **Frontend Typecheck**: `tsc --noEmit` -> **PASS**
- **Backend Compile**: `python -m compileall -q fooday_backend/app` -> **PASS**
