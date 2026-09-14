-- Allow shop staff to read only the line items belonging to their own shop orders.
alter table public.order_items enable row level security;

drop policy if exists "Shop staff can read shop order items" on public.order_items;
create policy "Shop staff can read shop order items"
  on public.order_items for select to authenticated
  using (
    exists (
      select 1
        from public.shop_orders so
        join public.shops s on s.id = so.shop_id
       where so.id = order_items.shop_order_id
         and (
           s.owner_id = auth.uid()
           or exists (
             select 1 from public.shop_members m
              where m.shop_id = s.id
                and m.user_id = auth.uid()
                and m.role in ('owner', 'manager')
           )
         )
    )
  );
