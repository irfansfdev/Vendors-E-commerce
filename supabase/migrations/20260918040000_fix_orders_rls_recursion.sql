-- The orders policies must not query shop_orders through normal RLS.
-- That creates a second cycle: orders -> shop_orders -> orders.
create or replace function public.is_rider_assigned_to_parent_order(target_parent_order_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.shop_orders so
      join public.delivery_assignments da on da.shop_order_id = so.id
      join public.delivery_profiles dp on dp.id = da.rider_id
     where so.parent_order_id = target_parent_order_id
       and dp.user_id = auth.uid()
       and dp.status = 'approved'
  );
$$;

grant execute on function public.is_rider_assigned_to_parent_order(uuid) to authenticated;

drop policy if exists "Riders can read assigned parent orders" on public.orders;
create policy "Riders can read assigned parent orders" on public.orders
  for select to authenticated
  using (public.is_rider_assigned_to_parent_order(id));

drop policy if exists "Riders can read assigned addresses" on public.addresses;
create policy "Riders can read assigned addresses" on public.addresses
  for select to authenticated
  using (exists (
    select 1 from public.orders o
     where o.shipping_address_id = addresses.id
       and public.is_rider_assigned_to_parent_order(o.id)
  ));

drop policy if exists "Riders can read assigned customer profiles" on public.profiles;
create policy "Riders can read assigned customer profiles" on public.profiles
  for select to authenticated
  using (exists (
    select 1 from public.orders o
     where o.customer_id = profiles.id
       and public.is_rider_assigned_to_parent_order(o.id)
  ));
