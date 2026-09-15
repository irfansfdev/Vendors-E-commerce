alter table public.shops
  add column if not exists owner_name text;

update public.shops
  set owner_name = null
 where owner_name is null or owner_name = '';

update public.shops s
  set owner_name = coalesce(nullif(p.full_name, ''), s.owner_name)
  from public.profiles p
 where p.id = s.owner_id
  and (s.owner_name is null or s.owner_name = '');
