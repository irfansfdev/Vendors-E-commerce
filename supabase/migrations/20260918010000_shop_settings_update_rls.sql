-- Allow shop owners and managers to update public shop settings.
drop policy if exists "Shop staff can update shop settings" on public.shops;
create policy "Shop staff can update shop settings"
  on public.shops
  for update
  to authenticated
  using (public.is_shop_staff_for_shop(id))
  with check (public.is_shop_staff_for_shop(id));