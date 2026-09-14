-- Business rules that must remain enforced outside the UI.

-- Payment state is independent from fulfillment state.
alter table public.orders add column if not exists payment_status text not null default 'pending';
alter table public.orders add column if not exists payment_reference text;
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists refunded_at timestamptz;

do $$
begin
  alter table public.orders add constraint orders_payment_status_check
    check (payment_status in ('pending', 'failed', 'paid', 'partially_refunded', 'refunded'));
exception when duplicate_object then null;
end $$;

create table if not exists public.return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  shop_order_id uuid,
  customer_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 5 and 2000),
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected', 'received', 'refunded', 'cancelled')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id)
);

create unique index if not exists return_requests_one_active_per_shop_order
  on public.return_requests(shop_order_id)
  where status in ('requested', 'approved', 'received');

alter table public.return_requests enable row level security;
drop policy if exists "Customers can view their return requests" on public.return_requests;
create policy "Customers can view their return requests"
  on public.return_requests for select to authenticated
  using (customer_id = auth.uid() or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));
drop policy if exists "Customers can request returns" on public.return_requests;
create policy "Customers can request returns"
  on public.return_requests for insert to authenticated
  with check (customer_id = auth.uid() and status = 'requested');
drop policy if exists "Admins can manage returns" on public.return_requests;
create policy "Admins can manage returns"
  on public.return_requests for update to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  shop_id uuid,
  type text not null,
  title text not null,
  body text not null,
  message text not null default '',
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- The notifications table may already exist from an earlier deployment.
alter table public.notifications add column if not exists type text not null default 'general';
alter table public.notifications add column if not exists body text not null default '';
alter table public.notifications add column if not exists message text not null default '';
alter table public.notifications add column if not exists entity_type text;
alter table public.notifications add column if not exists entity_id uuid;
alter table public.notifications add column if not exists read_at timestamptz;
alter table public.notifications add column if not exists shop_id uuid;

create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_shop_created_idx on public.notifications(shop_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "Users can read their notifications" on public.notifications;
create policy "Users can read their notifications"
  on public.notifications for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.shop_members m where m.shop_id = notifications.shop_id and m.user_id = auth.uid())
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  );
drop policy if exists "Users can mark their notifications read" on public.notifications;
create policy "Users can mark their notifications read"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Replace overly broad catalog writes with shop-owner/manager or admin checks.
drop policy if exists "Admins can insert categories" on public.categories;
drop policy if exists "Admins can update categories" on public.categories;
drop policy if exists "Admins can delete categories" on public.categories;
drop policy if exists "Shop staff can insert products" on public.products;
drop policy if exists "Shop staff can update products" on public.products;
drop policy if exists "Shop staff can delete products" on public.products;
drop policy if exists "Anyone can read active-shop products" on public.products;
drop policy if exists "Anyone can read active product variants" on public.product_variants;
drop policy if exists "Shop staff can insert product variants" on public.product_variants;
drop policy if exists "Shop staff can update product variants" on public.product_variants;
drop policy if exists "Shop staff can delete product variants" on public.product_variants;
drop policy if exists "Shop staff can insert product images" on public.product_images;
drop policy if exists "Shop staff can update product images" on public.product_images;
drop policy if exists "Shop staff can delete product images" on public.product_images;
drop policy if exists "Authenticated users can insert categories" on public.categories;
create policy "Admins can insert categories" on public.categories for insert to authenticated
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));
drop policy if exists "Authenticated users can update categories" on public.categories;
create policy "Admins can update categories" on public.categories for update to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));
drop policy if exists "Authenticated users can delete categories" on public.categories;
create policy "Admins can delete categories" on public.categories for delete to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

drop policy if exists "Authenticated users can insert products" on public.products;
create policy "Shop staff can insert products" on public.products for insert to authenticated
  with check (
    exists (select 1 from public.shops s where s.id = products.shop_id and s.status = 'active' and
      (s.owner_id = auth.uid() or exists (select 1 from public.shop_members m where m.shop_id = s.id and m.user_id = auth.uid() and m.role in ('owner', 'manager'))))
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  );
drop policy if exists "Authenticated users can update products" on public.products;
create policy "Shop staff can update products" on public.products for update to authenticated
  using (
    exists (select 1 from public.shops s where s.id = products.shop_id and (s.owner_id = auth.uid() or exists (select 1 from public.shop_members m where m.shop_id = s.id and m.user_id = auth.uid() and m.role in ('owner', 'manager'))))
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  ) with check (
    exists (select 1 from public.shops s where s.id = products.shop_id and (s.owner_id = auth.uid() or exists (select 1 from public.shop_members m where m.shop_id = s.id and m.user_id = auth.uid() and m.role in ('owner', 'manager'))))
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  );
drop policy if exists "Authenticated users can delete products" on public.products;
create policy "Shop staff can delete products" on public.products for delete to authenticated
  using (
    exists (select 1 from public.shops s where s.id = products.shop_id and (s.owner_id = auth.uid() or exists (select 1 from public.shop_members m where m.shop_id = s.id and m.user_id = auth.uid() and m.role in ('owner', 'manager'))))
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  );

-- Inactive and suspended shops must not be visible to anonymous customers.
drop policy if exists "Anyone can read products" on public.products;
create policy "Anyone can read active-shop products" on public.products for select
  using (exists (select 1 from public.shops s where s.id = products.shop_id and s.status = 'active'));

drop policy if exists "Authenticated users can manage product_variants" on public.product_variants;
create policy "Anyone can read active product variants" on public.product_variants for select
  using (exists (select 1 from public.products p join public.shops s on s.id = p.shop_id where p.id = product_variants.product_id and s.status = 'active'));
create policy "Shop staff can insert product variants" on public.product_variants for insert to authenticated
  with check (exists (select 1 from public.products p join public.shops s on s.id = p.shop_id where p.id = product_variants.product_id and s.status = 'active' and (s.owner_id = auth.uid() or exists (select 1 from public.shop_members m where m.shop_id = s.id and m.user_id = auth.uid() and m.role in ('owner', 'manager')))) or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));
create policy "Shop staff can update product variants" on public.product_variants for update to authenticated
  using (exists (select 1 from public.products p join public.shops s on s.id = p.shop_id where p.id = product_variants.product_id and (s.owner_id = auth.uid() or exists (select 1 from public.shop_members m where m.shop_id = s.id and m.user_id = auth.uid() and m.role in ('owner', 'manager')))) or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))
  with check (true);
create policy "Shop staff can delete product variants" on public.product_variants for delete to authenticated
  using (exists (select 1 from public.products p join public.shops s on s.id = p.shop_id where p.id = product_variants.product_id and (s.owner_id = auth.uid() or exists (select 1 from public.shop_members m where m.shop_id = s.id and m.user_id = auth.uid() and m.role in ('owner', 'manager')))) or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

drop policy if exists "Authenticated users can insert product_images" on public.product_images;
drop policy if exists "Authenticated users can update product_images" on public.product_images;
drop policy if exists "Authenticated users can delete product_images" on public.product_images;
create policy "Shop staff can insert product images" on public.product_images for insert to authenticated
  with check (exists (select 1 from public.products p join public.shops s on s.id = p.shop_id where p.id = product_images.product_id and s.status = 'active' and (s.owner_id = auth.uid() or exists (select 1 from public.shop_members m where m.shop_id = s.id and m.user_id = auth.uid() and m.role in ('owner', 'manager')))) or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));
create policy "Shop staff can update product images" on public.product_images for update to authenticated
  using (exists (select 1 from public.products p join public.shops s on s.id = p.shop_id where p.id = product_images.product_id and (s.owner_id = auth.uid() or exists (select 1 from public.shop_members m where m.shop_id = s.id and m.user_id = auth.uid() and m.role in ('owner', 'manager')))) or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))
  with check (true);
create policy "Shop staff can delete product images" on public.product_images for delete to authenticated
  using (exists (select 1 from public.products p join public.shops s on s.id = p.shop_id where p.id = product_images.product_id and (s.owner_id = auth.uid() or exists (select 1 from public.shop_members m where m.shop_id = s.id and m.user_id = auth.uid() and m.role in ('owner', 'manager')))) or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

-- Events are written by trusted triggers; clients only read/update their own rows.
create or replace function public.create_business_notification()
returns trigger language plpgsql security definer set search_path = public
as $$
declare order_state text;
begin
  if tg_table_name = 'shops' and to_jsonb(new)->>'status' is distinct from to_jsonb(old)->>'status' then
    insert into public.notifications (user_id, shop_id, type, title, body, message, entity_type, entity_id)
    values (new.owner_id, new.id, 'shop_status', 'Shop status updated', 'Your shop is now ' || (to_jsonb(new)->>'status') || '.', 'Your shop is now ' || (to_jsonb(new)->>'status') || '.', 'shop', new.id);
  elsif tg_table_name = 'product_reviews' and to_jsonb(new)->>'status' is distinct from to_jsonb(old)->>'status' then
    insert into public.notifications (user_id, type, title, body, message, entity_type, entity_id)
    values (new.user_id, 'review_status', 'Review status updated', 'Your product review was ' || (to_jsonb(new)->>'status') || '.', 'Your product review was ' || (to_jsonb(new)->>'status') || '.', 'review', new.id);
  elsif tg_table_name = 'orders' and (tg_op = 'INSERT' or coalesce(to_jsonb(new)->>'status', to_jsonb(new)->>'order_status') is distinct from coalesce(to_jsonb(old)->>'status', to_jsonb(old)->>'order_status')) then
    order_state := coalesce(to_jsonb(new)->>'status', to_jsonb(new)->>'order_status', 'pending');
    insert into public.notifications (user_id, type, title, body, message, entity_type, entity_id)
    values (new.customer_id, case when tg_op = 'INSERT' then 'order_created' else 'order_status' end, case when tg_op = 'INSERT' then 'Order received' else 'Order status updated' end, case when tg_op = 'INSERT' then 'Your order has been received.' else 'Your order is now ' || order_state || '.' end, case when tg_op = 'INSERT' then 'Your order has been received.' else 'Your order is now ' || order_state || '.' end, 'order', new.id);
  end if;
  return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'shops_business_notification') then
    create trigger shops_business_notification after update of status on public.shops for each row execute function public.create_business_notification();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'reviews_business_notification') then
    create trigger reviews_business_notification after update of status on public.product_reviews for each row execute function public.create_business_notification();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'orders_business_notification') then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'status') then
      execute 'create trigger orders_business_notification after insert or update of status on public.orders for each row execute function public.create_business_notification()';
    elsif exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'order_status') then
      execute 'create trigger orders_business_notification after insert or update of order_status on public.orders for each row execute function public.create_business_notification()';
    else
      execute 'create trigger orders_business_notification after insert on public.orders for each row execute function public.create_business_notification()';
    end if;
  end if;
end $$;
