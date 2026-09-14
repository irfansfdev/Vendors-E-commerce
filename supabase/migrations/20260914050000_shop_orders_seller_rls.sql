-- Sellers must be able to see and update the shop orders created for their shop.
alter table public.shop_orders enable row level security;

drop policy if exists "Shop staff can read shop orders" on public.shop_orders;
create policy "Shop staff can read shop orders"
  on public.shop_orders for select to authenticated
  using (
    exists (
      select 1
        from public.shops s
       where s.id = shop_orders.shop_id
         and (
           s.owner_id = auth.uid()
           or exists (
             select 1
               from public.shop_members m
              where m.shop_id = s.id
                and m.user_id = auth.uid()
                and m.role in ('owner', 'manager')
           )
         )
    )
  );

drop policy if exists "Shop staff can update shop orders" on public.shop_orders;
create policy "Shop staff can update shop orders"
  on public.shop_orders for update to authenticated
  using (
    exists (
      select 1
        from public.shops s
       where s.id = shop_orders.shop_id
         and (
           s.owner_id = auth.uid()
           or exists (
             select 1
               from public.shop_members m
              where m.shop_id = s.id
                and m.user_id = auth.uid()
                and m.role in ('owner', 'manager')
           )
         )
    )
  )
  with check (
    exists (
      select 1
        from public.shops s
       where s.id = shop_orders.shop_id
         and (
           s.owner_id = auth.uid()
           or exists (
             select 1
               from public.shop_members m
              where m.shop_id = s.id
                and m.user_id = auth.uid()
                and m.role in ('owner', 'manager')
           )
         )
    )
  );
