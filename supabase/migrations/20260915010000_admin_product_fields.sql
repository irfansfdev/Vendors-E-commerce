alter table public.products add column if not exists brand text;
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists is_active boolean not null default true;
alter table public.products add column if not exists is_featured boolean not null default false;
create unique index if not exists products_sku_unique on public.products (sku) where sku is not null and sku <> '';
alter table public.product_variants add column if not exists name text;
alter table public.product_images add column if not exists alt text;
alter table public.product_images add column if not exists is_primary boolean not null default false;