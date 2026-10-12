-- Restore the database-side pricing RPC used by the cart and checkout UI.
-- Existing coupon rows are retained and mapped to shop/platform scope.

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value, description)
values
  ('pricing.delivery_base_fee', to_jsonb(200::numeric), 'Base delivery fee per shop order in PKR.'),
  ('pricing.free_delivery_threshold', to_jsonb(3000::numeric), 'Shop subtotal for free delivery in PKR.'),
  ('pricing.shop_coupon_max_percent', to_jsonb(50::numeric), 'Maximum shop coupon percentage discount.'),
  ('returns.restock_enabled', to_jsonb(true::boolean), 'Enable opt-in item restocking after return inspection.')
on conflict (key) do nothing;

alter table public.orders
  add column if not exists subtotal_amount numeric(14, 2) not null default 0,
  add column if not exists discount_amount numeric(14, 2) not null default 0,
  add column if not exists delivery_fee numeric(14, 2) not null default 0,
  add column if not exists delivery_discount numeric(14, 2) not null default 0,
  add column if not exists coupon_id uuid,
  add column if not exists coupon_code text,
  add column if not exists payable_total numeric(14, 2) not null default 0;

alter table public.shop_orders
  add column if not exists discount_amount numeric(14, 2) not null default 0,
  add column if not exists delivery_fee numeric(14, 2) not null default 0,
  add column if not exists delivery_discount numeric(14, 2) not null default 0,
  add column if not exists payable_total numeric(14, 2) not null default 0,
  add column if not exists coupon_id uuid,
  add column if not exists discount_funded_by text not null default 'shop'
    check (discount_funded_by in ('shop', 'platform')),
  add column if not exists platform_discount_cost numeric(14, 2) not null default 0;

alter table public.order_items
  add column if not exists discount_amount numeric(14, 2) not null default 0;

update public.orders
   set subtotal_amount = coalesce(nullif(subtotal_amount, 0::numeric), total_amount, 0::numeric),
       payable_total = coalesce(nullif(payable_total, 0::numeric), total_amount, 0::numeric)
 where subtotal_amount = 0 or payable_total = 0;

update public.shop_orders
   set payable_total = coalesce(nullif(payable_total, 0::numeric), sub_total, 0::numeric)
 where payable_total = 0;

alter table public.coupons
  add column if not exists scope text,
  add column if not exists max_discount numeric(14, 2),
  add column if not exists usage_limit_total integer,
  add column if not exists usage_limit_per_user integer,
  add column if not exists first_order_only boolean;

update public.coupons
   set scope = case when shop_id is null then 'platform'::text else 'shop'::text end
 where scope is null;

update public.coupons
   set first_order_only = coalesce(first_order_only, false)
 where first_order_only is null;

alter table public.coupons
  alter column scope set default 'shop',
  alter column scope set not null,
  alter column first_order_only set default false,
  alter column first_order_only set not null;

alter table public.coupons
  drop constraint if exists coupons_scope_check;
alter table public.coupons
  add constraint coupons_scope_check check (scope in ('platform', 'shop'));
alter table public.coupons
  drop constraint if exists coupons_scope_shop_id_check;
alter table public.coupons
  add constraint coupons_scope_shop_id_check
  check ((scope = 'platform' and shop_id is null) or (scope = 'shop' and shop_id is not null));

update public.coupons
   set code = upper(trim(code))
 where code is distinct from upper(trim(code));

create or replace function public.normalize_coupon_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.code := upper(trim(new.code));
  return new;
end;
$$;

drop trigger if exists coupons_normalize_code on public.coupons;
create trigger coupons_normalize_code
before insert or update of code on public.coupons
for each row execute function public.normalize_coupon_code();

create unique index if not exists coupons_code_upper_uidx
  on public.coupons (upper(code));

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  discount_amount numeric(14, 2) not null default 0,
  status text not null default 'active' check (status in ('active', 'released')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coupon_redemptions
  add column if not exists updated_at timestamptz not null default now();

create index if not exists coupon_redemptions_coupon_status_idx
  on public.coupon_redemptions (coupon_id, status);
create index if not exists coupon_redemptions_user_coupon_status_idx
  on public.coupon_redemptions (user_id, coupon_id, status);

alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;

drop policy if exists coupons_admin_all on public.coupons;
create policy coupons_admin_all on public.coupons
  for all to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

drop policy if exists coupons_shop_staff_all on public.coupons;
create policy coupons_shop_staff_all on public.coupons
  for all to authenticated
  using (
    scope = 'shop'
    and
    shop_id is not null
    and exists (
      select 1
      from public.shops s
      where s.id = coupons.shop_id
        and (
          s.owner_id = auth.uid()
          or exists (
            select 1
            from public.shop_members sm
            where sm.shop_id = s.id
              and sm.user_id = auth.uid()
              and sm.role in ('owner', 'manager')
          )
        )
    )
  )
  with check (
    scope = 'shop'
    and
    shop_id is not null
    and exists (
      select 1
      from public.shops s
      where s.id = coupons.shop_id
        and (
          s.owner_id = auth.uid()
          or exists (
            select 1
            from public.shop_members sm
            where sm.shop_id = s.id
              and sm.user_id = auth.uid()
              and sm.role in ('owner', 'manager')
          )
        )
    )
  );

drop policy if exists coupons_access_restrictive on public.coupons;
create policy coupons_access_restrictive on public.coupons
  as restrictive
  for all to anon, authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
    or (
      scope = 'shop'
      and shop_id is not null
      and exists (
        select 1
        from public.shops s
        where s.id = coupons.shop_id
          and (
            s.owner_id = auth.uid()
            or exists (
              select 1
              from public.shop_members sm
              where sm.shop_id = s.id
                and sm.user_id = auth.uid()
                and sm.role in ('owner', 'manager')
            )
          )
      )
    )
  )
  with check (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
    or (
      scope = 'shop'
      and shop_id is not null
      and exists (
        select 1
        from public.shops s
        where s.id = coupons.shop_id
          and (
            s.owner_id = auth.uid()
            or exists (
              select 1
              from public.shop_members sm
              where sm.shop_id = s.id
                and sm.user_id = auth.uid()
                and sm.role in ('owner', 'manager')
            )
          )
      )
    )
  );

drop policy if exists coupon_redemptions_admin_select on public.coupon_redemptions;
create policy coupon_redemptions_admin_select on public.coupon_redemptions
  for select to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

drop policy if exists coupon_redemptions_shop_staff_select on public.coupon_redemptions;
create policy coupon_redemptions_shop_staff_select on public.coupon_redemptions
  for select to authenticated
  using (
    exists (
      select 1
      from public.coupons c
      join public.shops s on s.id = c.shop_id
      where c.id = coupon_redemptions.coupon_id
        and (
          s.owner_id = auth.uid()
          or exists (
            select 1
            from public.shop_members sm
            where sm.shop_id = s.id
              and sm.user_id = auth.uid()
              and sm.role in ('owner', 'manager')
          )
        )
    )
  );

drop policy if exists coupon_redemptions_access_restrictive on public.coupon_redemptions;
create policy coupon_redemptions_access_restrictive on public.coupon_redemptions
  as restrictive
  for all to anon, authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
    or exists (
        select 1
        from public.coupons c
        join public.shops s on s.id = c.shop_id
        where c.id = coupon_redemptions.coupon_id
          and (
            s.owner_id = auth.uid()
            or exists (
              select 1
              from public.shop_members sm
              where sm.shop_id = s.id
                and sm.user_id = auth.uid()
                and sm.role in ('owner', 'manager')
            )
          )
    )
  )
  with check (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
    or exists (
        select 1
        from public.coupons c
        join public.shops s on s.id = c.shop_id
        where c.id = coupon_redemptions.coupon_id
          and (
            s.owner_id = auth.uid()
            or exists (
              select 1
              from public.shop_members sm
              where sm.shop_id = s.id
                and sm.user_id = auth.uid()
                and sm.role in ('owner', 'manager')
            )
          )
    )
  );

grant select, insert, update, delete on public.coupons to authenticated;
grant select on public.coupon_redemptions to authenticated;

create or replace function public.price_cart_lines(
  p_user uuid,
  p_lines jsonb,
  p_coupon_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lines jsonb := '[]'::jsonb;
  v_shops jsonb := '[]'::jsonb;
  v_result jsonb;
  v_coupon_id uuid;
  v_coupon_shop_id uuid;
  v_coupon_code text;
  v_coupon_type text;
  v_coupon_scope text;
  v_coupon_value numeric(14, 2);
  v_coupon_minimum numeric(14, 2);
  v_coupon_maximum numeric(14, 2);
  v_coupon_start timestamptz;
  v_coupon_end timestamptz;
  v_coupon_active boolean;
  v_coupon_first_order boolean;
  v_coupon_total_limit integer;
  v_coupon_user_limit integer;
  v_coupon_found boolean := false;
  v_coupon_valid boolean := false;
  v_error jsonb := null::jsonb;
  v_subtotal numeric(14, 2) := 0::numeric;
  v_discount numeric(14, 2) := 0::numeric;
  v_delivery_fee numeric(14, 2) := 0::numeric;
  v_delivery_discount numeric(14, 2) := 0::numeric;
  v_payable_total numeric(14, 2) := 0::numeric;
  v_eligible_subtotal numeric(14, 2) := 0::numeric;
  v_minimum_basis numeric(14, 2) := 0::numeric;
  v_missing_amount numeric(14, 2) := 0::numeric;
  v_delivery_base numeric(14, 2) := 200::numeric;
  v_free_delivery_threshold numeric(14, 2) := 3000::numeric;
  v_line_count integer := 0;
  v_variant_count integer := 0;
  v_active_total integer := 0;
  v_active_user integer := 0;
  v_remaining_cents integer := 0;
begin
  if auth.uid() is distinct from p_user then
    raise exception 'Unauthorized pricing request';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Cart lines must be a JSON array';
  end if;

  v_line_count := jsonb_array_length(p_lines);
  if exists (
    select 1
    from jsonb_array_elements(p_lines) line
    where coalesce(line ->> 'variant_id', '') = ''
       or coalesce(line ->> 'qty', '') !~ '^[1-9][0-9]*$'
  ) then
    raise exception 'Each cart line needs a variant_id and a positive integer qty';
  end if;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'variant_id', priced.variant_id,
          'qty', priced.qty,
          'unit_price', priced.unit_price,
          'line_subtotal', priced.line_subtotal,
          'discount_amount', 0::numeric,
          'shop_id', priced.shop_id,
          'shop_name', priced.shop_name
        )
        order by priced.ordinality
      ),
      '[]'::jsonb
    ),
    count(*)::integer,
    coalesce(sum(priced.line_subtotal), 0::numeric)
  into v_lines, v_variant_count, v_subtotal
  from (
    select
      pv.id as variant_id,
      (input.line ->> 'qty')::integer as qty,
      pv.price::numeric as unit_price,
      (pv.price::numeric * (input.line ->> 'qty')::integer)::numeric(14, 2) as line_subtotal,
      p.shop_id,
      s.name as shop_name,
      input.ordinality
    from jsonb_array_elements(p_lines) with ordinality as input(line, ordinality)
    join public.product_variants pv on pv.id = (input.line ->> 'variant_id')::uuid
    join public.products p on p.id = pv.product_id
    join public.shops s on s.id = p.shop_id
  ) priced;

  if v_variant_count <> v_line_count then
    raise exception 'One or more cart variants are no longer available';
  end if;

  select coalesce((value #>> '{}')::numeric, 200::numeric)
    into v_delivery_base
  from public.app_settings
  where key = 'pricing.delivery_base_fee';
  v_delivery_base := greatest(coalesce(v_delivery_base, 200::numeric), 0::numeric);

  select coalesce((value #>> '{}')::numeric, 3000::numeric)
    into v_free_delivery_threshold
  from public.app_settings
  where key = 'pricing.free_delivery_threshold';
  v_free_delivery_threshold := greatest(coalesce(v_free_delivery_threshold, 3000::numeric), 0::numeric);

  if nullif(trim(p_coupon_code), '') is not null then
    select
      c.id,
      c.shop_id,
      c.code,
      case
        when lower(c.discount_type) = 'percent' then 'percentage'::text
        else lower(c.discount_type)
      end,
      c.discount_value,
      coalesce(c.min_order_value, 0::numeric),
      c.max_discount,
      c.start_date,
      c.end_date,
      coalesce(c.is_active, false),
      coalesce(c.first_order_only, false),
      c.usage_limit_total,
      c.usage_limit_per_user,
      c.scope
    into
      v_coupon_id,
      v_coupon_shop_id,
      v_coupon_code,
      v_coupon_type,
      v_coupon_value,
      v_coupon_minimum,
      v_coupon_maximum,
      v_coupon_start,
      v_coupon_end,
      v_coupon_active,
      v_coupon_first_order,
      v_coupon_total_limit,
      v_coupon_user_limit,
      v_coupon_scope
    from public.coupons c
    where upper(c.code) = upper(trim(p_coupon_code))
    limit 1;

    v_coupon_found := found;

    if not v_coupon_found then
      v_error := jsonb_build_object('code', 'not_found'::text);
    elsif not v_coupon_active then
      v_error := jsonb_build_object('code', 'inactive'::text);
    elsif v_coupon_start is not null and v_coupon_start > now() then
      v_error := jsonb_build_object('code', 'not_started'::text);
    elsif v_coupon_end is not null and v_coupon_end <= now() then
      v_error := jsonb_build_object('code', 'expired'::text);
    elsif v_coupon_scope = 'shop' and (
      v_coupon_shop_id is null
      or not exists (
        select 1
        from jsonb_array_elements(v_lines) line
        where (line ->> 'shop_id')::uuid = v_coupon_shop_id
      )
    ) then
      v_error := jsonb_build_object('code', 'not_applicable_to_cart'::text);
    elsif v_coupon_first_order and exists (
      select 1
      from public.orders o
      where o.customer_id = p_user
        and lower(coalesce(o.order_status, 'pending'::text)) <> 'cancelled'
    ) then
      v_error := jsonb_build_object('code', 'already_used'::text);
    else
      select count(*)::integer
        into v_active_user
      from public.coupon_redemptions r
      where r.coupon_id = v_coupon_id
        and r.user_id = p_user
        and r.status = 'active';

      select count(*)::integer
        into v_active_total
      from public.coupon_redemptions r
      where r.coupon_id = v_coupon_id
        and r.status = 'active';

      if v_coupon_total_limit is not null and v_active_total >= v_coupon_total_limit then
        v_error := jsonb_build_object('code', 'usage_limit_reached'::text);
      elsif v_coupon_user_limit is not null and v_active_user >= v_coupon_user_limit then
        v_error := jsonb_build_object(
          'code',
          case when v_coupon_user_limit = 1 then 'already_used'::text else 'usage_limit_reached'::text end
        );
      else
        if v_coupon_scope = 'shop' then
          select coalesce(sum((line ->> 'line_subtotal')::numeric), 0::numeric)
            into v_eligible_subtotal
          from jsonb_array_elements(v_lines) line
          where (line ->> 'shop_id')::uuid = v_coupon_shop_id;
          v_minimum_basis := v_eligible_subtotal;
        else
          v_eligible_subtotal := v_subtotal;
          v_minimum_basis := v_subtotal;
        end if;

        if v_minimum_basis < v_coupon_minimum then
          v_missing_amount := round(v_coupon_minimum - v_minimum_basis, 2);
          v_error := jsonb_build_object(
            'code', 'min_order_not_met'::text,
            'missing_amount', v_missing_amount
          );
        elsif coalesce(v_coupon_type, ''::text) not in ('percentage', 'fixed', 'free_delivery') then
          v_error := jsonb_build_object('code', 'not_applicable_to_cart'::text);
        elsif v_coupon_type in ('percentage', 'fixed') and v_coupon_value <= 0::numeric then
          v_error := jsonb_build_object('code', 'not_applicable_to_cart'::text);
        else
          v_coupon_valid := true;
          if v_coupon_type = 'percentage' then
            v_discount := greatest(
              0::numeric,
              least(round(v_eligible_subtotal * v_coupon_value / 100::numeric, 2), v_eligible_subtotal)
            );
            if v_coupon_maximum is not null then
              v_discount := least(v_discount, v_coupon_maximum);
            end if;
          elsif v_coupon_type = 'fixed' then
            v_discount := greatest(0::numeric, least(v_eligible_subtotal, v_coupon_value));
          end if;
        end if;
      end if;
    end if;
  end if;

  if v_coupon_valid and v_coupon_type in ('percentage', 'fixed') and v_discount > 0 then
    select (
      round(v_discount * 100::numeric)::integer
      - coalesce(sum(floor(v_discount * (line ->> 'line_subtotal')::numeric / v_eligible_subtotal * 100::numeric)), 0)::integer
    )
      into v_remaining_cents
    from jsonb_array_elements(v_lines) line
    where v_coupon_scope = 'platform'
       or (line ->> 'shop_id')::uuid = v_coupon_shop_id;

    with line_shares as (
      select
        input.line,
        input.ordinality,
        case
          when v_coupon_scope = 'platform' or (input.line ->> 'shop_id')::uuid = v_coupon_shop_id
            then v_discount * (input.line ->> 'line_subtotal')::numeric / v_eligible_subtotal
          else 0::numeric
        end as share
      from jsonb_array_elements(v_lines) with ordinality as input(line, ordinality)
    ),
    rounded_shares as (
      select
        line,
        ordinality,
        share,
        floor(share * 100::numeric)::integer as base_cents,
        row_number() over (
          order by
            case when share > 0 then share * 100::numeric - floor(share * 100::numeric) else -1::numeric end desc,
            ordinality
        ) as remainder_rank
      from line_shares
    )
    select coalesce(
      jsonb_agg(
        line || jsonb_build_object(
          'discount_amount',
          ((base_cents + case when share > 0 and remainder_rank <= v_remaining_cents then 1 else 0 end)::numeric / 100::numeric)
        )
        order by ordinality
      ),
      '[]'::jsonb
    )
      into v_lines
    from rounded_shares;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'shop_id', grouped.shop_id,
        'shop_name', grouped.shop_name,
        'lines', grouped.lines,
        'subtotal', grouped.subtotal,
        'discount_amount', grouped.discount_amount,
        'delivery_fee', grouped.delivery_fee,
        'delivery_discount', grouped.delivery_discount,
        'payable_total', grouped.subtotal - grouped.discount_amount + grouped.delivery_fee - grouped.delivery_discount,
        'free_delivery_remaining', greatest(v_free_delivery_threshold - grouped.subtotal, 0::numeric)
      )
      order by grouped.shop_name
    ),
    '[]'::jsonb
  ),
  coalesce(sum(grouped.subtotal), 0::numeric),
  coalesce(sum(grouped.discount_amount), 0::numeric),
  coalesce(sum(grouped.delivery_fee), 0::numeric),
  coalesce(sum(grouped.delivery_discount), 0::numeric),
  coalesce(sum(grouped.subtotal - grouped.discount_amount + grouped.delivery_fee - grouped.delivery_discount), 0::numeric)
  into v_shops, v_subtotal, v_discount, v_delivery_fee, v_delivery_discount, v_payable_total
  from (
    select
      (line ->> 'shop_id')::uuid as shop_id,
      line ->> 'shop_name' as shop_name,
      jsonb_agg(line - 'shop_id' - 'shop_name' order by line ->> 'variant_id') as lines,
      sum((line ->> 'line_subtotal')::numeric) as subtotal,
      sum((line ->> 'discount_amount')::numeric) as discount_amount,
      case
        when sum((line ->> 'line_subtotal')::numeric) >= v_free_delivery_threshold then 0::numeric
        else v_delivery_base
      end as delivery_fee,
      case
        when v_coupon_valid
          and v_coupon_type = 'free_delivery'
          and (v_coupon_scope = 'platform' or (line ->> 'shop_id')::uuid = v_coupon_shop_id)
          and sum((line ->> 'line_subtotal')::numeric) < v_free_delivery_threshold
          then v_delivery_base
        else 0::numeric
      end as delivery_discount
    from jsonb_array_elements(v_lines) line
    group by (line ->> 'shop_id')::uuid, line ->> 'shop_name'
  ) grouped;

  v_result := jsonb_build_object(
    'shops', v_shops,
    'subtotal', v_subtotal,
    'discount_amount', v_discount,
    'delivery_fee', v_delivery_fee,
    'delivery_discount', v_delivery_discount,
    'payable_total', v_payable_total,
    'applied_coupon', case
      when v_coupon_valid then jsonb_build_object(
        'code', v_coupon_code,
        'type', v_coupon_type,
        'scope', v_coupon_scope
      )
      else null::jsonb
    end,
    'error', v_error
  );

  return v_result;
end;
$$;

revoke all on function public.price_cart_lines(uuid, jsonb, text) from public;

create or replace function public.calculate_cart_pricing(
  p_lines jsonb,
  p_coupon_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to calculate cart pricing';
  end if;

  return public.price_cart_lines(auth.uid(), p_lines, p_coupon_code);
end;
$$;

revoke all on function public.calculate_cart_pricing(jsonb, text) from public;
grant execute on function public.calculate_cart_pricing(jsonb, text) to authenticated;

drop function if exists public.create_multi_vendor_order(uuid, uuid, text);

create or replace function public.create_multi_vendor_order(
  p_customer_id uuid,
  p_shipping_address_id uuid,
  p_payment_method text,
  p_coupon_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_cart_id uuid;
  v_address_count integer;
  v_coupon_id uuid;
  v_pricing jsonb;
  v_error jsonb;
  v_applied_coupon jsonb;
  v_shop jsonb;
  v_line jsonb;
  v_shop_order_id uuid;
  v_item_name text;
begin
  if auth.uid() is distinct from p_customer_id then
    raise exception 'Unauthorized order creation';
  end if;
  if p_shipping_address_id is null then
    raise exception 'Shipping address is required';
  end if;

  select count(*)::integer
    into v_address_count
  from public.addresses a
  where a.id = p_shipping_address_id
    and a.user_id = p_customer_id;
  if v_address_count = 0 then
    raise exception 'Shipping address does not belong to the current user';
  end if;

  select c.id
    into v_coupon_id
  from public.coupons c
  where nullif(trim(p_coupon_code), '') is not null
    and upper(c.code) = upper(trim(p_coupon_code))
  for update;

  select c.id
    into v_cart_id
  from public.carts c
  where c.user_id = p_customer_id
  limit 1;
  if v_cart_id is null then
    raise exception 'Cart is empty!';
  end if;

  if not exists (
    select 1
    from public.cart_items ci
    where ci.cart_id = v_cart_id
  ) then
    raise exception 'Cart is empty!';
  end if;

  perform 1
  from public.cart_items ci
  join public.product_variants pv on pv.id = ci.variant_id
  join public.products p on p.id = pv.product_id
  where ci.cart_id = v_cart_id
  order by p.shop_id
  for update of pv;

  if exists (
    select 1
    from public.cart_items ci
    join public.product_variants pv on pv.id = ci.variant_id
    where ci.cart_id = v_cart_id
      and ci.quantity > coalesce(pv.stock_quantity, 0::integer)
  ) then
    select p.title
      into v_item_name
    from public.cart_items ci
    join public.product_variants pv on pv.id = ci.variant_id
    join public.products p on p.id = pv.product_id
    where ci.cart_id = v_cart_id
      and ci.quantity > coalesce(pv.stock_quantity, 0::integer)
    limit 1;
    raise exception 'Insufficient stock for %', coalesce(v_item_name, 'item'::text);
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('variant_id', ci.variant_id, 'qty', ci.quantity)
      order by ci.created_at, ci.id
    ),
    '[]'::jsonb
  )
    into v_pricing
  from public.cart_items ci
  where ci.cart_id = v_cart_id;

  v_pricing := public.price_cart_lines(p_customer_id, v_pricing, p_coupon_code);
  v_error := v_pricing -> 'error';
  if v_error is not null and v_error <> 'null'::jsonb then
    raise exception 'Coupon could not be applied: %', v_error ->> 'code';
  end if;
  v_applied_coupon := v_pricing -> 'applied_coupon';

  insert into public.orders (
    customer_id,
    shipping_address_id,
    total_amount,
    subtotal_amount,
    discount_amount,
    delivery_fee,
    delivery_discount,
    coupon_id,
    coupon_code,
    payable_total,
    payment_method,
    payment_status,
    order_status,
    created_at
  )
  values (
    p_customer_id,
    p_shipping_address_id,
    (v_pricing ->> 'payable_total')::numeric,
    (v_pricing ->> 'subtotal')::numeric,
    (v_pricing ->> 'discount_amount')::numeric,
    (v_pricing ->> 'delivery_fee')::numeric,
    (v_pricing ->> 'delivery_discount')::numeric,
    case when v_applied_coupon is not null and v_applied_coupon <> 'null'::jsonb then v_coupon_id else null::uuid end,
    case when v_applied_coupon is not null and v_applied_coupon <> 'null'::jsonb then v_applied_coupon ->> 'code' else null::text end,
    (v_pricing ->> 'payable_total')::numeric,
    coalesce(lower(p_payment_method), 'cash_on_delivery'::text),
    'pending'::text,
    'pending'::text,
    now()
  )
  returning id into v_order_id;

  for v_shop in
    select value from jsonb_array_elements(v_pricing -> 'shops')
  loop
    insert into public.shop_orders (
      parent_order_id,
      shop_id,
      sub_total,
      discount_amount,
      delivery_fee,
      delivery_discount,
      payable_total,
      coupon_id,
      discount_funded_by,
      platform_discount_cost,
      payment_method,
      order_status,
      gross_amount,
      platform_commission,
      seller_earnings,
      payout_status
    )
    values (
      v_order_id,
      (v_shop ->> 'shop_id')::uuid,
      (v_shop ->> 'subtotal')::numeric,
      (v_shop ->> 'discount_amount')::numeric,
      (v_shop ->> 'delivery_fee')::numeric,
      (v_shop ->> 'delivery_discount')::numeric,
      (v_shop ->> 'payable_total')::numeric,
      case when v_applied_coupon is not null and v_applied_coupon <> 'null'::jsonb then v_coupon_id else null::uuid end,
      case
        when v_applied_coupon is not null and v_applied_coupon <> 'null'::jsonb and v_applied_coupon ->> 'scope' = 'shop' then 'shop'::text
        else 'platform'::text
      end,
      case
        when v_applied_coupon is not null and v_applied_coupon <> 'null'::jsonb and v_applied_coupon ->> 'scope' = 'platform'
          then (v_shop ->> 'discount_amount')::numeric
        else 0::numeric
      end,
      coalesce(lower(p_payment_method), 'cash_on_delivery'::text),
      'pending'::text,
      (v_shop ->> 'subtotal')::numeric
        - case
            when v_applied_coupon is not null and v_applied_coupon <> 'null'::jsonb and v_applied_coupon ->> 'scope' = 'shop'
              then (v_shop ->> 'discount_amount')::numeric
            else 0::numeric
          end,
      0::numeric,
      (v_shop ->> 'subtotal')::numeric
        - case
            when v_applied_coupon is not null and v_applied_coupon <> 'null'::jsonb and v_applied_coupon ->> 'scope' = 'shop'
              then (v_shop ->> 'discount_amount')::numeric
            else 0::numeric
          end,
      'not_eligible'::text
    )
    returning id into v_shop_order_id;

    for v_line in
      select value from jsonb_array_elements(v_shop -> 'lines')
    loop
      insert into public.order_items (
        shop_order_id,
        variant_id,
        quantity,
        price_at_checkout,
        discount_amount
      )
      values (
        v_shop_order_id,
        (v_line ->> 'variant_id')::uuid,
        (v_line ->> 'qty')::integer,
        (v_line ->> 'unit_price')::numeric,
        (v_line ->> 'discount_amount')::numeric
      );
    end loop;
  end loop;

  if v_applied_coupon is not null and v_applied_coupon <> 'null'::jsonb then
    insert into public.coupon_redemptions (
      coupon_id,
      user_id,
      order_id,
      discount_amount,
      status
    )
    values (
      v_coupon_id,
      p_customer_id,
      v_order_id,
      (v_pricing ->> 'discount_amount')::numeric + (v_pricing ->> 'delivery_discount')::numeric,
      'active'::text
    );
  end if;

  delete from public.cart_items
  where cart_id = v_cart_id;

  return v_order_id;
end;
$$;

revoke all on function public.create_multi_vendor_order(uuid, uuid, text, text) from public;
grant execute on function public.create_multi_vendor_order(uuid, uuid, text, text) to authenticated;

create or replace function public.release_coupon_redemption_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.order_status, ''::text)) = 'cancelled'
     and lower(coalesce(old.order_status, ''::text)) not in ('cancelled', 'delivered', 'completed') then
    update public.coupon_redemptions
       set status = 'released',
           updated_at = now()
     where order_id = new.id
       and status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_release_coupon_redemption on public.orders;
create trigger orders_release_coupon_redemption
after update of order_status on public.orders
for each row execute function public.release_coupon_redemption_on_cancel();

notify pgrst, 'reload schema';
