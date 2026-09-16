-- Delivery operations: rider applications, direct invites, assignments, events and COD-safe status updates.
create table if not exists public.delivery_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  full_name text not null,
  phone text,
  address text,
  cnic text,
  vehicle_type text,
  vehicle_number text,
  license_number text,
  license_image_url text,
  profile_photo_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended', 'inactive')),
  rejection_reason text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists delivery_profiles_user_idx on public.delivery_profiles(user_id) where user_id is not null;
create unique index if not exists delivery_profiles_email_idx on public.delivery_profiles(lower(email));

create table if not exists public.delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  shop_order_id uuid not null references public.shop_orders(id) on delete cascade,
  rider_id uuid not null references public.delivery_profiles(id) on delete restrict,
  assigned_by uuid references auth.users(id),
  status text not null default 'assigned' check (status in ('assigned', 'accepted', 'picked_up', 'out_for_delivery', 'delivered', 'failed', 'cancelled')),
  assigned_at timestamptz not null default now(),
  accepted_at timestamptz,
  picked_up_at timestamptz,
  out_for_delivery_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  cod_expected_amount numeric(14,2) not null default 0,
  cod_collected_amount numeric(14,2) not null default 0,
  cod_collected_at timestamptz,
  proof_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_order_id)
);

create index if not exists delivery_assignments_rider_idx on public.delivery_assignments(rider_id, status, assigned_at desc);
create index if not exists delivery_assignments_order_idx on public.delivery_assignments(shop_order_id);

create table if not exists public.delivery_events (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.delivery_assignments(id) on delete cascade,
  status text not null,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create or replace function public.is_active_rider()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.delivery_profiles
     where user_id = auth.uid() and status = 'approved'
  );
$$;

grant execute on function public.is_active_rider() to authenticated;

create or replace function public.link_delivery_profile_to_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.delivery_profiles
     set user_id = new.id, status = case when status = 'pending' then 'approved' else status end, approved_at = case when status = 'pending' then coalesce(approved_at, now()) else approved_at end, updated_at = now()
   where user_id is null and lower(email) = lower(new.email);
  return new;
end;
$$;

drop trigger if exists link_delivery_profile_after_signup on auth.users;
create trigger link_delivery_profile_after_signup
after insert on auth.users
for each row execute function public.link_delivery_profile_to_user();

alter table public.delivery_profiles enable row level security;
alter table public.delivery_assignments enable row level security;
alter table public.delivery_events enable row level security;

drop policy if exists "Authenticated users can apply as riders" on public.delivery_profiles;
create policy "Authenticated users can apply as riders" on public.delivery_profiles
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "Riders can read own profile" on public.delivery_profiles;
create policy "Riders can read own profile" on public.delivery_profiles
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Riders can update own profile" on public.delivery_profiles;
create policy "Riders can update own profile" on public.delivery_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Admins can manage delivery profiles" on public.delivery_profiles;
create policy "Admins can manage delivery profiles" on public.delivery_profiles
  for all to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

drop policy if exists "Riders can read assigned deliveries" on public.delivery_assignments;
create policy "Riders can read assigned deliveries" on public.delivery_assignments
  for select to authenticated using (exists (select 1 from public.delivery_profiles p where p.id = rider_id and p.user_id = auth.uid()));
drop policy if exists "Shop staff can manage delivery assignments" on public.delivery_assignments;
create policy "Shop staff can manage delivery assignments" on public.delivery_assignments
  for all to authenticated
  using (public.is_shop_staff_for_shop((select shop_id from public.shop_orders where id = shop_order_id)))
  with check (public.is_shop_staff_for_shop((select shop_id from public.shop_orders where id = shop_order_id)));
drop policy if exists "Admins can manage delivery assignments" on public.delivery_assignments;
create policy "Admins can manage delivery assignments" on public.delivery_assignments
  for all to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

drop policy if exists "Riders can update assigned deliveries" on public.delivery_assignments;
create policy "Riders can update assigned deliveries" on public.delivery_assignments
  for update to authenticated
  using (exists (select 1 from public.delivery_profiles p where p.id = rider_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.delivery_profiles p where p.id = rider_id and p.user_id = auth.uid()));

drop policy if exists "Riders can read own delivery events" on public.delivery_events;
create policy "Riders can read own delivery events" on public.delivery_events
  for select to authenticated using (exists (select 1 from public.delivery_assignments a join public.delivery_profiles p on p.id = a.rider_id where a.id = assignment_id and p.user_id = auth.uid()));
drop policy if exists "Authenticated users can create delivery events" on public.delivery_events;
create policy "Authenticated users can create delivery events" on public.delivery_events
  for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "Admins can read delivery events" on public.delivery_events;
create policy "Admins can read delivery events" on public.delivery_events
  for select to authenticated using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

-- Assigned riders can see only the order data needed to deliver their parcel.
drop policy if exists "Riders can read assigned shop orders" on public.shop_orders;
create policy "Riders can read assigned shop orders" on public.shop_orders
  for select to authenticated using (exists (select 1 from public.delivery_assignments a join public.delivery_profiles p on p.id = a.rider_id where a.shop_order_id = shop_orders.id and p.user_id = auth.uid()));
drop policy if exists "Riders can update assigned shop orders" on public.shop_orders;

create or replace function public.assign_delivery(target_shop_order_id uuid, target_rider_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare assignment_id uuid; expected numeric;
begin
  if not (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) or public.is_shop_staff_for_shop((select shop_id from public.shop_orders where id = target_shop_order_id))) then return null; end if;
  if not exists (select 1 from public.delivery_profiles where id = target_rider_id and status = 'approved') then return null; end if;
  select greatest(coalesce(nullif(gross_amount, 0), (to_jsonb(public.shop_orders) ->> 'total_amount')::numeric, (to_jsonb(public.shop_orders) ->> 'subtotal')::numeric, 0), 0) into expected from public.shop_orders where id = target_shop_order_id;
  insert into public.delivery_assignments (shop_order_id, rider_id, assigned_by, cod_expected_amount)
  values (target_shop_order_id, target_rider_id, auth.uid(), case when lower(coalesce((select payment_method from public.shop_orders where id = target_shop_order_id), 'cash_on_delivery')) = 'cash_on_delivery' then expected else 0 end)
  on conflict (shop_order_id) do update set rider_id = excluded.rider_id, assigned_by = excluded.assigned_by, status = 'assigned', updated_at = now()
  returning id into assignment_id;
  insert into public.delivery_events (assignment_id, status, created_by) values (assignment_id, 'assigned', auth.uid());
  return assignment_id;
end;
$$;

grant execute on function public.assign_delivery(uuid, uuid) to authenticated;

create or replace function public.update_delivery_assignment(target_assignment_id uuid, target_status text, target_collected_amount numeric default 0, target_failure_reason text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare assignment_row public.delivery_assignments%rowtype; order_row public.shop_orders%rowtype; now_time timestamptz := now();
begin
  select * into assignment_row from public.delivery_assignments where id = target_assignment_id for update;
  if not found or not (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) or exists (select 1 from public.delivery_profiles where id = assignment_row.rider_id and user_id = auth.uid())) then return false; end if;
  if target_status not in ('accepted', 'picked_up', 'out_for_delivery', 'delivered', 'failed') then return false; end if;
  select * into order_row from public.shop_orders where id = assignment_row.shop_order_id;
  if not found then return false; end if;
  if target_status = 'delivered' and lower(coalesce(order_row.payment_method, 'cash_on_delivery')) = 'cash_on_delivery' and target_collected_amount < assignment_row.cod_expected_amount then return false; end if;
  update public.delivery_assignments set status = target_status, accepted_at = case when target_status = 'accepted' then coalesce(accepted_at, now_time) else accepted_at end, picked_up_at = case when target_status = 'picked_up' then coalesce(picked_up_at, now_time) else picked_up_at end, out_for_delivery_at = case when target_status = 'out_for_delivery' then coalesce(out_for_delivery_at, now_time) else out_for_delivery_at end, delivered_at = case when target_status = 'delivered' then coalesce(delivered_at, now_time) else delivered_at end, failed_at = case when target_status = 'failed' then coalesce(failed_at, now_time) else failed_at end, failure_reason = case when target_status = 'failed' then target_failure_reason else failure_reason end, cod_collected_amount = case when target_status = 'delivered' then target_collected_amount else cod_collected_amount end, cod_collected_at = case when target_status = 'delivered' and lower(coalesce(order_row.payment_method, 'cash_on_delivery')) = 'cash_on_delivery' then now_time else cod_collected_at end, updated_at = now_time where id = target_assignment_id;
  if target_status in ('picked_up', 'out_for_delivery', 'delivered') then update public.shop_orders set order_status = case when target_status = 'picked_up' then 'shipped' when target_status = 'out_for_delivery' then 'out_for_delivery' else 'delivered' end, cod_collected_amount = case when target_status = 'delivered' then target_collected_amount else cod_collected_amount end, cod_collected_at = case when target_status = 'delivered' then now_time else cod_collected_at end, cod_collection_status = case when target_status = 'delivered' and lower(coalesce(payment_method, 'cash_on_delivery')) = 'cash_on_delivery' then 'collected' else cod_collection_status end where id = assignment_row.shop_order_id; end if;
  if target_status = 'delivered' and lower(coalesce(order_row.payment_method, 'cash_on_delivery')) = 'cash_on_delivery' then update public.orders set payment_status = 'paid', paid_at = coalesce(paid_at, now_time) where id = order_row.parent_order_id and payment_method = 'cash_on_delivery'; end if;
  insert into public.delivery_events (assignment_id, status, note, created_by) values (target_assignment_id, target_status, target_failure_reason, auth.uid());
  return true;
end;
$$;

grant execute on function public.update_delivery_assignment(uuid, text, numeric, text) to authenticated;

-- Delivery profiles and assignments need the linked address/order for the rider UI.
drop policy if exists "Riders can read assigned parent orders" on public.orders;
create policy "Riders can read assigned parent orders" on public.orders
  for select to authenticated using (exists (select 1 from public.delivery_assignments a join public.delivery_profiles p on p.id = a.rider_id join public.shop_orders so on so.id = a.shop_order_id where so.parent_order_id = orders.id and p.user_id = auth.uid()));
drop policy if exists "Riders can read assigned addresses" on public.addresses;
create policy "Riders can read assigned addresses" on public.addresses
  for select to authenticated using (exists (select 1 from public.orders o join public.delivery_assignments a on a.shop_order_id in (select id from public.shop_orders where parent_order_id = o.id) join public.delivery_profiles p on p.id = a.rider_id where o.shipping_address_id = addresses.id and p.user_id = auth.uid()));
drop policy if exists "Riders can read assigned customer profiles" on public.profiles;
create policy "Riders can read assigned customer profiles" on public.profiles
  for select to authenticated using (exists (select 1 from public.orders o join public.delivery_assignments a on a.shop_order_id in (select id from public.shop_orders where parent_order_id = o.id) join public.delivery_profiles p on p.id = a.rider_id where o.customer_id = profiles.id and p.user_id = auth.uid()));
