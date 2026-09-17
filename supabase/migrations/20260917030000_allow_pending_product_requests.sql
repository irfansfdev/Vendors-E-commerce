-- Seller submissions are pending admin approval, so pending must be a valid product status.
alter table public.products drop constraint if exists products_status_check;
alter table public.products
  add constraint products_status_check
  check (status in ('pending', 'draft', 'published', 'archived'));
