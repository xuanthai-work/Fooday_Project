-- ============================================================================
-- Fooday — All-in-One Database Setup Script
-- Chạy toàn bộ script này trong: Supabase Dashboard → SQL Editor → Run (Ctrl+Enter)
-- Đảm bảo an toàn (idempotent), không gây trùng lặp dữ liệu.
-- ============================================================================

-- 1. BẢNG FOODS (Thực đơn món ăn) --------------------------------------------
create table if not exists public.foods (
  id           bigint generated always as identity primary key,
  slug         text unique not null,
  name         text not null,
  category     text not null check (category in ('Foods','Drinks','Snacks')),
  categories   jsonb default '[]'::jsonb,
  restaurant   text not null,
  rating       numeric(2,1) not null default 4.5,
  image_url    text not null,
  images       text[] default '{}',
  tag          text,
  address      text,
  opening_time text,
review_note  text,
  branches     jsonb default '[]'::jsonb,
  contributors jsonb default '[]'::jsonb,
  created_by   uuid references auth.users (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);

-- Bảo đảm các cột mở rộng luôn tồn tại ngay cả khi bảng đã được tạo trước đó
alter table public.foods
  add column if not exists images       text[] default '{}',
  add column if not exists address      text,
  add column if not exists opening_time text,
  add column if not exists review_note  text,
  add column if not exists categories   jsonb default '[]'::jsonb,
  add column if not exists branches     jsonb default '[]'::jsonb,
  add column if not exists contributors jsonb default '[]'::jsonb,
  add column if not exists created_by   uuid references auth.users (id) on delete set null default auth.uid();

-- Quán cũ (chỉ có 1 danh mục) vẫn hoạt động: category trở thành mảng của nó
update public.foods
set categories = jsonb_build_array(category)
where categories is null
   or jsonb_typeof(categories) <> 'array'
   or jsonb_array_length(categories) = 0;

-- Bật Row Level Security (RLS) cho foods
alter table public.foods enable row level security;

-- Mọi người (cả khách vãng lai và user) đều được xem danh sách món
drop policy if exists "foods_readable_by_everyone" on public.foods;
create policy "foods_readable_by_everyone"
  on public.foods for select
  to anon, authenticated
  using (true);

-- Chỉ user đã đăng ký (không phải khách ẩn danh) mới được đóng góp món mới
drop policy if exists "foods_insert_signed_up" on public.foods;
create policy "foods_insert_signed_up"
  on public.foods for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

-- Mọi user đã đăng nhập (không phải khách ẩn danh) được sửa món của cộng đồng
drop policy if exists "foods_update_own" on public.foods;
drop policy if exists "foods_update_authenticated" on public.foods;
create policy "foods_update_authenticated"
  on public.foods for update
  to authenticated
  using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
  with check (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

drop policy if exists "foods_delete_own" on public.foods;
create policy "foods_delete_own"
  on public.foods for delete to authenticated
  using (created_by = (select auth.uid()));


-- 2. BẢNG FAVORITES (Món ăn yêu thích) ---------------------------------------
create table if not exists public.favorites (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  food_id    bigint      not null references public.foods (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, food_id)
);

-- Bật RLS cho favorites
alter table public.favorites enable row level security;

drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own"
  on public.favorites for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own"
  on public.favorites for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own"
  on public.favorites for delete to authenticated
  using ((select auth.uid()) = user_id);


-- 3. KÍCH HOẠT SUPABASE REALTIME (Đồng bộ tức thì trên thiết bị) ------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'favorites'
  ) then
    alter publication supabase_realtime add table public.favorites;
  end if;
end $$;


-- 4. STORAGE BUCKET (Lưu ảnh món ăn do người dùng upload) -------------------
insert into storage.buckets (id, name, public)
values ('dish-images', 'dish-images', true)
on conflict (id) do nothing;

drop policy if exists "dish_images_select_public" on storage.objects;
create policy "dish_images_select_public"
  on storage.objects for select
  to public
  using (bucket_id = 'dish-images');

drop policy if exists "dish_images_insert_signed_up" on storage.objects;
create policy "dish_images_insert_signed_up"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'dish-images'
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );


-- 5. NẠP 94 MÓN ĂN VIỆT NAM THỰC TẾ VÀO CATALOG -----------------------------
-- Xóa 14 món demo tiếng Anh nếu còn sót lại từ bản seed cũ
delete from public.foods where slug in (
  'spicy-beef-ramen', 'classic-beef-burger', 'crispy-fried-chicken',
  'rainbow-poke-bowl', 'wood-fired-pizza', 'salmon-sushi-platter',
  'garden-buddha-bowl', 'grilled-herb-plate', 'iced-matcha-latte',
  'mixed-berry-smoothie', 'fresh-orange-juice', 'caramel-latte',
  'choco-chip-cookies', 'glazed-donuts'
);

insert into public.foods
  (slug, name, category, restaurant, rating, image_url, tag, address, opening_time, review_note)
values
  ('buffet-haan-vegan-chay', 'Buffet', 'Foods', 'Haan Vegan (chay)', 4.3, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/buffet-haan-vegan-chay.jpg', null, '71 Đào Tấn, Ngọc Khánh, Ba Đình', null, null),
  ('buffet-king-bbq-nuong', 'Buffet', 'Foods', 'King BBQ (nướng)', 4.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/buffet-king-bbq-nuong.jpg', null, 'Search on GG Maps', null, null),
  ('buffet-i-meat-u', 'Buffet', 'Foods', 'I meat U', 4.8, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/buffet-i-meat-u.jpg', null, 'Search on GG Maps', null, null),
  ('buffet-manyo', 'Buffet', 'Foods', 'Manyo', 4.3, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/buffet-manyo.jpg', null, 'Search on GG Maps', null, null),
  ('buffet-veggie-castle-chay', 'Buffet', 'Foods', 'Veggie Castle (chay)', 4.3, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/buffet-veggie-castle-chay.jpg', null, 'Search on GG Maps', null, null),
  ('buffet-poseidon-lau-nuong', 'Buffet', 'Foods', 'Poseidon (lẩu nướng)', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/buffet-poseidon-lau-nuong.jpg', null, 'Search on GG Maps', null, null),
  ('buffet-gri-gri', 'Buffet', 'Foods', 'Gri & Gri', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/buffet-gri-gri.jpg', null, 'Search on GG Maps', null, null),
  ('buffet-peace-vegan-chay', 'Buffet', 'Foods', 'Peace Vegan (chay)', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/buffet-peace-vegan-chay.jpg', null, '45 Phố Nhật Chiêu, Nhật Tân, Tây Hồ', null, null),
  ('buffet-dookki', 'Buffet', 'Foods', 'Dookki', 4.8, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/buffet-dookki.jpg', null, 'Search on GG Maps', null, null),
  ('buffet-k-pub', 'Buffet', 'Foods', 'K-pub', 4.5, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/buffet-k-pub.jpg', null, 'Search on GG Maps', null, null),
  ('buffet-shogun-nuong', 'Buffet', 'Foods', 'Shogun (nướng)', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/buffet-shogun-nuong.jpg', null, 'Search on GG Maps', null, null),
  ('banh-cuon-banh-cuon-gan-tram-y-te-phuong-ha-cau', 'Bánh cuốn', 'Foods', 'Bánh Cuốn gần Trạm y tế phường Hà Cầu', 5.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/banh-cuon-banh-cuon-gan-tram-y-te-phuong-ha-cau.jpg', null, 'Trạm y tế phường Hà Cầu', 'mở cả ngày', null),
  ('banh-mi-banh-mi-long-khanh', 'Bánh mì', 'Foods', 'Bánh mì Long Khánh', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/banh-mi-banh-mi-long-khanh.jpg', null, '92C - Hai Bà Trưng - Hoàn Kiếm', null, null),
  ('banh-mi-banh-mi-nem-khoai-co-nga', 'Bánh mì', 'Foods', 'Bánh mì nem khoai Cô Ngà', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/banh-mi-banh-mi-nem-khoai-co-nga.jpg', null, 'Số 6 Ngõ 28 Hương Viên', null, null),
  ('banh-mi-banh-mi-bo-xao', 'Bánh mì', 'Foods', 'Bánh mì bò xào', 4.5, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/banh-mi-banh-mi-bo-xao.jpg', null, 'Số 1 ngõ 36 Ao Sen, Hà Đông', null, null),
  ('banh-duc-tiem-may', 'Bánh đúc', 'Foods', 'Tiệm Mây', 5.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/banh-duc-tiem-may.jpg', null, '16 ngõ 2 Ao Sen', null, null),
  ('banh-duc-banh-duc-nong', 'Bánh đúc', 'Foods', 'Bánh đúc nóng', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/banh-duc-banh-duc-nong.jpg', null, '108B1 Trung Tự', null, null),
  ('banh-duc-banh-duc-nong-2', 'Bánh đúc', 'Foods', 'Bánh đúc nóng', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/banh-duc-banh-duc-nong-2.jpg', null, '112 Trương Định', null, null),
  ('banh-duc-thay-bao-ai-cung-biet', 'Bánh đúc', 'Foods', 'Thấy bảo ai cũng biết', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/banh-duc-thay-bao-ai-cung-biet.jpg', null, 'Ngõ 8 Lê Ngọc Hân', null, null),
  ('bun-bo-hue-bun-bo-hue-co-ly', 'Bún bò Huế', 'Foods', 'Bún bò Huế cô Ly', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/bun-bo-hue-bun-bo-hue-co-ly.jpg', null, '20 Quán Sứ', null, null),
  ('bun-bo-hue-bun-bo-hue-o-map', 'Bún bò Huế', 'Foods', 'Bún bò Huế O Mập', 4.5, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/bun-bo-hue-bun-bo-hue-o-map.jpg', null, 'Nhà thi đấu Hà Đông', null, null),
  ('bun-bo-hue-bun-bo-hue-ngu-uyen', 'Bún bò Huế', 'Foods', 'Bún bò Huế Ngự Uyển', 4.3, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/bun-bo-hue-bun-bo-hue-ngu-uyen.jpg', null, 'Search name on GG Maps', 'có mở tối', null),
  ('bun-bo-hue-bun-bo-goc-hue', 'Bún bò Huế', 'Foods', 'Bún bò Gốc Huế', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/bun-bo-hue-bun-bo-goc-hue.jpg', null, '149 Nguyễn Ngọc Vũ, Cầu Giấy', '7h - 15h; 17h - 21h30', null),
  ('bun-cha-bun-cha-co-mai', 'Bún chả', 'Foods', 'Bún chả cô Mai', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/bun-cha-bun-cha-co-mai.jpg', null, 'Số 2 Tô Hiến Thành, Hài Bà Trưng', '9h - 14h30', null),
  ('bun-cha-bun-cha-khong-biet-ten', 'Bún chả', 'Foods', 'Bún chả không biết tên', 3.8, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/bun-cha-bun-cha-khong-biet-ten.jpg', null, 'Quán bên gần TSQ, cấp 2 Mỗ Lao Hà Đông', null, null),
  ('bun-cha-bun-cha-hang-quat', 'Bún chả', 'Foods', 'Bún chả hàng Quạt', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/bun-cha-bun-cha-hang-quat.jpg', null, 'Ngõ 74 Hàng Quạt, Hoàn Kiếm', '10h - 14h30', null),
  ('bun-cha-bun-cha-gan-nha-em', 'Bún chả', 'Foods', 'Bún chả gần nhà em', 4.3, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/bun-cha-bun-cha-gan-nha-em.jpg', null, 'La Khê', null, null),
  ('bun-ca-cham-bun-ca-cham-gan-cong-ty-cu', 'Bún cá chấm', 'Foods', 'Bún cá chấm gần công ty cũ', 5.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/bun-ca-cham-bun-ca-cham-gan-cong-ty-cu.jpg', null, 'Nguyễn Thượng Hiền', 'qua trưa thì phải', null),
  ('bun-ngan-bun-ngan-ben-buu-dien', 'Bún ngan', 'Foods', 'Bún ngan bên bưu điện', 2.5, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/bun-ngan-bun-ngan-ben-buu-dien.jpg', null, 'Ngõ chỗ chợ gần bưu điện', null, null),
  ('bun-rieu-bun-rieu-le-loi', 'Bún riêu', 'Foods', 'Bún riêu Lê Lợi', 4.5, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/bun-rieu-bun-rieu-le-loi.jpg', null, 'Gần trường cấp 2 Lê Lợi, ngõ cạnh công an', null, null),
  ('bun-rieu-bun-rieu-khong-nho-ten', 'Bún riêu', 'Foods', 'Bún riêu không nhớ tên', 4.8, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/bun-rieu-bun-rieu-khong-nho-ten.jpg', null, 'Chùa Bộc', 'có mở tối', null),
  ('bun-rieu-bun-rieu-le-lai', 'Bún riêu', 'Foods', 'Bún riêu Lê Lai', 3.5, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/bun-rieu-bun-rieu-le-lai.jpg', null, 'Ngã tư Lê Lai', null, null),
  ('bun-rieu-bun-rieu-me-lam', 'Bún riêu', 'Foods', 'Bún riêu Mẹ Làm', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/bun-rieu-bun-rieu-me-lam.jpg', null, 'Số 2a - Ngõ 2 Ao Sen', null, null),
  ('bun-rieu-bun-rieu-quan-co-huong-beo', 'Bún riêu', 'Foods', 'Bún riêu quán cô Hương Béo', 5.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/bun-rieu-bun-rieu-quan-co-huong-beo.jpg', null, '127 Tô Hiệu, Hà Đông', 'có mở tối', null),
  ('bun-suon-bun-suon-dung', 'Bún sườn', 'Foods', 'Bún sườn Dung', 4.3, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/bun-suon-bun-suon-dung.jpg', null, 'Lê lợi', 'max trưa', null),
  ('bun-suon-bun-suon-cong-ty-cu', 'Bún sườn', 'Foods', 'Bún sườn công ty cũ', 5.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/bun-suon-bun-suon-cong-ty-cu.jpg', null, 'Nguyễn Thượng Hiền, Đỗ Hạnh', 'đến trưa, nma tầm 11 giờ hết', null),
  ('bun-thang-quan-cu', 'Bún thang', 'Foods', 'Quán cũ', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/bun-thang-quan-cu.jpg', null, '31A Phan Đình Phùng, Ba Đình', null, null),
  ('bun-thang-pho-cuong', 'Bún thang', 'Foods', 'Phở Cường', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/bun-thang-pho-cuong.jpg', null, '66 Yên Phụ, Ba Đình', '17h - 2h sáng', null),
  ('bun-dau-mam-tom-bun-dau-mam-tom-1', 'Bún đậu mắm tôm', 'Foods', 'Bún đậu mắm tôm 1', 4.3, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/bun-dau-mam-tom-bun-dau-mam-tom-1.jpg', null, 'Nguyễn Viết Xuân, Bế Văn Đàn', 'có mở tối', null),
  ('bun-dau-mam-tom-bun-dau-ganh', 'Bún đậu mắm tôm', 'Foods', 'Bún đậu gánh', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/bun-dau-mam-tom-bun-dau-ganh.jpg', null, '216 Hoàng Ngân', null, null),
  ('bun-dau-mam-tom-bun-dau-chi', 'Bún đậu mắm tôm', 'Foods', 'Bún Đậu Chi', 4.3, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/bun-dau-mam-tom-bun-dau-chi.jpg', null, 'Next to 1', null, null),
  ('bun-dau-mam-tom-bun-dau-chua-lang', 'Bún đậu mắm tôm', 'Foods', 'Bún đậu Chùa Láng', 4.8, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/bun-dau-mam-tom-bun-dau-chua-lang.jpg', null, 'Search name on GG Maps', null, null),
  ('chao-suon-chao-suon-le-lai', 'Cháo sườn', 'Foods', 'Cháo sườn Lê Lai', 4.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/chao-suon-chao-suon-le-lai.jpg', null, 'Lê Lai', 'có mở chiều tối thì phải', null),
  ('chao-suon-chao-suon-10', 'Cháo sườn', 'Foods', 'Cháo sườn 10', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/chao-suon-chao-suon-10.jpg', null, 'Số 10 ngõ 22 Trung Kính, Cầu Giấy, Hà Nội', '6h30 - 23h30', null),
  ('chao-suon-chao-suon-a-khoai', 'Cháo sườn', 'Foods', 'Cháo sườn A Khoai', 4.5, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/chao-suon-chao-suon-a-khoai.jpg', null, 'Số 3, ngõ 35, Phùng Hưng, Phúc La', null, null),
  ('chao-suon-cuc-chao-suon-sun', 'Cháo sườn', 'Foods', 'Cúc cháo sườn sụn', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/chao-suon-cuc-chao-suon-sun.jpg', null, '9B ngõ 2 phố Ao Sen, có cơ sở khác', null, null),
  ('chao-suon-chao-suon-71-phung-hung', 'Cháo sườn', 'Foods', 'Cháo sườn 71 Phùng Hưng', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/chao-suon-chao-suon-71-phung-hung.jpg', null, '71 Phùng Hưng - Hà Nội', null, null),
  ('com-xinyi-taiwan', 'Cơm', 'Foods', 'Xinyi Taiwan', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/com-xinyi-taiwan.jpg', null, '197 Nguyễn Văn Trỗi, Hà Đông, Hà Nội', null, null),
  ('com-com-ga-te-te-chicken', 'Cơm', 'Foods', 'Cơm gà tê tê chicken', 4.3, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/com-com-ga-te-te-chicken.jpg', null, 'cs1: Số 8 ngõ 91 Chùa Láng cs2: 31 Vũ PHạm Hàm cs3: 51F Dương Khuê', 'có mở tối', null),
  ('com-com-chay-kho-quet', 'Cơm', 'Foods', 'Cơm cháy kho quẹt', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/com-com-chay-kho-quet.jpg', null, 'Số 5 Võ Thị Sáu', null, null),
  ('com-kakuto', 'Cơm', 'Foods', 'Kakuto', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/com-kakuto.jpg', null, '10 ngõ 2 Nguyễn Văn Lộc - Hà Đông', '11h - 14h, 17h - 21h', null),
  ('com-com-nhu-o-nha', 'Cơm', 'Foods', 'Cơm như ở nhà', 4.5, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/com-com-nhu-o-nha.jpg', null, 'Nguyễn Văn Lộc', 'có mở tối', null),
  ('com-com-tra-nhat-saku', 'Cơm', 'Foods', 'Cơm trà nhật Saku', 4.3, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/com-com-tra-nhat-saku.jpg', null, 'cs1: Số 16 ngõ 7 Ao Sen cs2: Số 9 ngõ 67 Phùng Khoang', 'có mở tối', null),
  ('com-com-trung-loc-xoay', 'Cơm', 'Foods', 'Cơm trứng lốc xoáy', 4.3, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/com-com-trung-loc-xoay.jpg', null, '48 Phạm Hồng Thái', 'có mở tối', null),
  ('ga-lotteria', 'Gà', 'Foods', 'Lotteria', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/ga-lotteria.jpg', null, 'Search on GG Maps', null, 'Same as others'),
  ('ga-tiem-ga-so-19', 'Gà', 'Foods', 'Tiệm gà số 19', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/ga-tiem-ga-so-19.jpg', null, 'Số 1 ngõ 32A Hào Nam, Đống Đa', null, null),
  ('ga-bon-chon', 'Gà', 'Foods', 'Bon chon', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/ga-bon-chon.jpg', null, 'Search on GG Maps', null, null),
  ('ga-don-chicken', 'Gà', 'Foods', 'Don chicken', 5.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/ga-don-chicken.jpg', null, 'Search on GG Maps', null, null),
  ('ga-kfc', 'Gà', 'Foods', 'KFC', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/ga-kfc.jpg', null, 'Search on GG Maps', null, 'Same as others'),
  ('ga-mc-don-no', 'Gà', 'Foods', 'Mc đôn nồ', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/ga-mc-don-no.jpg', null, 'Search on GG Maps', null, 'Same as others'),
  ('ga-popeyes', 'Gà', 'Foods', 'Popeyes', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/ga-popeyes.jpg', null, 'Search on GG Maps', null, 'Same as others'),
  ('ga-jollibee', 'Gà', 'Foods', 'Jollibee', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/ga-jollibee.jpg', null, 'Search on GG Maps', null, 'Same as others'),
  ('ga-nollowa-chicken', 'Gà', 'Foods', 'Nollowa chicken', 4.5, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/ga-nollowa-chicken.jpg', null, 'Search on GG Maps', null, null),
  ('ga-cece-s-box', 'Gà', 'Foods', 'Cece''s Box', 4.5, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/ga-cece-s-box.jpg', null, 'Search on GG Maps', null, null),
  ('hamburger-burger-king', 'Hamburger', 'Foods', 'Burger king', 4.5, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/hamburger-burger-king.jpg', null, 'Search on GG Maps', null, null),
  ('hamburger-ezrollin', 'Hamburger', 'Foods', 'Ezrollin', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/hamburger-ezrollin.jpg', null, '472 Nguyễn Trãi, Thanh Xuân, Hà Nội', null, null),
  ('hamburger-an-cung-cac-quan-ga', 'Hamburger', 'Foods', 'Ăn cùng các quán gà', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/hamburger-an-cung-cac-quan-ga.jpg', null, 'map', null, null),
  ('mi-mi-van-than', 'Mì', 'Foods', 'Mì vằn thắn', 5.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/mi-mi-van-than.jpg', null, 'Số 1 Lê Duẩn', 'có mở tối', null),
  ('mi-kakuto', 'Mì', 'Foods', 'Kakuto', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/mi-kakuto.jpg', null, '10 ngõ 2 Nguyễn Văn Lộc - Hà Đông', null, null),
  ('mi-tantan-tokyo-ramen-undon', 'Mì', 'Foods', 'Tantan Tokyo (ramen, undon)', 4.5, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/mi-tantan-tokyo-ramen-undon.jpg', null, 'Search name on GG Maps', null, null),
  ('mi-mi-lanh', 'Mì', 'Foods', 'Mì lạnh', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/mi-mi-lanh.jpg', null, 'Search for Korean food', 'tùy quán', null),
  ('mi-mi-indomie-cong-truong', 'Mì', 'Foods', 'Mì indomie cổng trường', 4.8, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/mi-mi-indomie-cong-truong.jpg', null, 'Search: Cổng trường THPT Trương Định', 'mở đến 7h tối', null),
  ('mi-machi-ramen', 'Mì', 'Foods', 'Machi Ramen', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/mi-machi-ramen.jpg', null, '26 Ngõ 267/2 Hoàng Hoa Thám', null, null),
  ('nuong-nuong-ma-may-van-quan', 'Nướng', 'Foods', 'Nướng Mã Mây ( Văn Quán)', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/nuong-nuong-ma-may-van-quan.jpg', null, 'Chỉ nhớ là ở Văn Quán', null, 'Giá cx đc, ăn ok, ban vỉa hè'),
  ('nuong-nuong-via-he-ngo-thi-nham', 'Nướng', 'Foods', 'Nướng vỉa hè Ngô Thì Nhậm', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/nuong-nuong-via-he-ngo-thi-nham.jpg', null, 'Ngô Thì Nhậm', null, 'đã ăn khá nhiều với bạn, rẻ, ăn uki, vỉa hè mùa thu đông ăn hợp'),
  ('nuong-ottugi-kieu-han', 'Nướng', 'Foods', 'Ottugi (kiểu Hàn)', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/nuong-ottugi-kieu-han.jpg', null, 'Ngõ 179 Đình Thôn', null, 'tiktok, thấy bảo ngon, giá cả ổn tầm 300/ng'),
  ('pho-bo-bo-sot-vang-pho-gi-gi-beo', 'Phở bò, bò sốt vang', 'Foods', 'Phở gì gì Béo', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/pho-bo-bo-sot-vang-pho-gi-gi-beo.jpg', null, 'Quang Trung, Cầu Đơ', 'có mở tối', null),
  ('pho-bo-bo-sot-vang-pho-lam', 'Phở bò, bò sốt vang', 'Foods', 'Phở Lâm', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/pho-bo-bo-sot-vang-pho-lam.jpg', null, 'Tô Hiệu', null, null),
  ('pho-ga-pho-lam', 'Phở gà', 'Foods', 'Phở Lâm', 4.8, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/pho-ga-pho-lam.jpg', null, 'Tô Hiệu', null, null),
  ('pho-ga-pho-ga-em-dua-di-an', 'Phở gà', 'Foods', 'Phở gà em đưa đi ăn', 4.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/pho-ga-pho-ga-em-dua-di-an.jpg', null, 'Quán đầu đường xiên bẩn', 'có mở tối', null),
  ('pho-ga-pho-ngoc-lai-2-co-so', 'Phở gà', 'Foods', 'Phở Ngọc Lai (2 cơ sở)', 4.3, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/pho-ga-pho-ngoc-lai-2-co-so.jpg', null, 'cs1: gần chợ Hà Đông cs2: gần Bún sườn Dung', 'mở qua trưa', null),
  ('pho-ga-pho-ga-156', 'Phở gà', 'Foods', 'Phở gà 156', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/pho-ga-pho-ga-156.jpg', null, '64 Hòa Mã - Phạm Đình Hổ - Hoàn Kiếm', null, null),
  ('tacos-taetna', 'Tacos', 'Foods', 'Taetna', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/tacos-taetna.jpg', null, 'Search on GG Maps', null, null),
  ('tacos-abeille', 'Tacos', 'Foods', 'Abeille', 4.5, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/tacos-abeille.jpg', null, '125 Nam Đồng', 'có mở tối', null),
  ('tacos-m-bros', 'Tacos', 'Foods', 'M Bros', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/tacos-m-bros.jpg', null, '127 Triệu Việt Vương, Hai Bà Trưng', null, null),
  ('xien-ban-xien-ban-cua-co', 'Xiên bẩn', 'Snacks', 'Xiên bẩn của cô', 4.5, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/xien-ban-xien-ban-cua-co.jpg', null, 'waiting...', null, null),
  ('do-han-pogeun-korean-home-pub', 'Đồ Hàn', 'Foods', 'Pogeun Korean Home Pub', 4.5, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/do-han-pogeun-korean-home-pub.jpg', null, 'Search on GG Maps', null, null),
  ('do-han-com-han-quoc-big-boss', 'Đồ Hàn', 'Foods', 'Cơm Hàn Quốc BIG BOSS', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/do-han-com-han-quoc-big-boss.jpg', null, '8A/121 Chùa Láng', null, null),
  ('do-han-miss-bistro', 'Đồ Hàn', 'Foods', 'Miss Bistro', 4.5, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/do-han-miss-bistro.jpg', null, '25 Vũ Trọng Phụng - Thanh Xuân Trung', null, null),
  ('do-han-maru', 'Đồ Hàn', 'Foods', 'Maru', 4.3, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/do-han-maru.jpg', null, 'Search on GG Maps', null, null),
  ('do-han-huy-go-cook', 'Đồ Hàn', 'Foods', 'Huy Go Cook', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/do-han-huy-go-cook.jpg', null, 'cs1: 130 Chùa Láng, Đống Đa cs2: 257 Trần Đại Nghĩa', '10h - 22h', null),
  ('do-han-hansik-sarang', 'Đồ Hàn', 'Foods', 'Hansik Sarang', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/do-han-hansik-sarang.jpg', null, '45 Giải Phóng - Hai Bà Trưng', null, null),
  ('do-thai-mr-tuktuk', 'Đồ Thái', 'Foods', 'Mr. TukTuk', 5.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/do-thai-mr-tuktuk.jpg', null, 'Search on GG Maps', null, null),
  ('do-thai-thai-umee', 'Đồ Thái', 'Foods', 'Thai Umee', 0.0, 'https://fiojspbdijspafjqaqlx.supabase.co/storage/v1/object/public/dish-images/dishes/do-thai-thai-umee.jpg', null, 'Search on GG Maps', null, null)
on conflict (slug) do update set
  name = excluded.name,
  category = excluded.category,
  restaurant = excluded.restaurant,
  rating = excluded.rating,
  image_url = excluded.image_url,
  tag = excluded.tag,
  address = excluded.address,
  opening_time = excluded.opening_time,
  review_note = excluded.review_note;

-- 6. BẢNG REVIEWS (Đánh giá & Bình luận món ăn) ------------------------------
create table if not exists public.reviews (
  id         bigint generated always as identity primary key,
  food_id    bigint not null references public.foods (id) on delete cascade,
  user_id    uuid references auth.users (id) on delete cascade default auth.uid(),
  user_name  text not null,
  rating     int not null default 5 check (rating >= 1 and rating <= 5),
  comment    text not null,
  created_at timestamptz not null default now()
);

create index if not exists reviews_food_id_created_at_idx
  on public.reviews (food_id, created_at desc);

alter table public.reviews enable row level security;

-- Cho phép tất cả mọi người đọc bình luận
drop policy if exists "reviews_readable_by_everyone" on public.reviews;
create policy "reviews_readable_by_everyone"
  on public.reviews for select
  to anon, authenticated
  using (true);

-- Cho phép cả khách vãng lai và user đăng bình luận
drop policy if exists "reviews_insert_authenticated" on public.reviews;
create policy "reviews_insert_authenticated"
  on public.reviews for insert
  to anon, authenticated
  with check (true);

-- Chỉ chính chủ mới được xóa bình luận của mình
drop policy if exists "reviews_delete_own" on public.reviews;
create policy "reviews_delete_own"
  on public.reviews for delete
  to authenticated
  using (user_id = auth.uid());

-- Realtime cho bảng reviews và bảng foods
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reviews'
  ) then
    alter publication supabase_realtime add table public.reviews;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'foods'
  ) then
    alter publication supabase_realtime add table public.foods;
  end if;
end $$;

-- 7. ĐIỂM TRUNG BÌNH, GIỚI HẠN 3 THÁNG, ẢNH ĐÁNH GIÁ -----------------------
alter table public.reviews
  add column if not exists image_url text;

create table if not exists public.review_limits (
  user_id     uuid not null references auth.users (id) on delete cascade,
  food_id     bigint not null references public.foods (id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  primary key (user_id, food_id)
);

alter table public.review_limits enable row level security;

drop policy if exists "review_limits_select_own" on public.review_limits;
create policy "review_limits_select_own"
  on public.review_limits for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "reviews_insert_authenticated" on public.reviews;
create policy "reviews_insert_authenticated"
  on public.reviews for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create or replace function public.enforce_review_cooldown()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    raise exception 'review_signin_required';
  end if;

  if exists (
    select 1
    from public.review_limits
    where user_id = new.user_id
      and food_id = new.food_id
      and reviewed_at > now() - interval '45 days'
  ) or exists (
    select 1
    from public.reviews
    where user_id = new.user_id
      and food_id = new.food_id
      and created_at > now() - interval '45 days'
  ) then
    raise exception 'review_cooldown';
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_cooldown_before_insert on public.reviews;
create trigger reviews_cooldown_before_insert
  before insert on public.reviews
  for each row
  execute function public.enforce_review_cooldown();

create or replace function public.sync_food_rating_from_reviews()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target bigint;
  avg_rating numeric;
  n int;
begin
  target := coalesce(new.food_id, old.food_id);

  if tg_op = 'INSERT' and new.user_id is not null then
    insert into public.review_limits (user_id, food_id, reviewed_at)
    values (new.user_id, new.food_id, coalesce(new.created_at, now()))
    on conflict (user_id, food_id)
    do update set reviewed_at = excluded.reviewed_at;
  end if;

  select round(avg(rating)::numeric, 1), count(*)::int
    into avg_rating, n
  from public.reviews
  where food_id = target;

  if n > 0 then
    update public.foods
      set rating = avg_rating
      where id = target;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists reviews_sync_food_rating on public.reviews;
create trigger reviews_sync_food_rating
  after insert or update of rating or delete on public.reviews
  for each row
  execute function public.sync_food_rating_from_reviews();

insert into public.review_limits (user_id, food_id, reviewed_at)
select user_id, food_id, max(created_at)
from public.reviews
where user_id is not null
group by user_id, food_id
on conflict (user_id, food_id)
do update set reviewed_at = excluded.reviewed_at;

update public.foods as f
set rating = s.avg_rating
from (
  select food_id, round(avg(rating)::numeric, 1) as avg_rating
  from public.reviews
  group by food_id
) as s
where f.id = s.food_id;

insert into storage.buckets (id, name, public)
values ('review-images', 'review-images', true)
on conflict (id) do nothing;

drop policy if exists "review_images_select_public" on storage.objects;
create policy "review_images_select_public"
  on storage.objects for select
  to public
  using (bucket_id = 'review-images');

drop policy if exists "review_images_insert_own" on storage.objects;
create policy "review_images_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'review-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "review_images_delete_own" on storage.objects;
create policy "review_images_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'review-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Bucket cho ảnh đại diện người dùng.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_read_public" on storage.objects;
create policy "avatars_read_public"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
