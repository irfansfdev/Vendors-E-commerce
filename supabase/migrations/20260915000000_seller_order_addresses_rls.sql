-- Use security-definer checks so RLS policies do not recursively query
-- another RLS-protected order relation.
create or replace function public.is_shop_staff_for_shop(target_shop_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.shops s
     where s.id = target_shop_id
       and (
         s.owner_id = auth.uid()
         or exists (
           select 1 from public.shop_members m
            where m.shop_id = s.id
              and m.user_id = auth.uid()
              and m.role in ('owner', 'manager')
         )
       )
  );
$$;

create or replace function public.is_shop_staff_for_parent_order(target_order_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.shop_orders so
     where so.parent_order_id = target_order_id
       and public.is_shop_staff_for_shop(so.shop_id)
  );
$$;

create or replace function public.is_shop_staff_for_address(target_address_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.orders o
     where o.shipping_address_id = target_address_id
       and public.is_shop_staff_for_parent_order(o.id)
  );
$$;

create or replace function public.is_shop_staff_for_customer(target_customer_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.orders o
     where o.customer_id = target_customer_id
       and public.is_shop_staff_for_parent_order(o.id)
  );
$$;

-- Sellers must be able to read and update their own shop orders.
alter table public.shop_orders enable row level security;

drop policy if exists "Shop staff can read shop orders" on public.shop_orders;
create policy "Shop staff can read shop orders"
  on public.shop_orders for select to authenticated
  using (public.is_shop_staff_for_shop(shop_id));

drop policy if exists "Shop staff can update shop orders" on public.shop_orders;
create policy "Shop staff can update shop orders"
  on public.shop_orders for update to authenticated
  using (public.is_shop_staff_for_shop(shop_id))
  with check (public.is_shop_staff_for_shop(shop_id));

drop policy if exists "Admins can read all shop orders" on public.shop_orders;
create policy "Admins can read all shop orders"
  on public.shop_orders for select to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

drop policy if exists "Admins can update all shop orders" on public.shop_orders;
create policy "Admins can update all shop orders"
  on public.shop_orders for update to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

-- Allow shop staff to read only addresses attached to their own orders.
alter table public.addresses enable row level security;

drop policy if exists "Shop staff can read linked shipping addresses" on public.addresses;
create policy "Shop staff can read linked shipping addresses"
  on public.addresses for select to authenticated
  using (public.is_shop_staff_for_address(id));

-- Seller order details also need the parent order and customer profile.
alter table public.orders enable row level security;

drop policy if exists "Shop staff can read parent orders" on public.orders;
create policy "Shop staff can read parent orders"
  on public.orders for select to authenticated
  using (public.is_shop_staff_for_parent_order(id));

alter table public.profiles enable row level security;

drop policy if exists "Shop staff can read order customer profiles" on public.profiles;
create policy "Shop staff can read order customer profiles"
  on public.profiles for select to authenticated
  using (public.is_shop_staff_for_customer(id));

-- Keep admin status updates compatible with RLS, even when the action is server-side.
drop policy if exists "Admins can read all orders" on public.orders;
create policy "Admins can read all orders"
  on public.orders for select to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

drop policy if exists "Admins can update all orders" on public.orders;
create policy "Admins can update all orders"
  on public.orders for update to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));
