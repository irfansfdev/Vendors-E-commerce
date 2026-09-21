alter table public.products
  add column if not exists featured_status text not null default 'not_requested'
    check (featured_status in ('not_requested', 'pending', 'approved', 'rejected')),
  add column if not exists featured_requested_at timestamptz,
  add column if not exists featured_reviewed_at timestamptz,
  add column if not exists featured_rejection_reason text;

update public.products
set featured_status = 'approved'
where is_featured = true and featured_status = 'not_requested';

create index if not exists products_featured_status_idx
  on public.products(featured_status, status, is_active);
