# Task Archive: Mandatory Google Maps Link & Auto Address Parsing in Dish Modals

- **Task File**: `justdoit.md`
- **Completed Date**: 2026-10-21
- **Status**: ✅ QA PASS
- **Session Mode**: fresh

---

## 1. Problem Statement & User Requirements

- `AddDishModal` only had a "Restaurant" field — there was no Google Maps link input and no concrete `address` field.
- Required behaviour:
  1. The **Google Maps link is mandatory** when adding a new dish.
  2. The **address is optional** (auto-filled, but editable by hand).
  3. **Fully automated**: pasting a Google Maps link must trigger the backend
     resolution automatically — no extra button.
     - While the backend works, the Address (and Restaurant) inputs are
       **dimmed/disabled with a loading indicator**.
     - When the backend answers, the address is filled automatically, the
       restaurant name is suggested when that field is still empty, and
       everything is unlocked again for manual editing.
  4. The link must be persisted (`google_map_url`) so the "Get directions"
     button in `DishDetailModal` opens the exact place.

---

## 2. Implementation Summary

### Database (Supabase)
- **`fooday_frontend/supabase/0009_add_google_map_url.sql`** (new): idempotent
  `alter table public.foods add column if not exists google_map_url text;`

### Backend (`fooday_backend`)
- **`app/models.py`**: added `ParseMapResponse` (`restaurant_name`, `address`,
  `resolved_url` — every field optional).
- **`app/api.py`**: added `GET /api/v1/parse-map-link?url=<encoded>`:
  1. Validates the link (`google.com/maps`, `maps.google.com`, `maps.app.goo.gl`,
     `goo.gl/maps`).
  2. `httpx.Client(follow_redirects=True, headers={"User-Agent": ...})` follows
     the redirect chain of short links to get the final URL.
  3. Restaurant name from the `/maps/place/<name>/` path (`unquote_plus`), with
     the `APP_INITIALIZATION_STATE` HTML payload and the `q=`/`query=` param as
     fallbacks.
  4. Coordinates from `@lat,lng`, `!3d…!4d…` or `ll=lat,lng`.
  5. Reverse geocoding through OpenStreetMap Nominatim
     (`User-Agent: FoodayApp/1.0`, 1 retry) composed into a friendly Vietnamese
     address, e.g. `19A Đường Ngô Văn Năm, Phường Sài Gòn, Khu phố 4, Thành phố Hồ Chí Minh`.
  6. Never raises: unparsable links return HTTP 200 with all-null fields.

### Frontend (`fooday_frontend`)
- **`src/app/api/parse-map-link/route.ts`** (new): BFF proxy to the FastAPI
  backend, forwards the `x-internal-secret` header (same pattern as
  `/api/dish-image`).
- **`src/services/api.ts`**: added `ParsedMapInfo` + `mapService.parseMapLink(url)`.
- **`src/lib/maps.ts`** (new): `isGoogleMapsUrl()` shared link validator.
- **`src/hooks/useFoods.ts`**: `Food.google_map_url` + added to the `COLUMNS` select.
- **`src/components/AddDishModal.tsx`**:
  - New required "Link Google Maps *" input and an optional "Địa chỉ" input.
  - Debounced (500 ms) auto-resolution started directly from the input handler
    (no extra button), with a request-sequence guard against stale responses.
  - While resolving: Restaurant + Address inputs are dimmed
    (`opacity: .5`, `pointer-events: none`) and the address shows a spinner and
    the "Đang lấy địa chỉ từ Google Maps..." hint.
  - `canSubmit` now requires a valid Google Maps link; the row is persisted with
    `address` and `google_map_url`.
- **`src/components/EditDishModal.tsx`**: same fields/auto-parse, prefilled from
  `dish.google_map_url`, persisted on update. The link stays optional here so
  dishes created before the migration can still be edited.
- **`src/components/DishDetailModal.tsx`**: the "Get directions" row opens
  `google_map_url` when present, otherwise falls back to the previous
  `maps/search/?api=1&query=...` lookup.
- **`src/i18n/translations.ts`**: new shared `map` section (vi + en) with
  `googleMapLabel`, `googleMapPlaceholder`, `googleMapRequired`,
  `addressLabel`, `addressPlaceholder`, `resolvingAddress`.

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
   npx tsc --project fooday_frontend/tsconfig.json --noEmit
   # Output: Exit Code 0 (0 type errors)
   ```
3. **Backend Syntax Check**:
   ```powershell
   python -m compileall -q fooday_backend/app
   # Output: Exit Code 0 (0 errors)
   ```
4. **Backend Endpoint (live)**:
   ```powershell
   GET /api/v1/parse-map-link?url=https://maps.app.goo.gl/kHiqDsSohbg3R3kJ8
   # 200 {"restaurant_name":"Quán Bụi Original",
   #      "address":"19A Đường Ngô Văn Năm, Phường Sài Gòn, Khu phố 4, Thành phố Hồ Chí Minh",
   #      "resolved_url":"https://www.google.com/maps/place/Quán Bụi Original/@10.78..."}
   GET /api/v1/parse-map-link?url=https://example.com/nope
   # 200 {"restaurant_name":null,"address":null,"resolved_url":null}  (safe empty response)
   ```
5. **Next.js BFF Route (live)**:
   ```powershell
   GET http://localhost:3000/api/parse-map-link?url=<encoded maps.app.goo.gl link>
   # 200 with the same payload (frontend -> BFF -> FastAPI -> Maps/Nominatim chain verified)
   ```

---

## 4. Acceptance Criteria Checklist
- [x] `AddDishModal` cannot be submitted without a valid Google Maps link.
- [x] Pasting a `maps.app.goo.gl/...` or `google.com/maps/...` link triggers the
      backend resolution automatically (no button).
- [x] Address (and Restaurant) inputs are dimmed with a loading indicator while
      resolving.
- [x] After resolution the address is auto-filled and the inputs are unlocked
      for manual edits; the restaurant name is filled when that field is empty.
- [x] New dishes are persisted with `address` and `google_map_url`.
- [x] `DishDetailModal` opens the saved `google_map_url` (with the previous
      search fallback).
- [x] All verification gates pass (lint, tsc, compileall, live endpoint tests).
