# Add a Dish — Community Catalog Contributions

- **Date:** 2026-06-19
- **Status:** Approved design → ready for implementation plan
- **Context:** Phase 2 done — catalog + favorites live in Supabase (`foods`, `favorites`),
  AI chat grounded in the catalog via Gemini. The `foods` catalog is currently seed-only
  (public read, no client insert). This feature lets signed-up users contribute dishes.

## Goal

Let **signed-up (email) users** add a new dish that joins the **shared public catalog**
everyone browses. Guests (anonymous sessions) cannot add. Images are **auto-fetched from
Unsplash** by dish name, with **photo upload** as a manual override.

## Who can add (gating)

- **Signed-up, non-anonymous users only.** Guests see a disabled "Add dish" affordance with
  a "Sign up to add dishes" hint.
- Enforced in **both** the UI and Postgres **RLS** (defense in depth).

## 1. Database — migration `fooday_frontend/supabase/0003_add_dish.sql`

```sql
-- track the author. default auth.uid() so client inserts fill it automatically;
-- existing seed rows backfill to null (auth.uid() is null in the SQL editor) = admin.
alter table public.foods
  add column if not exists created_by uuid references auth.users (id)
    on delete set null default auth.uid();

-- INSERT: only non-anonymous users, only their own row
drop policy if exists "foods_insert_signed_up" on public.foods;
create policy "foods_insert_signed_up" on public.foods for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

-- UPDATE / DELETE: only your own dishes
drop policy if exists "foods_update_own" on public.foods;
create policy "foods_update_own" on public.foods for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

drop policy if exists "foods_delete_own" on public.foods;
create policy "foods_delete_own" on public.foods for delete to authenticated
  using (created_by = (select auth.uid()));
-- (public SELECT policy from 0001 stays as-is)
```

**Storage bucket** for uploads (created in Dashboard → Storage, or SQL):
- Bucket `dish-images`, **public read** (`public = true`).
- INSERT policy on `storage.objects`: `bucket_id = 'dish-images'` AND the uploader is
  non-anonymous (same `is_anonymous` check).

## 2. Backend — Unsplash image search (keeps the key secret)

New endpoint in `fooday_backend`:

```
GET /api/v1/dish-image?q=<dish name>
  → Unsplash: GET https://api.unsplash.com/search/photos
      ?query=<q>&per_page=4&orientation=squarish
      Authorization: Client-ID <UNSPLASH_ACCESS_KEY>
  → 200: { "images": [ { "url": "<urls.regular>", "alt": "...", "credit": "<photographer>" }, ... ] }
  → graceful empty list on error / missing key
```

- Add `UNSPLASH_ACCESS_KEY` to `fooday_backend/.env` + `.env.example`.
- Load via the existing `app/config.py`; add the route alongside `/chat`.
- The frontend never sees the Unsplash key.

## 3. Frontend (`fooday_frontend`)

### Entry point
- An **"Add dish"** button in the Home header (next to bell / theme toggle), shown only when
  the user is signed-up and non-anonymous; guests get the "Sign up to add dishes" hint.
- Opens **`AddDishModal`** (new component, styled-jsx + existing design tokens, light/dark,
  responsive — full-screen sheet on mobile, centered card on desktop).

### AddDishModal
Fields:
- **name** (text, required)
- **category** (segmented/select: Foods / Drinks / Snacks, required)
- **restaurant** (text, required)
- **rating** (star picker 1–5, default 4.5)
- **tag** (optional short text, e.g. "Trending")
- **image**:
  - As the name settles (debounced) OR via a "Find image" action, call
    `GET /api/v1/dish-image?q=<name>` and show the first result as a preview (optionally let
    the user cycle through the few candidates).
  - **Upload** button → file input → `supabase.storage.from('dish-images').upload(path, file)`
    → `getPublicUrl` → use that as the image (override). `path = <uid>/<timestamp>-<file>`.
  - The chosen URL (Unsplash candidate or uploaded public URL) becomes `image_url`.

### Submit
- Validate required fields + rating range.
- Generate a unique **slug**: `slugify(name)` + `-` + a short random suffix.
- `supabase.from('foods').insert({ slug, name, category, restaurant, rating, image_url, tag })`
  — `created_by` fills from the column default `auth.uid()`; RLS enforces non-guest + own row.
- On success: close modal, **refresh the catalog**, and surface a toast/inline success.
- On error (e.g., RLS / duplicate slug): show an inline error; offer retry.

### Shared catalog refresh
- Refactor **`useFoods`** into a small shared store (module state + listeners /
  `useSyncExternalStore`) exposing `refresh()`, so a newly added dish appears app-wide
  (Home grid + Profile resolution) without a page reload. Keep it lint-clean (no synchronous
  `setState` in effects).

### Image config
- `next.config.ts` `images.remotePatterns`: add the Supabase Storage host
  (`*.supabase.co`, path `/storage/v1/object/public/**`). Unsplash is already allowed.

## Validation rules
- name, restaurant: non-empty (trimmed); category ∈ {Foods, Drinks, Snacks}; rating ∈ [1, 5].
- An image is required (either an auto-fetched URL or an uploaded file) before submit is enabled.

## Verification plan
- **Build/quality:** `npm run build` + `npm run lint` clean (frontend); backend imports +
  `/api/v1/dish-image` returns results for a sample query.
- **Manual (e2e):**
  1. Signed-up user opens Add dish → types a name → an Unsplash image auto-loads.
  2. Submit → the dish appears in the Home grid immediately and for a second browser/user.
  3. Upload path: pick a file → it uploads and previews → submit → dish shows the uploaded image.
  4. Guest: the Add dish button is gated; a direct `insert` is rejected by RLS.
  5. Build + lint clean; capture screenshots (modal, new dish on Home).

## External setup (user)
1. Run `supabase/0003_add_dish.sql` in the SQL Editor.
2. Create the `dish-images` Storage bucket (public read) + the upload policy.
3. Create a free **Unsplash access key** (unsplash.com/developers) and paste it into
   `fooday_backend/.env` as `UNSPLASH_ACCESS_KEY`.

## Out of scope (future)
- Moderation / reporting of user dishes; admin review queue.
- Editing/deleting dishes from the UI (RLS already allows own-row update/delete — no UI yet).
- Google Maps / Places photo fetch (deferred earlier; needs a Maps Platform key + billing).
- Per-restaurant real photos (Unsplash gives representative stock photos by dish type).
