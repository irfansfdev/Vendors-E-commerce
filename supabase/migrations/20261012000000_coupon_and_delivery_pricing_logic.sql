-- Coupon, delivery and pricing logic for multi-vendor checkout.
-- SQL is the source of truth. TS pricing config is a preview only.

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value, description)
values
  ('pricing.delivery_base_fee', to_jsonb(200::numeric), 'Base delivery charge in PKR for a shop order before the free-delivery threshold.'),
  ('pricing.free_delivery_threshold', to_jsonb(3000::numeric), 'Shop subtotal threshold in PKR before a delivery fee is waived.'),
  ('pricing.shop_coupon_max_percent', to_jsonb(50::numeric), 'Maximum percentage discount allowed for shop coupons.'),
  ('pricing.default_commission_rate', to_jsonb(10::numeric), 'Default seller commission rate in percent.'),
  ('returns.restock_enabled', to_jsonb(true::boolean), 'Enable item restocking on successful inspection pass.'),
  ('pricing.currency', to_jsonb('PKR'::text), 'Settlement currency for pricing and payouts.')
on conflict (key) do nothing;

alter table public.orders
  add column if not exists subtotal_amount numeric(14,2) not null default 0,
  add column if not exists discount_amount numeric(14,2) not null default 0,
  add column if not exists delivery_fee numeric(14,2) not null default 0,
  add column if not exists delivery_discount numeric(14,2) not null default 0,
  add column if not exists coupon_id uuid,
  add column if not exists coupon_code text,
  add column if not exists payable_total numeric(14,2) not null default 0;

alter table public.shop_orders
  add column if not exists discount_amount numeric(14,2) not null default 0,
  add column if not exists delivery_fee numeric(14,2) not null default 0,
  add column if not exists delivery_discount numeric(14,2) not null default 0,
  add column if not exists payable_total numeric(14,2) not null default 0,
  add column if not exists coupon_id uuid,
  add column if not exists discount_funded_by text not null default 'shop' check (discount_funded_by in ('shop', 'platform')),
  add column if not exists platform_discount_cost numeric(14,2) not null default 0;

alter table public.order_items
  add column if not exists discount_amount numeric(14,2) not null default 0;

-- Backfill legacy rows in a non-destructive way.
update public.orders
   set subtotal_amount = coalesce(subtotal_amount, total_amount, 0::numeric),
       discount_amount = coalesce(discount_amount, 0::numeric),
       delivery_fee = coalesce(delivery_fee, 0::numeric),
       delivery_discount = coalesce(delivery_discount, 0::numeric),
       payable_total = coalesce(payable_total, total_amount, 0::numeric)
 where subtotal_amount = 0 or payable_total = 0;

update public.shop_orders
   set payable_total = coalesce(payable_total, sub_total, gross_amount, 0::numeric),
       discount_amount = coalesce(discount_amount, 0::numeric),
       delivery_fee = coalesce(delivery_fee, 0::numeric),
       delivery_discount = coalesce(delivery_discount, 0::numeric),
       platform_discount_cost = coalesce(platform_discount_cost, 0::numeric)
 where payable_total = 0;

create or replace function public.create_multi_vendor_order(p_customer_id uuid, p_shipping_address_id uuid, p_payment_method text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_cart_id uuid;
  v_customer_count integer;
  v_subtotal numeric(14,2) := 0;
  v_shop_id uuid;
  v_shop_total numeric(14,2) := 0;
  v_shop_order_id uuid;
  v_item_name text;
begin
  if auth.uid() is distinct from p_customer_id then
    raise exception 'Unauthorized order creation';
  end if;

  if p_shipping_address_id is null then
    raise exception 'Shipping address is required';
  end if;

  select count(*) into v_customer_count
  from public.addresses
  where id = p_shipping_address_id and user_id = p_customer_id;

  if v_customer_count = 0 then
    raise exception 'Shipping address does not belong to the current user';
  end if;

  select id into v_cart_id from public.carts where user_id = p_customer_id limit 1;
  if v_cart_id is null then
    raise exception 'Cart is empty!';
  end if;

  -- Lock variant rows before checking stock so the RPC and trigger agree.
  perform 1
  from public.cart_items ci
  join public.product_variants pv on pv.id = ci.variant_id
  join public.products p on p.id = pv.product_id
  where ci.cart_id = v_cart_id
  order by p.shop_id
  for update of pv;

  if not exists (
    select 1 from public.cart_items ci where ci.cart_id = v_cart_id
  ) then
    raise exception 'Cart is empty!';
  end if;

  if exists (
    select 1
    from public.cart_items ci
    join public.product_variants pv on pv.id = ci.variant_id
    where ci.cart_id = v_cart_id
      and ci.quantity > coalesce(pv.stock_quantity, 0::numeric)
  ) then
    select p.title into v_item_name
    from public.cart_items ci
    join public.product_variants pv on pv.id = ci.variant_id
    join public.products p on p.id = pv.product_id
    where ci.cart_id = v_cart_id and ci.quantity > coalesce(pv.stock_quantity, 0::numeric)
    limit 1;
    raise exception 'Insufficient stock for %', coalesce(v_item_name, 'item'::text);
  end if;

  select coalesce(sum(ci.quantity * coalesce(pv.price, p.price, 0::numeric)), 0::numeric)
    into v_subtotal
  from public.cart_items ci
  left join public.product_variants pv on pv.id = ci.variant_id
  left join public.products p on p.id = pv.product_id
  where ci.cart_id = v_cart_id;

  if v_subtotal <= 0 then
    raise exception 'Cart is empty!';
  end if;

  insert into public.orders (
    customer_id,
    shipping_address_id,
    total_amount,
    subtotal_amount,
    discount_amount,
    delivery_fee,
    delivery_discount,
    payable_total,
    payment_method,
    payment_status,
    order_status,
    created_at
  )
  values (
    p_customer_id,
    p_shipping_address_id,
    v_subtotal,
    v_subtotal,
    0,
    0,
    0,
    v_subtotal,
    coalesce(lower(p_payment_method), 'cash_on_delivery'::text),
    'pending'::text,
    'pending'::text,
    now()
  )
  returning id into v_order_id;

  for v_shop_id, v_shop_total in
    select p.shop_id, coalesce(sum(ci.quantity * coalesce(pv.price, p.price, 0::numeric)), 0::numeric)
    from public.cart_items ci
    join public.product_variants pv on pv.id = ci.variant_id
    join public.products p on p.id = pv.product_id
    where ci.cart_id = v_cart_id
    group by p.shop_id
  loop
    insert into public.shop_orders (
      parent_order_id,
      shop_id,
      sub_total,
      discount_amount,
      delivery_fee,
      delivery_discount,
      payable_total,
      payment_method,
      order_status,
      gross_amount,
      platform_commission,
      seller_earnings,
      payout_status
    )
    values (
      v_order_id,
      v_shop_id,
      v_shop_total,
      0,
      0,
      0,
      v_shop_total,
      coalesce(lower(p_payment_method), 'cash_on_delivery'::text),
      'pending'::text,
      v_shop_total,
      0,
      v_shop_total,
      'not_eligible'
    )
    returning id into v_shop_order_id;

    insert into public.order_items (
      shop_order_id,
      variant_id,
      quantity,
      price_at_checkout,
      discount_amount
    )
    select
      v_shop_order_id,
      ci.variant_id,
      ci.quantity,
      coalesce(pv.price, p.price, 0::numeric),
      0
    from public.cart_items ci
    join public.product_variants pv on pv.id = ci.variant_id
    join public.products p on p.id = pv.product_id
    where ci.cart_id = v_cart_id and p.shop_id = v_shop_id;
  end loop;

  delete from public.cart_items where cart_id = v_cart_id;

  return v_order_id;
end;
$$;

grant execute on function public.create_multi_vendor_order(uuid, uuid, text) to authenticated;

create or replace function public.reduce_stock_on_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock numeric;
  v_name text;
begin
  select pv.stock_quantity, p.title
    into v_stock, v_name
  from public.product_variants pv
  join public.products p on p.id = pv.product_id
  where pv.id = new.variant_id
  for update;

  if v_stock is null then
    return new;
  end if;

  if coalesce(v_stock, 0::numeric) < coalesce(new.quantity, 0::integer) then
    raise exception 'Insufficient stock for %', coalesce(v_name, 'item'::text);
  end if;

  update public.product_variants
     set stock_quantity = stock_quantity - new.quantity
   where id = new.variant_id;

  return new;
end;
$$;

drop trigger if exists trigger_reduce_stock on public.order_items;
create trigger trigger_reduce_stock
after insert on public.order_items
for each row execute function public.reduce_stock_on_order();

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
  if lower(coalesce(new.order_status, 'pending'::text)) in ('delivered', 'completed') then
    new.delivered_at := coalesce(new.delivered_at, now());
    gross := greatest(0::numeric, new.sub_total - (case when new.discount_funded_by = 'shop'::text then new.discount_amount else 0::numeric end));

    select coalesce(s.commission_rate, 10::numeric), greatest(coalesce(s.payout_hold_days, 7::integer), 0::integer)
      into rate, hold_days
      from public.shops s
     where s.id = new.shop_id;

    select lower(coalesce(o.payment_status, 'pending'::text))
      into payment_state
      from public.orders o
     where o.id = new.parent_order_id;

    commission := round(gross * rate / 100, 2);
    seller_amount := greatest(0::numeric, gross - commission - coalesce(new.refund_amount, 0::numeric));
    new.gross_amount := gross;
    new.platform_commission := commission;
    new.seller_earnings := seller_amount;
    new.payout_status := case
      when payment_state not in ('paid', 'partially_refunded') then 'not_eligible'
      when new.delivered_at + make_interval(days => hold_days) <= now() then 'available'
      else 'pending'
    end;
  elsif lower(coalesce(new.order_status, 'pending'::text)) in ('cancelled', 'pending', 'processing', 'shipped') then
    new.payout_status := case when lower(coalesce(new.order_status, 'pending'::text)) = 'cancelled' then 'cancelled' else coalesce(new.payout_status, 'not_eligible'::text) end;
  end if;
  return new;
end;
$$;

drop trigger if exists shop_order_financials_before_update on public.shop_orders;
create trigger shop_order_financials_before_update
before insert or update on public.shop_orders
for each row execute function public.apply_shop_order_financials();

create or replace function public.create_business_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric(14,2):=0;
  v_items numeric(14,2):=0;
  v_delivery numeric(14,2):=0;
  v_discount numeric(14,2):=0;
  v_state text;
begin
  if tg_table_name = 'orders' and (tg_op = 'INSERT' or to_jsonb(new)->>'order_status' is distinct from to_jsonb(old)->>'order_status') then
    v_total := coalesce((to_jsonb(new)->>'payable_total')::numeric, (to_jsonb(new)->>'total_amount')::numeric, 0::numeric);
    v_items := coalesce((to_jsonb(new)->>'subtotal_amount')::numeric, (to_jsonb(new)->>'total_amount')::numeric, 0::numeric);
    v_delivery := coalesce((to_jsonb(new)->>'delivery_fee')::numeric, 0::numeric);
    v_discount := coalesce((to_jsonb(new)->>'discount_amount')::numeric, 0::numeric);
    v_state := coalesce(to_jsonb(new)->>'order_status', 'pending'::text);

    insert into public.notifications (user_id, type, title, body, message, entity_type, entity_id)
    values (
      new.customer_id,
      case when tg_op = 'INSERT' then 'order_created' else 'order_status' end,
      case when tg_op = 'INSERT' then 'Order placed' else 'Order status updated' end,
      case when tg_op = 'INSERT' then 'Order placed. Total Rs ' || round(v_total, 2)::text || ' (items Rs ' || round(v_items, 2)::text || ', delivery Rs ' || round(v_delivery, 2)::text || ', discount Rs ' || round(v_discount, 2)::text || ')' else 'Your order is now ' || v_state || '.' end,
      case when tg_op = 'INSERT' then 'Order placed. Total Rs ' || round(v_total, 2)::text || ' (items Rs ' || round(v_items, 2)::text || ', delivery Rs ' || round(v_delivery, 2)::text || ', discount Rs ' || round(v_discount, 2)::text || ')' else 'Your order is now ' || v_state || '.' end,
      'order',
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists orders_business_notification on public.orders;
create trigger orders_business_notification
after insert or update of order_status on public.orders
for each row execute function public.create_business_notification();

-- COD assignments must use the payable total, not the raw subtotal.
create or replace function public.assign_delivery(target_shop_order_id uuid, target_rider_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_id uuid;
  expected numeric;
begin
  if not (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false::boolean) or public.is_shop_staff_for_shop((select shop_id from public.shop_orders where id = target_shop_order_id))) then
    return null::uuid;
  end if;

  select coalesce(so.payable_total, so.sub_total, so.gross_amount, 0::numeric)
    into expected
  from public.shop_orders so
  where so.id = target_shop_order_id;

  insert into public.delivery_assignments (shop_order_id, rider_id, assigned_by, cod_expected_amount)
  values (
    target_shop_order_id,
    target_rider_id,
    auth.uid(),
    case when lower(coalesce((select payment_method from public.shop_orders where id = target_shop_order_id), 'cash_on_delivery'::text)) = 'cash_on_delivery' then coalesce(expected, 0::numeric) else 0::numeric end
  )
  on conflict (shop_order_id) do update
     set rider_id = excluded.rider_id,
         assigned_by = excluded.assigned_by,
         status = 'assigned',
         updated_at = now()
  returning id into assignment_id;

  insert into public.delivery_events (assignment_id, status, created_by)
  values (assignment_id, 'assigned', auth.uid());

  return assignment_id;
end;
$$;

grant execute on function public.assign_delivery(uuid, uuid) to authenticated;

create or replace function public.update_delivery_assignment(target_assignment_id uuid, target_status text, target_collected_amount numeric default 0::numeric, target_failure_reason text default null::text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_row public.delivery_assignments%rowtype;
  order_row public.shop_orders%rowtype;
  now_time timestamptz := now();
begin
  select * into assignment_row
  from public.delivery_assignments
  where id = target_assignment_id
  for update;

  if not found then
    return false;
  end if;

  if not (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false::boolean) or exists (
      select 1 from public.delivery_profiles where id = assignment_row.rider_id and user_id = auth.uid()
  )) then
    return false;
  end if;

  if target_status not in ('accepted', 'picked_up', 'out_for_delivery', 'delivered', 'failed') then
    return false;
  end if;

  select * into order_row from public.shop_orders where id = assignment_row.shop_order_id;
  if not found then
    return false;
  end if;

  if target_status = 'delivered' and lower(coalesce(order_row.payment_method, 'cash_on_delivery'::text)) = 'cash_on_delivery' and target_collected_amount < coalesce(order_row.payable_total, assignment_row.cod_expected_amount, 0::numeric) then
    return false;
  end if;

  update public.delivery_assignments
     set status = target_status,
         accepted_at = case when target_status = 'accepted' then coalesce(accepted_at, now_time) else accepted_at end,
         picked_up_at = case when target_status = 'picked_up' then coalesce(picked_up_at, now_time) else picked_up_at end,
         out_for_delivery_at = case when target_status = 'out_for_delivery' then coalesce(out_for_delivery_at, now_time) else out_for_delivery_at end,
         delivered_at = case when target_status = 'delivered' then coalesce(delivered_at, now_time) else delivered_at end,
         failed_at = case when target_status = 'failed' then coalesce(failed_at, now_time) else failed_at end,
         failure_reason = case when target_status = 'failed' then target_failure_reason else failure_reason end,
         cod_expected_amount = case when target_status in ('accepted', 'picked_up', 'out_for_delivery', 'delivered') then coalesce(order_row.payable_total, cod_expected_amount, 0::numeric) else cod_expected_amount end,
         cod_collected_amount = case when target_status = 'delivered' then target_collected_amount else cod_collected_amount end,
         cod_collected_at = case when target_status = 'delivered' and lower(coalesce(order_row.payment_method, 'cash_on_delivery'::text)) = 'cash_on_delivery' then now_time else cod_collected_at end,
         updated_at = now_time
   where id = target_assignment_id;

  if target_status in ('picked_up', 'out_for_delivery', 'delivered') then
    update public.shop_orders
       set order_status = case
             when target_status = 'picked_up' then 'shipped'
             when target_status = 'out_for_delivery' then 'out_for_delivery'
             else 'delivered'
           end,
           cod_collection_status = case when target_status = 'delivered' and lower(coalesce(payment_method, 'cash_on_delivery'::text)) = 'cash_on_delivery' then 'collected' else cod_collection_status end
     where id = assignment_row.shop_order_id;
  end if;

  if target_status = 'delivered' and lower(coalesce(order_row.payment_method, 'cash_on_delivery'::text)) = 'cash_on_delivery' then
    update public.orders
       set payment_status = 'paid',
           paid_at = coalesce(paid_at, now_time)
     where id = order_row.parent_order_id
       and payment_method = 'cash_on_delivery';
  end if;

  insert into public.delivery_events (assignment_id, status, note, created_by)
  values (target_assignment_id, target_status, target_failure_reason, auth.uid());

  return true;
end;
$$;

grant execute on function public.update_delivery_assignment(uuid, text, numeric, text) to authenticated;

-- Returns restocking is opt-in and explicit, and should not restore stock on cancellation.
update public.app_settings
   set value = to_jsonb(true::boolean), updated_at = now()
 where key = 'returns.restock_enabled';
