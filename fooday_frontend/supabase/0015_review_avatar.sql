-- ============================================================================
-- Fooday - Review author avatar snapshot.
-- Run in Supabase Dashboard -> SQL Editor (idempotent - safe to re-run).
-- ============================================================================

alter table public.reviews
  add column if not exists avatar_url text;

-- Fill existing reviews from the account's current avatar.
update public.reviews r
set avatar_url = u.raw_user_meta_data->>'avatar_url'
from auth.users u
where r.user_id = u.id
  and (r.avatar_url is null or r.avatar_url = '')
  and coalesce(u.raw_user_meta_data->>'avatar_url', '') <> '';
