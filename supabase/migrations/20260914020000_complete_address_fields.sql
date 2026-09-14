alter table public.addresses
  add column if not exists label text,
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text;

update public.addresses
set address_line1 = coalesce(address_line1, '')
where address_line1 is null;