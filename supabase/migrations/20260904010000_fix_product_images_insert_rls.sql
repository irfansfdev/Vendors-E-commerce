-- Ensure authenticated sellers can persist product gallery rows.
alter table public.product_images enable row level security;

drop policy if exists "Authenticated users can insert product_images" on public.product_images;
create policy "Authenticated users can insert product_images"
  on public.product_images for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update product_images" on public.product_images;
create policy "Authenticated users can update product_images"
  on public.product_images for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete product_images" on public.product_images;
create policy "Authenticated users can delete product_images"
  on public.product_images for delete
  to authenticated
  using (true);
