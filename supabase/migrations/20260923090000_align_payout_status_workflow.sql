-- Align payout status values with the existing admin workflow: approved -> paid.
alter table public.payouts drop constraint if exists payouts_status_check;
alter table public.payouts add constraint payouts_status_check
  check (status in ('pending', 'approved', 'requested', 'available', 'paid', 'cancelled', 'processing', 'failed', 'refunded'));

create or replace function public.create_shop_order_payout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_payout_id uuid;
  payout_state text;
begin
  payout_state := case lower(coalesce(new.payout_status, 'approved'))
    when 'paid' then 'paid'
    when 'requested' then 'requested'
    when 'cancelled' then 'cancelled'
    when 'available' then 'approved'
    when 'pending' then 'approved'
    when 'held' then 'approved'
    when 'not_eligible' then 'approved'
    else 'approved'
  end;

  if lower(coalesce(new.order_status, 'pending')) in ('delivered', 'completed')
     and exists (select 1 from public.orders o where o.id = new.parent_order_id and lower(coalesce(o.payment_status, 'pending')) in ('paid', 'partially_refunded')) then
    select id into existing_payout_id from public.payouts where source_shop_order_id = new.id order by created_at asc limit 1;
    if existing_payout_id is not null then
      update public.payouts set
        gross_amount = new.gross_amount,
        commission_amount = new.platform_commission,
        platform_fee = new.platform_commission,
        amount = new.seller_earnings,
        net_amount = new.seller_earnings,
        refund_amount = new.refund_amount,
        available_at = new.delivered_at + make_interval(days => greatest((select s.payout_hold_days from public.shops s where s.id = new.shop_id), 7)),
        status = case when status in ('paid', 'requested') then status else payout_state end
      where id = existing_payout_id;
    else
      insert into public.payouts (shop_id, source_shop_order_id, gross_amount, commission_amount, platform_fee, amount, net_amount, refund_amount, status, available_at)
      values (new.shop_id, new.id, new.gross_amount, new.platform_commission, new.platform_commission, new.seller_earnings, new.seller_earnings, new.refund_amount, payout_state, new.delivered_at + make_interval(days => greatest((select s.payout_hold_days from public.shops s where s.id = new.shop_id), 7)));
    end if;
  end if;
  return new;
end;
$$;

grant execute on function public.create_shop_order_payout() to authenticated;
