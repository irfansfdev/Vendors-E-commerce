-- Allow admins to read line items in the admin shop and order views.
drop policy if exists "Admins can read all order items" on public.order_items;
create policy "Admins can read all order items"
  on public.order_items for select to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

drop policy if exists "Admins can read all product variants" on public.product_variants;
create policy "Admins can read all product variants"
  on public.product_variants for select to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles for select to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

drop policy if exists "Admins can read all addresses" on public.addresses;
create policy "Admins can read all addresses"
  on public.addresses for select to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));
