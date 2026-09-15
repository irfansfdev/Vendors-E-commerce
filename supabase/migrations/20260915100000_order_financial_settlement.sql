-- Keep fulfillment, payment, settlement, and refund amounts separate.
alter table public.orders
  add column if not exists delivered_at timestamptz,
  add column if not exists gross_amount numeric(14, 2) not null default 0,
  add column if not exists platform_commission numeric(14, 2) not null default 0,
  add column if not exists seller_earnings numeric(14, 2) not null default 0,
  add column if not exists refund_amount numeric(14, 2) not null default 0;

alter table public.shop_orders
  add column if not exists delivered_at timestamptz,
  add column if not exists gross_amount numeric(14, 2) not null default 0,
  add column if not exists platform_commission numeric(14, 2) not null default 0,
  add column if not exists seller_earnings numeric(14, 2) not null default 0,
  add column if not exists refund_amount numeric(14, 2) not null default 0,
  add column if not exists payout_status text not null default 'not_eligible';

alter table public.shops
  add column if not exists commission_rate numeric(5, 2) not null default 10,
  add column if not exists payout_hold_days integer not null default 7;

alter table public.return_requests
  add column if not exists refund_amount numeric(14, 2) not null default 0,
  add column if not exists decided_at timestamptz;

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  source_shop_order_id uuid,
  gross_amount numeric(14, 2) not null default 0,
  commission_amount numeric(14, 2) not null default 0,
  amount numeric(14, 2) not null default 0,
  net_amount numeric(14, 2) not null default 0,
  refund_amount numeric(14, 2) not null default 0,
  status text not null default 'pending',
  available_at timestamptz,
  requested_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.payouts
  add column if not exists source_shop_order_id uuid,
  add column if not exists gross_amount numeric(14, 2) not null default 0,
  add column if not exists commission_amount numeric(14, 2) not null default 0,
  add column if not exists net_amount numeric(14, 2) not null default 0,
  add column if not exists refund_amount numeric(14, 2) not null default 0,
  add column if not exists available_at timestamptz,
  add column if not exists requested_at timestamptz,
  add column if not exists paid_at timestamptz;

create unique index if not exists payouts_one_order_settlement
  on public.payouts(source_shop_order_id)
  where source_shop_order_id is not null;

create or replace function public.calculate_shop_order_gross(target_shop_order_id uuid)
returns numeric
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(sum(
    coalesce((to_jsonb(oi)->>'quantity')::numeric, 0)
    * coalesce(pv.price, p.price, 0)
  ), 0)::numeric
    from public.order_items oi
    left join public.product_variants pv
      on pv.id = coalesce((to_jsonb(oi)->>'variant_id')::uuid, (to_jsonb(oi)->>'product_variant_id')::uuid)
    left join public.products p on p.id = pv.product_id
   where oi.shop_order_id = target_shop_order_id;
$$;

-- Existing rows are backfilled from their current order values once, without
-- changing payment status or treating an unpaid order as a sale.
update public.shop_orders so
   set gross_amount = coalesce(nullif(so.gross_amount, 0), coalesce((to_jsonb(so)->>'total_amount')::numeric, (to_jsonb(so)->>'subtotal')::numeric, (to_jsonb(so)->>'total')::numeric, (to_jsonb(so)->>'amount')::numeric, (to_jsonb(so)->>'order_total')::numeric, (to_jsonb(so)->>'grand_total')::numeric, (to_jsonb(so)->>'total_price')::numeric, public.calculate_shop_order_gross(so.id), 0)),
     seller_earnings = coalesce(nullif(so.seller_earnings, 0), coalesce((to_jsonb(so)->>'total_amount')::numeric, (to_jsonb(so)->>'subtotal')::numeric, (to_jsonb(so)->>'total')::numeric, (to_jsonb(so)->>'amount')::numeric, (to_jsonb(so)->>'order_total')::numeric, (to_jsonb(so)->>'grand_total')::numeric, (to_jsonb(so)->>'total_price')::numeric, public.calculate_shop_order_gross(so.id), 0)),
       payout_status = case when lower(coalesce(so.order_status, 'pending')) in ('delivered', 'completed') then 'pending' else so.payout_status end
 where lower(coalesce(so.order_status, 'pending')) in ('delivered', 'completed');

create or replace function public.apply_shop_order_financials()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gross numeric(14, 2);
  rate numeric(5, 2);
  commission numeric(14, 2);
  seller_amount numeric(14, 2);
  hold_days integer;
  payment_state text;
begin
  if lower(coalesce(new.order_status, 'pending')) in ('delivered', 'completed') then
    new.delivered_at := coalesce(new.delivered_at, now());
    gross := greatest(0, coalesce((to_jsonb(new)->>'total_amount')::numeric, (to_jsonb(new)->>'subtotal')::numeric, (to_jsonb(new)->>'total')::numeric, (to_jsonb(new)->>'amount')::numeric, (to_jsonb(new)->>'order_total')::numeric, (to_jsonb(new)->>'grand_total')::numeric, (to_jsonb(new)->>'total_price')::numeric, public.calculate_shop_order_gross(new.id), 0));

    select coalesce(s.commission_rate, 10), greatest(coalesce(s.payout_hold_days, 7), 0)
      into rate, hold_days
      from public.shops s
     where s.id = new.shop_id;
    select lower(coalesce(o.payment_status, 'pending'))
      into payment_state
      from public.orders o
     where o.id = new.parent_order_id;

    commission := round(gross * rate / 100, 2);
    seller_amount := greatest(0, gross - commission - coalesce(new.refund_amount, 0));
    new.gross_amount := gross;
    new.platform_commission := commission;
    new.seller_earnings := seller_amount;
    new.payout_status := case
      when payment_state not in ('paid', 'partially_refunded') then 'not_eligible'
      when new.delivered_at + make_interval(days => hold_days) <= now() then 'available'
      else 'pending'
    end;
  elsif lower(coalesce(new.order_status, 'pending')) in ('cancelled', 'pending', 'processing', 'shipped') then
    new.payout_status := case when lower(coalesce(new.order_status, 'pending')) = 'cancelled' then 'cancelled' else coalesce(new.payout_status, 'not_eligible') end;
  end if;
  return new;
end;
$$;

drop trigger if exists shop_order_financials_before_update on public.shop_orders;
create trigger shop_order_financials_before_update
before insert or update
on public.shop_orders
for each row execute function public.apply_shop_order_financials();

create or replace function public.refresh_parent_order_financials()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders o
     set delivered_at = case
           when exists (select 1 from public.shop_orders so where so.parent_order_id = new.parent_order_id and lower(so.order_status) in ('delivered', 'completed'))
           then coalesce(o.delivered_at, now()) else o.delivered_at end,
         gross_amount = coalesce((select sum(so.gross_amount) from public.shop_orders so where so.parent_order_id = new.parent_order_id), 0),
         platform_commission = coalesce((select sum(so.platform_commission) from public.shop_orders so where so.parent_order_id = new.parent_order_id), 0),
         seller_earnings = coalesce((select sum(so.seller_earnings) from public.shop_orders so where so.parent_order_id = new.parent_order_id), 0),
         refund_amount = coalesce((select sum(so.refund_amount) from public.shop_orders so where so.parent_order_id = new.parent_order_id), 0)
   where o.id = new.parent_order_id;
  return new;
end;
$$;

drop trigger if exists shop_order_financials_after_update on public.shop_orders;
create trigger shop_order_financials_after_update
after insert or update
on public.shop_orders
for each row execute function public.refresh_parent_order_financials();

create or replace function public.create_shop_order_payout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.order_status, 'pending')) in ('delivered', 'completed')
     and exists (
       select 1 from public.orders o
        where o.id = new.parent_order_id
          and lower(coalesce(o.payment_status, 'pending')) in ('paid', 'partially_refunded')
     ) then
    insert into public.payouts (
      shop_id, source_shop_order_id, gross_amount, commission_amount, amount,
      net_amount, refund_amount, status, available_at
    ) values (
      new.shop_id, new.id, new.gross_amount, new.platform_commission,
      new.seller_earnings, new.seller_earnings, new.refund_amount,
      new.payout_status, new.delivered_at + make_interval(days => greatest((select s.payout_hold_days from public.shops s where s.id = new.shop_id), 7))
    )
    on conflict (source_shop_order_id) do update set
      gross_amount = excluded.gross_amount,
      commission_amount = excluded.commission_amount,
      amount = excluded.amount,
      net_amount = excluded.net_amount,
      refund_amount = excluded.refund_amount,
      available_at = excluded.available_at,
      status = case when public.payouts.status in ('paid', 'requested') then public.payouts.status else excluded.status end;
  end if;
  return new;
end;
$$;

drop trigger if exists shop_order_payout_after_update on public.shop_orders;
create trigger shop_order_payout_after_update
after insert or update
on public.shop_orders
for each row execute function public.create_shop_order_payout();

create or replace function public.refresh_order_settlement_after_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.shop_orders
     set order_status = order_status
   where parent_order_id = new.id
     and lower(coalesce(order_status, 'pending')) in ('delivered', 'completed');
  return new;
end;
$$;

drop trigger if exists orders_payment_settlement_refresh on public.orders;
create trigger orders_payment_settlement_refresh
after update of payment_status on public.orders
for each row
when (old.payment_status is distinct from new.payment_status)
execute function public.refresh_order_settlement_after_payment();

-- A refunded return reduces the same settlement row; repeated updates are
-- harmless because all values are derived from the current order state.
create or replace function public.apply_return_financials()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_shop_order uuid;
begin
  if lower(coalesce(new.status, 'requested')) = 'refunded'
     and lower(coalesce(old.status, 'requested')) <> 'refunded' then
    target_shop_order := new.shop_order_id;
    if target_shop_order is not null then
      update public.shop_orders
         set refund_amount = greatest(0, coalesce(new.refund_amount, gross_amount)),
             payout_status = case when payout_status in ('paid', 'requested') then payout_status else 'cancelled' end
       where id = target_shop_order;
    else
      update public.orders
         set refund_amount = greatest(0, coalesce(new.refund_amount, gross_amount)),
             payment_status = 'refunded',
             refunded_at = coalesce(refunded_at, now())
       where id = new.order_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists return_financials_after_update on public.return_requests;
create trigger return_financials_after_update
after update of status, refund_amount on public.return_requests
for each row execute function public.apply_return_financials();

create or replace function public.refresh_payout_availability()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  update public.payouts
     set status = 'available'
   where status = 'pending'
     and available_at is not null
     and available_at <= now();
  get diagnostics changed = row_count;
  return changed;
end;
$$;

grant execute on function public.refresh_payout_availability() to authenticated;

create or replace function public.request_payout(payout_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  payout_shop_id uuid;
begin
  select shop_id into payout_shop_id from public.payouts where id = payout_id;
  if payout_shop_id is null or not public.is_shop_staff_for_shop(payout_shop_id) then
    return false;
  end if;
  update public.payouts
     set status = 'requested', requested_at = coalesce(requested_at, now())
   where id = payout_id and status = 'available';
  return found;
end;
$$;

grant execute on function public.request_payout(uuid) to authenticated;

create or replace function public.can_review_product(target_user_id uuid, target_product_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.orders o
      join public.shop_orders so on so.parent_order_id = o.id
      join public.order_items oi on oi.shop_order_id = so.id
      join public.product_variants pv on pv.id = coalesce(
        (to_jsonb(oi)->>'product_variant_id')::uuid,
        (to_jsonb(oi)->>'variant_id')::uuid
      )
     where o.customer_id = target_user_id
      and lower(coalesce(so.order_status, (to_jsonb(o)->>'status'), (to_jsonb(o)->>'order_status'), 'pending')) in ('delivered', 'completed')
       and pv.product_id = target_product_id
  );
$$;

grant execute on function public.can_review_product(uuid, uuid) to authenticated;

-- Re-run the derived event for pre-existing delivered rows. Unique payout
-- settlement keys make this safe if the migration is applied again.
update public.shop_orders
   set order_status = order_status
 where lower(coalesce(order_status, 'pending')) in ('delivered', 'completed');