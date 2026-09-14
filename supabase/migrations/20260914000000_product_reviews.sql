create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review text not null check (char_length(trim(review)) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  unique (product_id, user_id)
);

alter table public.product_reviews enable row level security;

drop policy if exists "Anyone can read approved product reviews" on public.product_reviews;
create policy "Anyone can read approved product reviews"
  on public.product_reviews for select using (status = 'approved' or auth.uid() = user_id);

drop policy if exists "Admins can read all product reviews" on public.product_reviews;
create policy "Admins can read all product reviews"
  on public.product_reviews for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true);

drop policy if exists "Users can submit product reviews" on public.product_reviews;
create policy "Users can submit product reviews"
  on public.product_reviews for insert to authenticated
  with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "Admins can moderate product reviews" on public.product_reviews;
create policy "Admins can moderate product reviews"
  on public.product_reviews for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true)
  with check ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true);

create index if not exists product_reviews_product_status_idx
  on public.product_reviews(product_id, status, created_at desc);