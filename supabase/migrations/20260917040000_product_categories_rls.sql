-- Allow shop staff to maintain product/category links while preserving catalog ownership.
alter table public.product_categories enable row level security;

drop policy if exists "Anyone can read product categories" on public.product_categories;
create policy "Anyone can read product categories"
  on public.product_categories for select
  using (
    exists (
      select 1
      from public.products p
      join public.shops s on s.id = p.shop_id
      where p.id = product_categories.product_id
        and s.status = 'active'
    )
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  );

drop policy if exists "Shop staff can insert product categories" on public.product_categories;
create policy "Shop staff can insert product categories"
  on public.product_categories for insert to authenticated
  with check (
    exists (
      select 1
      from public.products p
      join public.shops s on s.id = p.shop_id
      where p.id = product_categories.product_id
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
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  );

drop policy if exists "Shop staff can delete product categories" on public.product_categories;
create policy "Shop staff can delete product categories"
  on public.product_categories for delete to authenticated
  using (
    exists (
      select 1
      from public.products p
      join public.shops s on s.id = p.shop_id
      where p.id = product_categories.product_id
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
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  );
