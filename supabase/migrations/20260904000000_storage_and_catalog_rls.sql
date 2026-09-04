-- Enable public & authenticated access for catalog tables and storage buckets

-- 1. CATEGORIES TABLE
alter table public.categories enable row level security;

drop policy if exists "Anyone can read categories" on public.categories;
create policy "Anyone can read categories"
  on public.categories for select
  using (true);

drop policy if exists "Authenticated users can insert categories" on public.categories;
create policy "Authenticated users can insert categories"
  on public.categories for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update categories" on public.categories;
create policy "Authenticated users can update categories"
  on public.categories for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete categories" on public.categories;
create policy "Authenticated users can delete categories"
  on public.categories for delete
  to authenticated
  using (true);

-- 2. PRODUCTS TABLE
alter table public.products enable row level security;

drop policy if exists "Anyone can read products" on public.products;
create policy "Anyone can read products"
  on public.products for select
  using (true);

drop policy if exists "Authenticated users can insert products" on public.products;
create policy "Authenticated users can insert products"
  on public.products for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update products" on public.products;
create policy "Authenticated users can update products"
  on public.products for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete products" on public.products;
create policy "Authenticated users can delete products"
  on public.products for delete
  to authenticated
  using (true);

-- 3. PRODUCT_IMAGES TABLE
alter table public.product_images enable row level security;

drop policy if exists "Anyone can read product_images" on public.product_images;
create policy "Anyone can read product_images"
  on public.product_images for select
  using (true);

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

-- 4. PRODUCT_VARIANTS TABLE
alter table public.product_variants enable row level security;

drop policy if exists "Anyone can read product_variants" on public.product_variants;
create policy "Anyone can read product_variants"
  on public.product_variants for select
  using (true);

drop policy if exists "Authenticated users can manage product_variants" on public.product_variants;
create policy "Authenticated users can manage product_variants"
  on public.product_variants for all
  to authenticated
  using (true)
  with check (true);

-- 5. STORAGE BUCKETS (Make buckets public & add storage upload/read policies)
insert into storage.buckets (id, name, public)
values 
  ('category-images', 'category-images', true),
  ('product-images', 'product-images', true),
  ('shop-assets', 'shop-assets', true)
on conflict (id) do update set public = true;

drop policy if exists "Public Access to category-images" on storage.objects;
create policy "Public Access to category-images"
  on storage.objects for all
  using (bucket_id = 'category-images')
  with check (bucket_id = 'category-images');

drop policy if exists "Public Access to product-images" on storage.objects;
create policy "Public Access to product-images"
  on storage.objects for all
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

drop policy if exists "Public Access to shop-assets" on storage.objects;
create policy "Public Access to shop-assets"
  on storage.objects for all
  using (bucket_id = 'shop-assets')
  with check (bucket_id = 'shop-assets');
