-- Break the delivery RLS cycle between shop_orders and delivery_assignments.
-- These helpers read the relationship under definer privileges, so policies do
-- not recursively evaluate each other.
create or replace function public.can_manage_delivery_for_order(target_shop_order_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
      or exists (
        select 1
          from public.shop_orders so
         where so.id = target_shop_order_id
           and public.is_shop_staff_for_shop(so.shop_id)
      );
$$;

grant execute on function public.can_manage_delivery_for_order(uuid) to authenticated;

create or replace function public.is_rider_assigned_to_shop_order(target_shop_order_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.delivery_assignments da
      join public.delivery_profiles dp on dp.id = da.rider_id
     where da.shop_order_id = target_shop_order_id
       and dp.user_id = auth.uid()
       and dp.status = 'approved'
  );
$$;

grant execute on function public.is_rider_assigned_to_shop_order(uuid) to authenticated;

drop policy if exists "Shop staff can manage delivery assignments" on public.delivery_assignments;
create policy "Shop staff can manage delivery assignments" on public.delivery_assignments
  for all to authenticated
  using (public.can_manage_delivery_for_order(shop_order_id))
  with check (public.can_manage_delivery_for_order(shop_order_id));

drop policy if exists "Riders can read assigned shop orders" on public.shop_orders;
create policy "Riders can read assigned shop orders" on public.shop_orders
  for select to authenticated
  using (public.is_rider_assigned_to_shop_order(id));

drop policy if exists "Riders can read assigned parent orders" on public.orders;
create policy "Riders can read assigned parent orders" on public.orders
  for select to authenticated
  using (exists (
    select 1 from public.shop_orders so
     where so.parent_order_id = orders.id
       and public.is_rider_assigned_to_shop_order(so.id)
  ));

drop policy if exists "Riders can read assigned addresses" on public.addresses;
create policy "Riders can read assigned addresses" on public.addresses
  for select to authenticated
  using (exists (
    select 1
      from public.orders o
     where o.shipping_address_id = addresses.id
       and exists (
         select 1 from public.shop_orders so
          where so.parent_order_id = o.id
            and public.is_rider_assigned_to_shop_order(so.id)
       )
  ));

drop policy if exists "Riders can read assigned customer profiles" on public.profiles;
create policy "Riders can read assigned customer profiles" on public.profiles
  for select to authenticated
  using (exists (
    select 1
      from public.orders o
     where o.customer_id = profiles.id
       and exists (
         select 1 from public.shop_orders so
          where so.parent_order_id = o.id
            and public.is_rider_assigned_to_shop_order(so.id)
       )
  ));
