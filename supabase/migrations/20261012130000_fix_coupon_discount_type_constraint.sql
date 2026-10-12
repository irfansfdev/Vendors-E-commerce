alter table public.coupons
  drop constraint if exists coupons_discount_type_check;

alter table public.coupons
  add constraint coupons_discount_type_check
  check (discount_type in ('percentage', 'percent', 'fixed', 'free_delivery'));
