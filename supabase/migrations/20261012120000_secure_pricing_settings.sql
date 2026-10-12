alter table public.app_settings enable row level security;

revoke all on public.app_settings from anon, authenticated;
grant select, insert, update, delete on public.app_settings to authenticated;

drop policy if exists app_settings_admin_all on public.app_settings;
create policy app_settings_admin_all on public.app_settings
  for all to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

drop policy if exists app_settings_access_restrictive on public.app_settings;
create policy app_settings_access_restrictive on public.app_settings
  as restrictive
  for all to anon, authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

create or replace function public.enforce_shop_coupon_percent_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  maximum_percent numeric(14, 2);
begin
  if new.scope = 'shop' and lower(new.discount_type) in ('percentage', 'percent') then
    select (s.value #>> '{}')::numeric
      into maximum_percent
    from public.app_settings s
    where s.key = 'pricing.shop_coupon_max_percent';
    maximum_percent := coalesce(maximum_percent, 50::numeric);
    if new.discount_value > maximum_percent then
      raise exception 'Shop percentage coupons cannot exceed % percent', maximum_percent;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists coupons_enforce_shop_percent_limit on public.coupons;
create trigger coupons_enforce_shop_percent_limit
before insert or update of scope, discount_type, discount_value on public.coupons
for each row execute function public.enforce_shop_coupon_percent_limit();

revoke all on function public.enforce_shop_coupon_percent_limit() from public;

update public.coupons c
   set discount_value = coalesce(
     (select (s.value #>> '{}')::numeric from public.app_settings s where s.key = 'pricing.shop_coupon_max_percent'),
     50::numeric
   )
 where c.scope = 'shop'
   and lower(c.discount_type) in ('percentage', 'percent')
   and c.discount_value > coalesce(
     (select (s.value #>> '{}')::numeric from public.app_settings s where s.key = 'pricing.shop_coupon_max_percent'),
     50::numeric
   );
