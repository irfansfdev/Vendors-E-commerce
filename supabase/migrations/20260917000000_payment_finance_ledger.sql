-- Additive payment, COD, earnings, refund and payout ledger foundation.
-- All provider confirmation must call the security-definer verification functions below.

alter table public.orders
  add column if not exists order_status text not null default 'pending',
  add column if not exists payment_method text not null default 'cash_on_delivery',
  add column if not exists payment_provider text not null default 'cod',
  add column if not exists payment_currency text not null default 'PKR';

alter table public.shop_orders
  add column if not exists payment_method text not null default 'cash_on_delivery',
  add column if not exists payment_provider text not null default 'cod',
  add column if not exists cod_collection_status text not null default 'expected',
  add column if not exists cod_collected_amount numeric(14,2) not null default 0,
  add column if not exists cod_collected_at timestamptz;

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('pending', 'processing', 'paid', 'failed', 'cancelled', 'partially_refunded', 'refunded'));

create or replace function public.normalize_order_payment_method()
returns trigger
language plpgsql
as $$
declare
  raw_method text := lower(trim(coalesce(new.payment_method, '')));
  raw_provider text := lower(trim(coalesce(new.payment_provider, '')));
begin
  if raw_method in ('cod', 'cash', 'cash_on_delivery', 'cash on delivery') then
    new.payment_method := 'cash_on_delivery';
    new.payment_provider := 'cod';
  else
    new.payment_method := 'online';
    new.payment_provider := case
      when raw_provider in ('card', 'jazzcash', 'easypaisa', 'raast') then raw_provider
      when raw_method in ('jazzcash', 'easypaisa', 'raast') then raw_method
      else 'card'
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_order_payment_method_before_write on public.orders;
create trigger normalize_order_payment_method_before_write
before insert or update of payment_method, payment_provider on public.orders
for each row execute function public.normalize_order_payment_method();

-- Existing deployments may contain legacy values such as `cod`, `cash`, or
-- `card`. Normalize them before enforcing the new canonical values.
update public.orders
   set payment_method = case
     when lower(trim(coalesce(payment_method, ''))) in ('cod', 'cash', 'cash_on_delivery', 'cash on delivery') then 'cash_on_delivery'
     when lower(trim(coalesce(payment_method, ''))) in ('online', 'card', 'credit_card', 'debit_card', 'jazzcash', 'easypaisa', 'raast') then 'online'
     else 'cash_on_delivery'
   end,
   payment_provider = case
     when lower(trim(coalesce(payment_method, ''))) in ('cod', 'cash', 'cash_on_delivery', 'cash on delivery') then 'cod'
     when lower(trim(coalesce(payment_provider, ''))) in ('jazzcash', 'easypaisa', 'raast', 'card') then lower(trim(payment_provider))
     else 'card'
   end
 where payment_method is null
    or lower(trim(payment_method)) not in ('cash_on_delivery', 'online');

do $$
begin
  alter table public.orders add constraint orders_payment_method_check
    check (payment_method in ('cash_on_delivery', 'online'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.shop_orders add constraint shop_orders_cod_collection_status_check
    check (cod_collection_status in ('expected', 'collected', 'settlement_pending', 'settled'));
exception when duplicate_object then null;
end $$;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  payment_method text not null check (payment_method in ('cash_on_delivery', 'online')),
  payment_provider text not null,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'PKR',
  status text not null default 'pending' check (status in ('pending', 'processing', 'paid', 'failed', 'cancelled', 'partially_refunded', 'refunded')),
  provider_transaction_id text,
  provider_reference text,
  provider_metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, payment_provider, provider_transaction_id)
);

create index if not exists payments_order_idx on public.payments(order_id, created_at desc);
create index if not exists payments_status_idx on public.payments(status, created_at desc);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  order_id uuid not null,
  type text not null check (type in ('payment', 'capture', 'refund', 'partial_refund', 'void', 'adjustment')),
  amount numeric(14,2) not null check (amount >= 0),
  status text not null check (status in ('pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded')),
  provider text not null,
  provider_reference text,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payment_transactions_order_idx on public.payment_transactions(order_id, created_at desc);

create table if not exists public.shop_earnings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  shop_order_id uuid not null unique,
  gross_amount numeric(14,2) not null default 0,
  commission_rate numeric(5,2) not null default 0,
  commission_amount numeric(14,2) not null default 0,
  refund_amount numeric(14,2) not null default 0,
  adjustment_amount numeric(14,2) not null default 0,
  net_amount numeric(14,2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'held', 'available', 'paid', 'cancelled')),
  available_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shop_earnings_shop_status_idx on public.shop_earnings(shop_id, status, created_at desc);

create table if not exists public.earning_payout_items (
  payout_id uuid not null references public.payouts(id) on delete restrict,
  earning_id uuid not null references public.shop_earnings(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  primary key (payout_id, earning_id)
);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  shop_order_id uuid,
  payment_id uuid references public.payments(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'paid', 'failed', 'cancelled')),
  provider_reference text,
  requested_by uuid references auth.users(id),
  processed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists refunds_order_idx on public.refunds(order_id, created_at desc);
create index if not exists refunds_shop_order_idx on public.refunds(shop_order_id, created_at desc);

-- Keep the existing payout table compatible while adding explicit workflow states.
alter table public.payouts add column if not exists approved_at timestamptz;
alter table public.payouts add column if not exists approved_amount numeric(14,2);
alter table public.payouts add column if not exists transaction_reference text;
alter table public.payouts add column if not exists rejection_reason text;

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
  insert into public.shop_earnings (shop_id, shop_order_id, gross_amount, commission_rate, commission_amount, refund_amount, net_amount, status, available_at, paid_at)
  values (row_shop_order.shop_id, row_shop_order.id, coalesce(row_shop_order.gross_amount, 0), coalesce(row_shop.commission_rate, 0), coalesce(row_shop_order.platform_commission, 0), coalesce(row_shop_order.refund_amount, 0), greatest(0, coalesce(row_shop_order.seller_earnings, 0) - coalesce(row_shop_order.refund_amount, 0)), earning_status, case when row_shop_order.delivered_at is not null then available_time end, case when earning_status = 'paid' then coalesce(row_shop_order.delivered_at, now()) end)
  on conflict (shop_order_id) do update set
    gross_amount = excluded.gross_amount,
    commission_rate = excluded.commission_rate,
    commission_amount = excluded.commission_amount,
    refund_amount = excluded.refund_amount,
    net_amount = excluded.net_amount,
    status = case when public.shop_earnings.status = 'paid' and excluded.status <> 'cancelled' then 'paid' else excluded.status end,
    available_at = excluded.available_at,
    updated_at = now();
end;
$$;

create or replace function public.sync_shop_earning_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_shop_earning(new.id);
  return new;
end;
$$;

drop trigger if exists shop_earning_sync_after_shop_order on public.shop_orders;
create trigger shop_earning_sync_after_shop_order
after insert or update of order_status, payout_status, gross_amount, platform_commission, seller_earnings, refund_amount, delivered_at
on public.shop_orders
for each row execute function public.sync_shop_earning_trigger();

create or replace function public.confirm_cod_collection(target_shop_order_id uuid, collected_amount numeric)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_shop uuid;
  parent_id uuid;
  expected_amount numeric;
begin
  select shop_id, parent_order_id, greatest(coalesce(gross_amount, 0), 0)
    into target_shop, parent_id, expected_amount
    from public.shop_orders where id = target_shop_order_id;
  if target_shop is null or not (public.is_shop_staff_for_shop(target_shop) or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)) then return false; end if;
  if collected_amount < 0 or collected_amount > expected_amount then return false; end if;
  update public.shop_orders set cod_collected_amount = collected_amount, cod_collected_at = now(), cod_collection_status = case when collected_amount >= expected_amount then 'collected' else 'settlement_pending' end where id = target_shop_order_id;
  if parent_id is not null and not exists (select 1 from public.shop_orders where parent_order_id = parent_id and cod_collection_status not in ('collected', 'settled')) then
    update public.orders set payment_status = 'paid', paid_at = coalesce(paid_at, now()) where id = parent_id and payment_method = 'cash_on_delivery';
  end if;
  return true;
end;
$$;

grant execute on function public.confirm_cod_collection(uuid, numeric) to authenticated;

grant execute on function public.sync_shop_earning(uuid) to authenticated;

create or replace function public.refresh_earnings_availability()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  update public.shop_earnings
     set status = 'available', updated_at = now()
   where status = 'pending'
     and available_at is not null
     and available_at <= now();
  get diagnostics changed = row_count;
  return changed;
end;
$$;

grant execute on function public.refresh_earnings_availability() to authenticated;

alter table public.payments enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.shop_earnings enable row level security;
alter table public.earning_payout_items enable row level security;
alter table public.refunds enable row level security;

drop policy if exists "Customers and admins can read own payments" on public.payments;
create policy "Customers and admins can read own payments" on public.payments for select to authenticated using (exists (select 1 from public.orders o where o.id = payments.order_id and (o.customer_id = auth.uid() or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))));
drop policy if exists "Admins can read payment transactions" on public.payment_transactions;
create policy "Admins can read payment transactions" on public.payment_transactions for select to authenticated using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));
drop policy if exists "Shop staff and admins can read shop earnings" on public.shop_earnings;
create policy "Shop staff and admins can read shop earnings" on public.shop_earnings for select to authenticated using (public.is_shop_staff_for_shop(shop_id) or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));
drop policy if exists "Shop staff and admins can read earning payout items" on public.earning_payout_items;
create policy "Shop staff and admins can read earning payout items" on public.earning_payout_items for select to authenticated using (exists (select 1 from public.shop_earnings e where e.id = earning_payout_items.earning_id and (public.is_shop_staff_for_shop(e.shop_id) or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))));
drop policy if exists "Customers and admins can read refunds" on public.refunds;
create policy "Customers and admins can read refunds" on public.refunds for select to authenticated using (exists (select 1 from public.orders o where o.id = refunds.order_id and (o.customer_id = auth.uid() or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))));

create or replace function public.verify_payment(
  target_payment_id uuid,
  target_status text,
  target_provider_reference text,
  target_idempotency_key text,
  target_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.payments%rowtype;
begin
  if not coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) then return false; end if;
  if target_status not in ('paid', 'failed', 'cancelled', 'processing') then return false; end if;
  select * into payment_row from public.payments where id = target_payment_id for update;
  if not found then return false; end if;
  if exists (select 1 from public.payment_transactions where idempotency_key = target_idempotency_key) then return true; end if;
  update public.payments set status = target_status, provider_reference = coalesce(target_provider_reference, provider_reference), provider_metadata = coalesce(target_metadata, '{}'::jsonb), paid_at = case when target_status = 'paid' then coalesce(paid_at, now()) else paid_at end, updated_at = now() where id = target_payment_id;
  insert into public.payment_transactions (payment_id, order_id, type, amount, status, provider, provider_reference, idempotency_key, metadata)
  values (target_payment_id, payment_row.order_id, case when target_status = 'paid' then 'capture' else 'adjustment' end, payment_row.amount, target_status, payment_row.payment_provider, target_provider_reference, target_idempotency_key, coalesce(target_metadata, '{}'::jsonb));
  update public.orders set payment_status = target_status, payment_reference = coalesce(target_provider_reference, payment_reference), paid_at = case when target_status = 'paid' then coalesce(paid_at, now()) else paid_at end where id = payment_row.order_id;
  return true;
end;
$$;

revoke all on function public.verify_payment(uuid, text, text, text, jsonb) from public;
grant execute on function public.verify_payment(uuid, text, text, text, jsonb) to authenticated;

create or replace function public.refresh_order_overall_status(target_parent_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  total_count integer;
  cancelled_count integer;
  delivered_count integer;
  shipped_count integer;
  processing_count integer;
  next_status text;
begin
  select count(*), count(*) filter (where lower(coalesce(order_status, 'pending')) = 'cancelled'), count(*) filter (where lower(coalesce(order_status, 'pending')) in ('delivered', 'completed')), count(*) filter (where lower(coalesce(order_status, 'pending')) in ('shipped', 'out_for_delivery')), count(*) filter (where lower(coalesce(order_status, 'pending')) in ('processing', 'confirmed')) into total_count, cancelled_count, delivered_count, shipped_count, processing_count from public.shop_orders where parent_order_id = target_parent_order_id;
  next_status := case when total_count = 0 then 'pending' when cancelled_count = total_count then 'cancelled' when delivered_count = total_count then 'delivered' when delivered_count > 0 then 'partially_delivered' when shipped_count > 0 then 'partially_shipped' when processing_count > 0 then 'processing' else 'pending' end;
  update public.orders set order_status = next_status where id = target_parent_order_id;
end;
$$;

create or replace function public.refresh_order_overall_status_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_order_overall_status(new.parent_order_id);
  return new;
end;
$$;

drop trigger if exists shop_order_overall_status_after_update on public.shop_orders;
create trigger shop_order_overall_status_after_update after insert or update of order_status on public.shop_orders for each row execute function public.refresh_order_overall_status_trigger();

alter table public.payouts enable row level security;
drop policy if exists "Shop staff can read own payouts" on public.payouts;
create policy "Shop staff can read own payouts" on public.payouts for select to authenticated using (public.is_shop_staff_for_shop(shop_id));
drop policy if exists "Admins can read all payouts" on public.payouts;
create policy "Admins can read all payouts" on public.payouts for select to authenticated using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));
drop policy if exists "Admins can update all payouts" on public.payouts;
create policy "Admins can update all payouts" on public.payouts for update to authenticated using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)) with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

-- Re-run the financial trigger for historical delivered rows without changing
-- their fulfillment status. The unique shop_order_id keeps this idempotent.
update public.shop_orders
   set order_status = order_status
 where lower(coalesce(order_status, 'pending')) in ('delivered', 'completed');
