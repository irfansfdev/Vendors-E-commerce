-- Make delivery completion independent of a missing shop_earnings unique constraint.
-- Some existing databases do not have a unique constraint on shop_earnings.shop_order_id,
-- so ON CONFLICT (shop_order_id) fails when a rider marks delivery complete.
create or replace function public.sync_shop_earning(target_shop_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  row_shop_order public.shop_orders%rowtype;
  row_shop public.shops%rowtype;
  earning_status text;
  available_time timestamptz;
  existing_earning_id uuid;
begin
  select * into row_shop_order from public.shop_orders where id = target_shop_order_id;
  if not found then return; end if;
  select * into row_shop from public.shops where id = row_shop_order.shop_id;
  earning_status := case
    when lower(coalesce(row_shop_order.order_status, 'pending')) in ('cancelled', 'returned', 'refunded') then 'cancelled'
    when lower(coalesce(row_shop_order.payout_status, 'not_eligible')) = 'available' then 'available'
    when lower(coalesce(row_shop_order.payout_status, 'not_eligible')) = 'paid' then 'paid'
    when lower(coalesce(row_shop_order.order_status, 'pending')) in ('delivered', 'completed') then 'pending'
    else 'pending'
  end;
  available_time := row_shop_order.delivered_at + make_interval(days => greatest(coalesce(row_shop.payout_hold_days, 7), 0));

  select id into existing_earning_id from public.shop_earnings where shop_order_id = row_shop_order.id order by created_at asc limit 1;
  if existing_earning_id is not null then
    update public.shop_earnings set
      gross_amount = coalesce(row_shop_order.gross_amount, 0),
      commission_rate = coalesce(row_shop_order.commission_rate, 0),
      commission_amount = coalesce(row_shop_order.platform_commission, 0),
      refund_amount = coalesce(row_shop_order.refund_amount, 0),
      net_amount = greatest(0, coalesce(row_shop_order.seller_earnings, 0) - coalesce(row_shop_order.refund_amount, 0)),
      status = case when status = 'paid' and earning_status <> 'cancelled' then 'paid' else earning_status end,
      available_at = case when row_shop_order.delivered_at is not null then available_time end,
      updated_at = now()
    where id = existing_earning_id;
  else
    insert into public.shop_earnings (shop_id, shop_order_id, gross_amount, commission_rate, commission_amount, refund_amount, net_amount, status, available_at, paid_at)
    values (row_shop_order.shop_id, row_shop_order.id, coalesce(row_shop_order.gross_amount, 0), coalesce(row_shop_order.commission_rate, 0), coalesce(row_shop_order.platform_commission, 0), coalesce(row_shop_order.refund_amount, 0), greatest(0, coalesce(row_shop_order.seller_earnings, 0) - coalesce(row_shop_order.refund_amount, 0)), earning_status, case when row_shop_order.delivered_at is not null then available_time end, case when earning_status = 'paid' then coalesce(row_shop_order.delivered_at, now()) end);
  end if;
end;
$$;

grant execute on function public.sync_shop_earning(uuid) to authenticated;
