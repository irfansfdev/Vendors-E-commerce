-- Public buckets provide read access through the public URL. Do not add
-- SELECT policies on storage.objects because they expose file listings.

insert into storage.buckets (id, name, public)
values
  ('category-images', 'category-images', true),
  ('product-images', 'product-images', true),
  ('shop-assets', 'shop-assets', true)
on conflict (id) do update set public = true;

drop policy if exists "Public Access to category-images" on storage.objects;
drop policy if exists "Public Access to product-images" on storage.objects;
drop policy if exists "Public Access to shop-assets" on storage.objects;

drop policy if exists "Authenticated can upload category-images" on storage.objects;
drop policy if exists "Authenticated can update category-images" on storage.objects;
drop policy if exists "Authenticated can delete category-images" on storage.objects;
drop policy if exists "Authenticated can upload product-images" on storage.objects;
drop policy if exists "Authenticated can update product-images" on storage.objects;
drop policy if exists "Authenticated can delete product-images" on storage.objects;
drop policy if exists "Authenticated can upload shop-assets" on storage.objects;
drop policy if exists "Authenticated can update shop-assets" on storage.objects;
drop policy if exists "Authenticated can delete shop-assets" on storage.objects;

create policy "Authenticated can upload category-images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'category-images');
create policy "Authenticated can update category-images"
  on storage.objects for update to authenticated
  using (bucket_id = 'category-images')
  with check (bucket_id = 'category-images');
create policy "Authenticated can delete category-images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'category-images');

create policy "Authenticated can upload product-images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images');
create policy "Authenticated can update product-images"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');
create policy "Authenticated can delete product-images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images');

create policy "Authenticated can upload shop-assets"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'shop-assets');
create policy "Authenticated can update shop-assets"
  on storage.objects for update to authenticated
  using (bucket_id = 'shop-assets')
  with check (bucket_id = 'shop-assets');
create policy "Authenticated can delete shop-assets"
  on storage.objects for delete to authenticated
  using (bucket_id = 'shop-assets');
