-- Returns and refunds. Existing return_requests rows are retained in place.

alter table public.shops
  add column if not exists return_window_days integer not null default 7;
alter table public.shops drop constraint if exists shops_return_window_days_check;
alter table public.shops add constraint shops_return_window_days_check
  check (return_window_days >= 0);

alter table public.products
  add column if not exists is_returnable boolean not null default true;

alter table public.order_items
  add column if not exists returned_qty integer not null default 0;
alter table public.order_items drop constraint if exists order_items_returned_qty_check;
alter table public.order_items add constraint order_items_returned_qty_check
  check (returned_qty >= 0 and returned_qty <= quantity);

alter table public.return_requests
  add column if not exists reason_code text,
  add column if not exists customer_note text,
  add column if not exists seller_response_reason text,
  add column if not exists seller_response_due_at timestamptz,
  add column if not exists seller_responded_at timestamptz,
  add column if not exists pickup_fee numeric(12,2) not null default 0,
  add column if not exists refund_amount numeric(12,2) not null default 0,
  add column if not exists inspection_note text,
  add column if not exists escalated_at timestamptz,
  add column if not exists escalation_reason text,
  add column if not exists refunded_at timestamptz,
  add column if not exists refund_method text,
  add column if not exists refund_reference text,
  add column if not exists receipt_confirmed_at timestamptz,
  add column if not exists inspection_failure_code text,
  add column if not exists updated_at timestamptz not null default now();
alter table public.notifications
  add column if not exists entity_url text;

alter table public.return_requests
  drop constraint if exists return_requests_status_check;
alter table public.return_requests
  add constraint return_requests_status_check check (status in (
    'requested', 'approved', 'rejected', 'escalated', 'pickup_assigned',
    'picked_up', 'returned_to_shop', 'inspection_passed', 'inspection_failed',
    'refund_pending', 'refunded', 'cancelled',
    -- Retain compatibility with legacy rows instead of rewriting their history.
    'received'
  ));
alter table public.return_requests
  drop constraint if exists return_requests_reason_code_check;
alter table public.return_requests
  add constraint return_requests_reason_code_check
  check (reason_code is null or reason_code in (
    'damaged_defective', 'wrong_item', 'not_as_described', 'missing_item',
    'size_fit', 'changed_mind'
  ));

drop index if exists public.return_requests_one_active_per_shop_order;
create unique index if not exists return_requests_one_active_per_shop_order
  on public.return_requests(shop_order_id)
  where shop_order_id is not null and status in (
    'requested', 'approved', 'escalated', 'pickup_assigned', 'picked_up',
    'returned_to_shop', 'inspection_passed', 'inspection_failed',
    'refund_pending', 'received'
  );
create index if not exists return_requests_customer_idx
  on public.return_requests(customer_id, requested_at desc);
create index if not exists return_requests_admin_queue_idx
  on public.return_requests(status, seller_response_due_at);

create table if not exists public.return_items (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null references public.return_requests(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  purchase_unit_price numeric(14,2) not null check (purchase_unit_price >= 0),
  refund_amount numeric(14,2) not null check (refund_amount >= 0),
  created_at timestamptz not null default now(),
  unique (return_request_id, order_item_id)
);
create index if not exists return_items_order_item_idx
  on public.return_items(order_item_id);

create table if not exists public.return_evidence (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null references public.return_requests(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  object_path text not null unique,
  content_type text,
  evidence_type text not null default 'photo',
  created_at timestamptz not null default now()
);
create index if not exists return_evidence_request_idx
  on public.return_evidence(return_request_id, created_at);

create table if not exists public.return_events (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null references public.return_requests(id) on delete cascade,
  from_status text,
  to_status text not null,
  event_type text not null,
  note text,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists return_events_request_idx
  on public.return_events(return_request_id, created_at, id);

create table if not exists public.return_refund_accounts (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null unique references public.return_requests(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  method text not null check (method in ('jazzcash', 'easypaisa', 'bank_transfer')),
  account_holder_name text not null,
  account_number text not null,
  bank_name text,
  created_at timestamptz not null default now()
);

-- The customer pickup code is kept separate from return details and remains private.
drop function if exists public.get_shop_return_receive_code(uuid);
drop function if exists public.seller_confirm_return_receipt(uuid,text);
create table if not exists public.return_customer_pickup_codes (
  return_request_id uuid primary key references public.return_requests(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  pickup_code text not null check (pickup_code ~ '^[0-9]{6}$'),
  created_at timestamptz not null default now()
);
drop table if exists public.return_shop_receive_codes;
create table if not exists public.return_notification_dedupe (
  return_request_id uuid not null references public.return_requests(id) on delete cascade,
  event_key text not null,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (return_request_id, event_key, recipient_id)
);

-- Convert the outbound assignment constraint into separate outbound/return
-- uniqueness rules while retaining all existing assignment rows as deliveries.
alter table public.delivery_assignments
  add column if not exists assignment_type text not null default 'delivery',
  add column if not exists return_request_id uuid references public.return_requests(id) on delete cascade;
alter table public.delivery_assignments
  add column if not exists return_handover_code text;
alter table public.delivery_assignments
  drop constraint if exists delivery_assignments_return_handover_code_check;
alter table public.delivery_assignments
  add constraint delivery_assignments_return_handover_code_check
  check (return_handover_code is null or return_handover_code ~ '^[0-9]{6}$');
alter table public.delivery_assignments
  alter column shop_order_id drop not null;
do $$
declare constraint_row record;
begin
  for constraint_row in
    select c.conname
      from pg_constraint c
      join unnest(c.conkey) with ordinality keys(attnum, position) on true
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = keys.attnum
     where c.conrelid = 'public.delivery_assignments'::regclass
       and c.contype = 'u'
     group by c.conname
    having array_agg(a.attname order by keys.position) = array['shop_order_id']::name[]
  loop
    execute format('alter table public.delivery_assignments drop constraint %I', constraint_row.conname);
  end loop;
end $$;
alter table public.delivery_assignments
  drop constraint if exists delivery_assignments_assignment_type_check;
alter table public.delivery_assignments
  add constraint delivery_assignments_assignment_type_check
  check (assignment_type in ('delivery', 'return_pickup'));
alter table public.delivery_assignments
  drop constraint if exists delivery_assignments_target_check;
alter table public.delivery_assignments
  add constraint delivery_assignments_target_check check (
    (assignment_type = 'delivery' and shop_order_id is not null and return_request_id is null)
    or
    (assignment_type = 'return_pickup' and shop_order_id is null and return_request_id is not null)
  );
create unique index if not exists delivery_assignments_one_delivery_per_shop_order
  on public.delivery_assignments(shop_order_id)
  where assignment_type = 'delivery' and shop_order_id is not null;
create unique index if not exists delivery_assignments_one_pickup_per_return
  on public.delivery_assignments(return_request_id)
  where assignment_type = 'return_pickup' and return_request_id is not null;
create index if not exists delivery_assignments_type_status_idx
  on public.delivery_assignments(assignment_type, status, assigned_at desc);

alter table public.return_requests
  add column if not exists delivery_assignment_id uuid references public.delivery_assignments(id) on delete set null;
alter table public.return_requests enable row level security;
alter table public.return_items enable row level security;
alter table public.return_evidence enable row level security;
alter table public.return_events enable row level security;
alter table public.return_refund_accounts enable row level security;
alter table public.return_customer_pickup_codes enable row level security;
alter table public.return_notification_dedupe enable row level security;

create or replace function public.is_return_shop_staff(target_return_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.return_requests rr
      join public.shop_orders so on so.id = rr.shop_order_id
      join public.shops s on s.id = so.shop_id
     where rr.id = target_return_id
       and (
         s.owner_id = auth.uid()
         or exists (
           select 1 from public.shop_members sm
            where sm.shop_id = s.id and sm.user_id = auth.uid()
              and sm.role in ('owner', 'manager')
         )
       )
  );
$$;
revoke all on function public.is_return_shop_staff(uuid) from public;
grant execute on function public.is_return_shop_staff(uuid) to authenticated;

drop policy if exists "Customers can view their return requests" on public.return_requests;
drop policy if exists "Customers can request returns" on public.return_requests;
drop policy if exists "Admins can manage returns" on public.return_requests;
drop policy if exists "Customers sellers and admins can read returns" on public.return_requests;
create policy "Customers sellers and admins can read returns"
  on public.return_requests for select to authenticated
  using (
    customer_id = auth.uid()
    or public.is_return_shop_staff(id)
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  );
drop policy if exists "Customers can read their return items" on public.return_items;
create policy "Customers can read their return items"
  on public.return_items for select to authenticated
  using (
    exists (select 1 from public.return_requests rr where rr.id = return_request_id and rr.customer_id = auth.uid())
    or public.is_return_shop_staff(return_request_id)
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  );
drop policy if exists "Customers sellers admins can read return evidence" on public.return_evidence;
create policy "Customers sellers admins can read return evidence"
  on public.return_evidence for select to authenticated
  using (
    exists (select 1 from public.return_requests rr where rr.id = return_request_id and rr.customer_id = auth.uid())
    or public.is_return_shop_staff(return_request_id)
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  );
drop policy if exists "Customers sellers admins can read return events" on public.return_events;
create policy "Customers sellers admins can read return events"
  on public.return_events for select to authenticated
  using (
    exists (select 1 from public.return_requests rr where rr.id = return_request_id and rr.customer_id = auth.uid())
    or public.is_return_shop_staff(return_request_id)
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  );
drop policy if exists "Customers and admins can read refund accounts" on public.return_refund_accounts;
create policy "Customers and admins can read refund accounts"
  on public.return_refund_accounts for select to authenticated
  using (
    customer_id = auth.uid()
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  );
drop policy if exists "Customers and admins can read customer pickup codes" on public.return_customer_pickup_codes;
create policy "Customers and admins can read customer pickup codes"
  on public.return_customer_pickup_codes for select to authenticated
  using (
    customer_id = auth.uid()
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  );
create or replace function public.notify_return_event(
  p_return_request_id uuid,
  p_event_key text,
  p_recipient_role text,
  p_note text default null,
  p_amount numeric default null,
  p_method text default null,
  p_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  row_return public.return_requests%rowtype;
  target_shop uuid;
  target_shop_name text;
  target_item text;
  target_customer text;
  target_area text;
  target_rider text;
  target_assignment uuid;
  target_pickup_code text;
  recipient record;
  inserted_recipient uuid;
  notification_title text;
  notification_body text;
  notification_url text;
  return_ref text;
begin
  select * into row_return from public.return_requests where id = p_return_request_id;
  if not found then raise exception 'Return request not found'; end if;
  return_ref := 'Return #' || upper(left(p_return_request_id::text, 8));
  select so.shop_id, s.name into target_shop, target_shop_name
    from public.shop_orders so join public.shops s on s.id = so.shop_id
   where so.id = row_return.shop_order_id;
  select p.title into target_item
    from public.return_items ri
    join public.order_items oi on oi.id = ri.order_item_id
    join public.product_variants pv on pv.id = oi.variant_id
    join public.products p on p.id = pv.product_id
   where ri.return_request_id = p_return_request_id
   order by ri.created_at limit 1;
  select coalesce(nullif(split_part(to_jsonb(p)->>'full_name', ' ', 1), ''), 'Customer')
    into target_customer from public.profiles p where p.id = row_return.customer_id;
  target_item := coalesce(target_item, 'your item');
  target_shop_name := coalesce(target_shop_name, 'the shop');
  target_customer := coalesce(target_customer, 'Customer');
  select da.id, dp.full_name into target_assignment, target_rider
    from public.delivery_assignments da
    join public.delivery_profiles dp on dp.id = da.rider_id
   where da.id = row_return.delivery_assignment_id and da.assignment_type = 'return_pickup';
  select coalesce(to_jsonb(a)->>'city', to_jsonb(a)->>'area', '')
    into target_area from public.orders o
    left join public.addresses a on a.id = o.shipping_address_id
   where o.id = row_return.order_id;
  select pickup_code into target_pickup_code
    from public.return_customer_pickup_codes where return_request_id = p_return_request_id;

  for recipient in
    select row_return.customer_id as user_id, 'customer'::text as role
     where p_recipient_role in ('customer', 'customer_and_seller')
    union
    select s.owner_id, 'seller'::text from public.shops s
     where s.id = target_shop and p_recipient_role in ('seller', 'customer_and_seller', 'seller_and_admin')
    union
    select sm.user_id, 'seller'::text from public.shop_members sm
     where sm.shop_id = target_shop and sm.role in ('owner','manager')
       and p_recipient_role in ('seller', 'customer_and_seller', 'seller_and_admin')
    union
    select dp.user_id, 'rider'::text from public.delivery_profiles dp
     where dp.id = (select da.rider_id from public.delivery_assignments da
                     where da.id = row_return.delivery_assignment_id)
       and dp.user_id is not null and p_recipient_role = 'rider'
    union
    select u.id, 'admin'::text from auth.users u
     where coalesce((u.raw_app_meta_data->>'is_admin')::boolean, false)
       and p_recipient_role in ('admin', 'seller_and_admin')
  loop
    notification_title := null;
    notification_body := null;
    notification_url := case recipient.role
      when 'customer' then '/account/returns/' || p_return_request_id::text
      when 'seller' then '/seller/returns/' || p_return_request_id::text
      when 'admin' then '/admin/returns/' || p_return_request_id::text
      else '/rider/assignments/' || coalesce(target_assignment::text, '')
    end;

    if p_event_key = 'request_created' and recipient.role = 'customer' then
      notification_title := 'Return request sent';
      notification_body := return_ref || ': We sent your request for ' || target_item || ' to ' || target_shop_name || '. They will reply within 48 hours.';
    elsif p_event_key = 'request_created' and recipient.role = 'seller' then
      notification_title := 'New return request';
      notification_body := return_ref || ': ' || target_customer || ' wants to return ' || target_item || '. Please respond within 48 hours.';
    elsif p_event_key = 'seller_approved' and recipient.role = 'customer' then
      notification_title := 'Return approved';
      notification_body := return_ref || ': ' || target_shop_name || ' approved your return of ' || target_item || '. We will assign a rider for pickup soon.';
    elsif p_event_key = 'seller_approved' and recipient.role = 'admin' then
      notification_title := 'Return approved, assign a rider';
      notification_body := target_shop_name || ' approved ' || return_ref || ' for ' || target_item || '. Please assign a rider for pickup.';
    elsif p_event_key = 'seller_rejected' and recipient.role = 'customer' then
      notification_title := 'Return rejected';
      notification_body := return_ref || ': ' || target_shop_name || ' could not accept your return of ' || target_item || ': ' || coalesce(nullif(p_note,''),'the reason was not provided') || '. You can ask BabulShop to review it within 3 days.';
    elsif p_event_key = 'seller_rejected' and recipient.role = 'admin' then
      notification_title := 'Return rejected by seller';
      notification_body := target_shop_name || ' rejected ' || return_ref || ' for ' || target_item || '. The customer may ask for a review.';
    elsif p_event_key = 'customer_escalated' and recipient.role = 'admin' then
      notification_title := 'Review requested';
      notification_body := target_customer || ' asked us to review rejected ' || return_ref || ' for ' || target_item || '.';
    elsif p_event_key = 'customer_escalated' and recipient.role = 'seller' then
      notification_title := 'Return sent for review';
      notification_body := 'BabulShop will review ' || return_ref || ' for ' || target_item || '.';
    elsif p_event_key = 'seller_reminder' and recipient.role = 'seller' then
      notification_title := 'Return waiting for your reply';
      notification_body := return_ref || ' for ' || target_item || ': Please respond within 48 hours.';
    elsif p_event_key = 'seller_overdue' and recipient.role = 'admin' then
      notification_title := 'Seller has not responded';
      notification_body := target_shop_name || ' has not answered ' || return_ref || ' for ' || target_item || ' for 48 hours.';
    elsif p_event_key = 'rider_assigned' and recipient.role = 'customer' then
      notification_title := 'Rider assigned for pickup';
      notification_body := return_ref || ': ' || coalesce(target_rider,'Your rider') || ' will collect ' || target_item || '. Share code ' || coalesce(target_pickup_code,'') || ' only when handing over the item.';
    elsif p_event_key = 'rider_assigned' and recipient.role = 'seller' then
      notification_title := 'Rider assigned';
      notification_body := coalesce(target_rider,'A rider') || ' will collect ' || target_item || ' (' || return_ref || ') from the customer and bring it to you.';
    elsif p_event_key = 'rider_assigned' and recipient.role = 'rider' then
      notification_title := 'New return pickup';
      notification_body := return_ref || ': Collect ' || target_item || ' from ' || coalesce(nullif(target_area,''),'the customer') || ' and take it to ' || target_shop_name || '.';
    elsif p_event_key like 'pickup_failed%' and recipient.role = 'customer' then
      notification_title := 'We could not reach you';
      notification_body := return_ref || ': Our rider could not collect ' || target_item || '. Please keep your phone on.';
    elsif p_event_key = 'pickup_failed_twice' and recipient.role = 'admin' then
      notification_title := 'Pickup failed twice';
      notification_body := 'Two pickup attempts failed for ' || target_item || ' (' || return_ref || '). Please review the return.';
    elsif p_event_key = 'rider_picked_up' and recipient.role = 'customer' then
      notification_title := 'Item picked up';
      notification_body := return_ref || ': The rider picked up ' || target_item || '.';
    elsif p_event_key = 'rider_picked_up' and recipient.role = 'seller' then
      notification_title := 'Return on the way';
      notification_body := coalesce(target_rider,'The rider') || ' picked up ' || target_item || ' (' || return_ref || ').';
    elsif p_event_key = 'rider_handed_to_shop' and recipient.role = 'seller' then
      notification_title := 'Return arrived';
      notification_body := return_ref || ': Please confirm you received ' || target_item || ' and check its condition.';
    elsif p_event_key = 'rider_handed_to_shop' and recipient.role = 'admin' then
      notification_title := 'Return delivered to shop';
      notification_body := 'The rider delivered ' || target_item || ' (' || return_ref || ') to ' || target_shop_name || '.';
    elsif p_event_key = 'seller_inspection_passed' and recipient.role = 'admin' then
      notification_title := 'Refund ready to process';
      notification_body := return_ref || ' for ' || target_item || ' passed inspection; please send Rs ' || coalesce(p_amount, row_return.refund_amount)::text || ' to the customer.';
    elsif p_event_key = 'seller_inspection_passed' and recipient.role = 'customer' then
      notification_title := 'Return accepted';
      notification_body := return_ref || ': ' || target_shop_name || ' accepted ' || target_item || ', and your refund of Rs ' || coalesce(p_amount, row_return.refund_amount)::text || ' is being processed.';
    elsif p_event_key in ('inspection_failed','not_received') and recipient.role = 'admin' then
      notification_title := 'Return needs review';
      notification_body := target_shop_name || ' reported a problem with ' || target_item || ' (' || return_ref || '): ' || coalesce(nullif(p_note,''),'No reason provided') || '.';
    elsif p_event_key in ('inspection_failed','not_received') and recipient.role = 'customer' then
      notification_title := 'Return under review';
      notification_body := return_ref || ': The shop reported a problem with ' || target_item || '. BabulShop will review it.';
    elsif p_event_key = 'refunded' and recipient.role = 'customer' then
      notification_title := 'Refund sent';
      notification_body := 'Rs ' || coalesce(p_amount, row_return.refund_amount)::text || ' for ' || target_item || ' (' || return_ref || ') was sent to your ' || coalesce(p_method,'refund') || ' account; reference ' || coalesce(p_reference,'not provided') || '.';
    elsif p_event_key = 'refunded' and recipient.role = 'seller' then
      notification_title := 'Return completed';
      notification_body := return_ref || ' for ' || target_item || ' is complete. Rs ' || coalesce(p_amount, row_return.refund_amount)::text || ' was adjusted in your earnings.';
    elsif p_event_key = 'customer_cancelled' and recipient.role in ('seller','admin') then
      notification_title := 'Return cancelled';
      notification_body := return_ref || ' for ' || target_item || ' was cancelled by the customer.';
    elsif p_event_key in ('admin_approve','admin_reject','admin_refund_anyway') and recipient.role in ('customer','seller') then
      notification_title := case p_event_key when 'admin_approve' then 'Return approved by BabulShop' when 'admin_reject' then 'Return decision from BabulShop' else 'Refund approved by BabulShop' end;
      notification_body := return_ref || ': BabulShop decided to ' || replace(p_event_key, 'admin_', '') || ' the return of ' || target_item || ': ' || coalesce(nullif(p_note,''),'please check the return details for more information') || '.';
    end if;

    if notification_title is not null and notification_body is not null then
      inserted_recipient := null;
      insert into public.return_notification_dedupe(return_request_id,event_key,recipient_id)
      values (p_return_request_id,p_event_key,recipient.user_id)
      on conflict do nothing returning recipient_id into inserted_recipient;
      if inserted_recipient is not null then
        insert into public.notifications(user_id,shop_id,type,title,body,message,entity_type,entity_id,entity_url)
        values (recipient.user_id,target_shop,'return_' || p_event_key,notification_title,notification_body,notification_body,'return_request',p_return_request_id,notification_url);
      end if;
    end if;
  end loop;
end;
$$;
create or replace function public.notify_return_response_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  pending_return record;
  notification_count integer := 0;
begin
  for pending_return in
    select rr.id, rr.requested_at, rr.seller_response_due_at
      from public.return_requests rr
     where rr.status = 'requested'
       and rr.requested_at <= now() - interval '36 hours'
       and rr.seller_response_due_at > now()
       and not exists (
         select 1 from public.return_notification_dedupe d
          where d.return_request_id = rr.id and d.event_key = 'seller_reminder'
       )
  loop
    perform public.notify_return_event(pending_return.id, 'seller_reminder', 'seller');
    notification_count := notification_count + 1;
  end loop;
  for pending_return in
    select rr.id
      from public.return_requests rr
     where rr.status = 'requested'
       and rr.seller_response_due_at <= now()
       and not exists (
         select 1 from public.return_notification_dedupe d
          where d.return_request_id = rr.id and d.event_key = 'seller_overdue'
       )
  loop
    perform public.notify_return_event(pending_return.id, 'seller_overdue', 'admin');
    notification_count := notification_count + 1;
  end loop;
  return notification_count;
end;
$$;

create or replace function public.record_return_event(
  target_return_id uuid,
  target_from_status text,
  target_to_status text,
  target_event_type text,
  target_note text,
  target_actor_role text,
  target_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.return_events (
    return_request_id, from_status, to_status, event_type, note,
    actor_id, actor_role, metadata
  ) values (
    target_return_id, target_from_status, target_to_status,
    target_event_type, target_note, auth.uid(), target_actor_role,
    coalesce(target_metadata, '{}'::jsonb)
  );
end;
$$;
revoke all on function public.record_return_event(uuid,text,text,text,text,text,jsonb) from public;

create or replace function public.create_return_request(
  p_shop_order_id uuid,
  p_items jsonb,
  p_reason_code text,
  p_customer_note text,
  p_evidence_paths text[],
  p_refund_method text,
  p_account_holder_name text,
  p_account_number text,
  p_bank_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_order_id uuid;
  customer_user uuid := auth.uid();
  window_days integer;
  delivered_time timestamptz;
  fulfillment_status text;
  return_id uuid := gen_random_uuid();
  item jsonb;
  item_id uuid;
  requested_quantity integer;
  purchased_quantity integer;
  already_returned integer;
  reserved_quantity integer;
  unit_price numeric(14,2);
  item_refund numeric(14,2);
  product_is_returnable boolean;
  total_refund numeric(14,2) := 0;
  evidence_count integer := coalesce(cardinality(p_evidence_paths), 0);
  reason_label text;
begin
  if customer_user is null then raise exception 'Sign in to request a return'; end if;
  if p_reason_code is null or p_reason_code not in ('damaged_defective','wrong_item','not_as_described','missing_item','size_fit','changed_mind') then
    raise exception 'Invalid return reason';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Select at least one item';
  end if;
  if p_refund_method is null or p_refund_method not in ('jazzcash','easypaisa','bank_transfer')
     or length(trim(coalesce(p_account_holder_name,''))) < 2
     or length(trim(coalesce(p_account_number,''))) < 5 then
    raise exception 'A valid refund account is required';
  end if;
  if evidence_count > 4
     or (p_reason_code not in ('size_fit','changed_mind') and evidence_count = 0) then
    raise exception 'Attach between one and four photos for this reason';
  end if;

  select so.parent_order_id, so.delivered_at, so.order_status, s.return_window_days
    into parent_order_id, delivered_time, fulfillment_status, window_days
    from public.shop_orders so
    join public.shops s on s.id = so.shop_id
    join public.orders o on o.id = so.parent_order_id
   where so.id = p_shop_order_id and o.customer_id = customer_user
   for update of so;
  if not found then raise exception 'Shop order not found'; end if;
  if lower(coalesce(fulfillment_status,'')) not in ('delivered','completed') then
    raise exception 'Returns are available after delivery';
  end if;
  if delivered_time is null or window_days = 0
     or now() > delivered_time + make_interval(days => window_days) then
    raise exception 'The return window has closed';
  end if;
  if exists (
    select 1 from public.return_requests rr
     where rr.shop_order_id = p_shop_order_id
       and rr.status in ('requested','approved','escalated','pickup_assigned','picked_up',
                         'returned_to_shop','inspection_passed','inspection_failed','refund_pending','received')
  ) then raise exception 'There is already an open return for this shop order'; end if;

  reason_label := replace(p_reason_code, '_', ' ');
  insert into public.return_requests (
    id, order_id, shop_order_id, customer_id, reason, reason_code,
    customer_note, status, requested_at, seller_response_due_at
  ) values (
    return_id, parent_order_id, p_shop_order_id, customer_user,
    reason_label, p_reason_code, nullif(trim(p_customer_note), ''),
    'requested', now(), now() + interval '48 hours'
  );

  for item in select value from jsonb_array_elements(p_items)
  loop
    item_id := (item ->> 'order_item_id')::uuid;
    requested_quantity := (item ->> 'quantity')::integer;
    if requested_quantity is null or requested_quantity < 1 then
      raise exception 'Return quantities must be positive';
    end if;

    select oi.quantity, oi.returned_qty, oi.price_at_checkout, p.is_returnable
      into purchased_quantity, already_returned, unit_price, product_is_returnable
      from public.order_items oi
      join public.product_variants pv on pv.id = oi.variant_id
      join public.products p on p.id = pv.product_id
     where oi.id = item_id and oi.shop_order_id = p_shop_order_id
     for update of oi;
    if not found then raise exception 'Selected item does not belong to this shop order'; end if;
    if product_is_returnable is not true then raise exception 'This product is not returnable'; end if;

    select coalesce(sum(ri.quantity), 0)::integer
      into reserved_quantity
      from public.return_items ri
      join public.return_requests rr on rr.id = ri.return_request_id
     where ri.order_item_id = item_id
       and rr.status in ('requested','approved','escalated','pickup_assigned','picked_up',
                         'returned_to_shop','inspection_passed','inspection_failed','refund_pending','received');
    if requested_quantity + already_returned + reserved_quantity > purchased_quantity then
      raise exception 'Requested quantity exceeds the remaining returnable quantity';
    end if;
    if unit_price is null or unit_price < 0 then raise exception 'Purchase-time item price is missing'; end if;

    item_refund := unit_price * requested_quantity;
    total_refund := total_refund + item_refund;
    insert into public.return_items (
      return_request_id, order_item_id, quantity, purchase_unit_price, refund_amount
    ) values (return_id, item_id, requested_quantity, unit_price, item_refund);
  end loop;

  if p_reason_code in ('size_fit','changed_mind') then
    update public.return_requests
       set pickup_fee = 150, refund_amount = greatest(total_refund - 150, 0)
     where id = return_id;
  else
    update public.return_requests set refund_amount = total_refund where id = return_id;
  end if;

  if evidence_count > 0 then
    if exists (
      select 1 from unnest(p_evidence_paths) path
       where path is null or path !~ ('^' || customer_user::text || '/')
    ) then raise exception 'Evidence path is not owned by this customer'; end if;
    if exists (
      select 1
        from unnest(p_evidence_paths) path
        left join storage.objects o
          on o.bucket_id = 'return-evidence' and o.name = path
       where o.id is null or coalesce(o.metadata->>'mimetype','') not like 'image/%'
    ) then raise exception 'Every return photo must be uploaded to the private evidence bucket'; end if;
    insert into public.return_evidence (return_request_id, uploaded_by, object_path, content_type)
    select return_id, customer_user, path, o.metadata->>'mimetype'
      from unnest(p_evidence_paths) path
      join storage.objects o on o.bucket_id = 'return-evidence' and o.name = path;
  end if;

  insert into public.return_refund_accounts (
    return_request_id, customer_id, method, account_holder_name, account_number, bank_name
  ) values (
    return_id, customer_user, p_refund_method, trim(p_account_holder_name),
    trim(p_account_number), nullif(trim(coalesce(p_bank_name,'')), '')
  );
  perform public.record_return_event(return_id, null, 'requested', 'request_created', null, 'customer');
  perform public.notify_return_event(return_id, 'request_created', 'customer');
  perform public.notify_return_event(return_id, 'request_created', 'seller');
  return return_id;
end;
$$;

create or replace function public.seller_respond_return(
  p_return_request_id uuid,
  p_decision text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row_return public.return_requests%rowtype;
  target_shop uuid;
  new_pickup_code text;
begin
  select rr.* into row_return
    from public.return_requests rr
   where rr.id = p_return_request_id for update;
  select so.shop_id into target_shop from public.shop_orders so
   where so.id = row_return.shop_order_id;
  if not found or not public.is_shop_staff_for_shop(target_shop) then
    raise exception 'You do not have access to this shop return';
  end if;
  if row_return.status <> 'requested' then raise exception 'This return is no longer awaiting a seller response'; end if;
  if now() > row_return.seller_response_due_at then
    raise exception 'The seller response deadline has passed; an administrator must review this return';
  end if;
  if p_decision is null or p_decision not in ('approve','reject') then raise exception 'Choose approve or reject'; end if;
  if p_decision = 'reject' and length(trim(coalesce(p_reason,''))) < 5 then
    raise exception 'A rejection reason is required';
  end if;

  if p_decision = 'approve' then
    new_pickup_code := lpad(floor(random() * 1000000)::integer::text, 6, '0');
    insert into public.return_customer_pickup_codes(return_request_id, customer_id, pickup_code)
    values (p_return_request_id, row_return.customer_id, new_pickup_code)
    on conflict (return_request_id) do update set pickup_code = excluded.pickup_code;
    update public.return_requests
       set status = 'approved', seller_responded_at = now(), decided_at = now(),
           decided_by = auth.uid(), seller_response_reason = null, updated_at = now()
     where id = p_return_request_id;
    perform public.record_return_event(p_return_request_id, 'requested', 'approved', 'seller_approved', null, 'seller');
    perform public.notify_return_event(p_return_request_id, 'seller_approved', 'customer');
    perform public.notify_return_event(p_return_request_id, 'seller_approved', 'admin');
    return jsonb_build_object('success', true);
  end if;

  update public.return_requests
     set status = 'rejected', seller_responded_at = now(), decided_at = now(),
         decided_by = auth.uid(), seller_response_reason = trim(p_reason), updated_at = now()
   where id = p_return_request_id;
  perform public.record_return_event(p_return_request_id, 'requested', 'rejected', 'seller_rejected', trim(p_reason), 'seller');
  perform public.notify_return_event(p_return_request_id, 'seller_rejected', 'customer', trim(p_reason));
  perform public.notify_return_event(p_return_request_id, 'seller_rejected', 'admin', trim(p_reason));
  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.get_customer_return_pickup_code(p_return_request_id uuid)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare code text;
begin
  select c.pickup_code into code
    from public.return_customer_pickup_codes c
    join public.return_requests rr on rr.id = c.return_request_id
   where c.return_request_id = p_return_request_id
     and c.customer_id = auth.uid()
     and rr.customer_id = auth.uid()
     and rr.status = 'pickup_assigned';
  if code is null then raise exception 'Pickup code is not available'; end if;
  return code;
end;
$$;

create or replace function public.get_customer_return_rider_details(p_return_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  row_return public.return_requests%rowtype;
  rider_details jsonb;
begin
  select * into row_return
    from public.return_requests
   where id = p_return_request_id and customer_id = auth.uid();
  if not found then raise exception 'Return request not found'; end if;
  if row_return.status not in ('pickup_assigned','picked_up','returned_to_shop') then
    raise exception 'Rider details are not available for this return';
  end if;

  select jsonb_build_object('name', dp.full_name, 'phone', dp.phone)
    into rider_details
    from public.delivery_assignments da
    join public.delivery_profiles dp on dp.id = da.rider_id
   where da.id = row_return.delivery_assignment_id
     and da.return_request_id = p_return_request_id
     and da.assignment_type = 'return_pickup';
  if rider_details is null then raise exception 'Return pickup rider is not assigned'; end if;
  return rider_details;
end;
$$;

create or replace function public.cancel_return_request(p_return_request_id uuid, p_reason text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare row_return public.return_requests%rowtype;
begin
  select * into row_return from public.return_requests where id = p_return_request_id for update;
  if not found or row_return.customer_id <> auth.uid() then raise exception 'Return request not found'; end if;
  if row_return.status not in ('requested','approved','pickup_assigned') then
    raise exception 'A return cannot be cancelled after the rider picks it up';
  end if;
  update public.return_requests set status = 'cancelled', updated_at = now() where id = p_return_request_id;
  update public.delivery_assignments set status = 'cancelled', updated_at = now()
   where return_request_id = p_return_request_id and assignment_type = 'return_pickup'
     and status in ('assigned','accepted');
  perform public.record_return_event(p_return_request_id, row_return.status, 'cancelled', 'customer_cancelled', p_reason, 'customer');
  perform public.notify_return_event(p_return_request_id, 'customer_cancelled', 'seller_and_admin', p_reason);
  return true;
end;
$$;

create or replace function public.escalate_return_request(p_return_request_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  row_return public.return_requests%rowtype;
  escalation_deadline timestamptz;
begin
  select * into row_return from public.return_requests where id = p_return_request_id for update;
  if not found or row_return.customer_id <> auth.uid() then raise exception 'Return request not found'; end if;
  if length(trim(coalesce(p_reason,''))) < 5 then raise exception 'Explain why you are escalating this return'; end if;
  escalation_deadline := case when row_return.status = 'rejected'
    then row_return.decided_at + interval '3 days'
    when row_return.status = 'inspection_failed'
    then row_return.updated_at + interval '3 days'
    else null end;
  if escalation_deadline is null or now() > escalation_deadline then
    raise exception 'This return is not eligible for escalation';
  end if;
  update public.return_requests
     set status = 'escalated', escalated_at = now(), escalation_reason = trim(p_reason), updated_at = now()
   where id = p_return_request_id;
  perform public.record_return_event(p_return_request_id, row_return.status, 'escalated', 'customer_escalated', trim(p_reason), 'customer');
  perform public.notify_return_event(p_return_request_id, 'customer_escalated', 'seller');
  perform public.notify_return_event(p_return_request_id, 'customer_escalated', 'admin');
  return true;
end;
$$;

create or replace function public.admin_decide_return(
  p_return_request_id uuid,
  p_decision text,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  row_return public.return_requests%rowtype;
  target_shop uuid;
  pickup_code text;
  old_status text;
begin
  if not coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) then
    raise exception 'Administrator access required';
  end if;
  select rr.* into row_return from public.return_requests rr
   where rr.id = p_return_request_id for update;
  select so.shop_id into target_shop from public.shop_orders so
   where so.id = row_return.shop_order_id;
  if not found then raise exception 'Return request not found'; end if;
  old_status := row_return.status;
  if old_status <> 'escalated'
     and old_status <> 'inspection_failed'
     and not (old_status = 'requested' and row_return.seller_response_due_at <= now()) then
    raise exception 'Return is not awaiting an admin decision';
  end if;
  if p_decision is null or p_decision not in ('approve','reject') or length(trim(coalesce(p_reason,''))) < 5 then
    raise exception 'Provide an approve/reject decision and reason';
  end if;
  if p_decision = 'approve' then
    pickup_code := lpad(floor(random() * 1000000)::integer::text, 6, '0');
    insert into public.return_customer_pickup_codes(return_request_id, customer_id, pickup_code)
    values (p_return_request_id, row_return.customer_id, pickup_code)
    on conflict (return_request_id) do update set pickup_code = excluded.pickup_code;
    update public.return_requests set status = 'approved', decided_at = now(),
      decided_by = auth.uid(), seller_response_reason = trim(p_reason), updated_at = now()
     where id = p_return_request_id;
  else
    update public.return_requests set status = 'rejected', decided_at = now(),
      decided_by = auth.uid(), seller_response_reason = trim(p_reason), updated_at = now()
     where id = p_return_request_id;
  end if;
  perform public.record_return_event(p_return_request_id, old_status,
    case when p_decision = 'approve' then 'approved' else 'rejected' end,
    'admin_decision', trim(p_reason), 'admin');
  perform public.notify_return_event(
    p_return_request_id,
    case when p_decision = 'approve' then 'admin_approve' else 'admin_reject' end,
    'customer_and_seller',
    trim(p_reason)
  );
  return true;
end;
$$;

create or replace function public.assign_return_pickup(p_return_request_id uuid, p_rider_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_id uuid;
  rider_capacity integer;
  active_count integer;
  old_status text;
begin
  if not coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) then
    raise exception 'Administrator access required';
  end if;
  select status into old_status from public.return_requests
   where id = p_return_request_id for update;
  if old_status not in ('approved','pickup_assigned') then
    raise exception 'Only approved returns can be assigned';
  end if;
  select max_active_deliveries into rider_capacity
    from public.delivery_profiles
   where id = p_rider_id and status = 'approved' and availability_status = 'available';
  if rider_capacity is null then raise exception 'Choose an approved, available rider'; end if;
  select count(*) into active_count from public.delivery_assignments
   where rider_id = p_rider_id and status in ('assigned','accepted','picked_up','out_for_delivery');
  if active_count >= rider_capacity then raise exception 'Rider has reached active assignment capacity'; end if;

  insert into public.delivery_assignments (
    shop_order_id, return_request_id, assignment_type, rider_id, assigned_by, status
  ) values (
    null, p_return_request_id, 'return_pickup', p_rider_id, auth.uid(), 'assigned'
  )
  on conflict (return_request_id)
    where assignment_type = 'return_pickup' and return_request_id is not null
  do update set rider_id = excluded.rider_id, assigned_by = excluded.assigned_by,
    status = 'assigned', assigned_at = now(), updated_at = now(), failure_reason = null,
    return_handover_code = null
  returning id into assignment_id;

  update public.return_requests set status = 'pickup_assigned',
    delivery_assignment_id = assignment_id, updated_at = now()
   where id = p_return_request_id;
  insert into public.delivery_events(assignment_id, status, note, created_by)
  values (assignment_id, 'assigned', 'Return pickup assigned', auth.uid());
  perform public.record_return_event(p_return_request_id, 'approved', 'pickup_assigned',
    'return_pickup_assigned', null, 'admin');
  perform public.notify_return_event(p_return_request_id, 'rider_assigned', 'customer');
  perform public.notify_return_event(p_return_request_id, 'rider_assigned', 'seller');
  perform public.notify_return_event(p_return_request_id, 'rider_assigned', 'rider');
  return assignment_id;
end;
$$;

create or replace function public.get_rider_return_pickup_details(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  assignment_row public.delivery_assignments%rowtype;
  request_row public.return_requests%rowtype;
  order_row public.orders%rowtype;
  address_json jsonb;
  profile_json jsonb;
  shop_json jsonb;
  item_json jsonb;
begin
  select * into assignment_row from public.delivery_assignments
   where id = p_assignment_id and assignment_type = 'return_pickup';
  if not found or not exists (
    select 1 from public.delivery_profiles dp
     where dp.id = assignment_row.rider_id and dp.user_id = auth.uid()
  ) then raise exception 'Return pickup not found'; end if;

  select * into request_row from public.return_requests where id = assignment_row.return_request_id;
  select o.* into order_row from public.orders o where o.id = request_row.order_id;
  select to_jsonb(a) into address_json from public.addresses a where a.id = order_row.shipping_address_id;
  select to_jsonb(p) into profile_json from public.profiles p where p.id = order_row.customer_id;
  select jsonb_build_object(
      'name', s.name
    ) into shop_json
    from public.shop_orders so
    join public.shops s on s.id = so.shop_id
   where so.id = request_row.shop_order_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'title', p.title, 'quantity', ri.quantity
  )), '[]'::jsonb) into item_json
    from public.return_items ri
    join public.order_items oi on oi.id = ri.order_item_id
    join public.product_variants pv on pv.id = oi.variant_id
    join public.products p on p.id = pv.product_id
   where ri.return_request_id = request_row.id;

  return jsonb_build_object(
    'assignment_id', assignment_row.id,
    'status', assignment_row.status,
    'customer_name', coalesce(address_json->>'full_name', profile_json->>'full_name', profile_json->>'name', 'Customer'),
    'customer_phone', coalesce(address_json->>'phone', profile_json->>'phone', ''),
    'pickup_address', concat_ws(', ',
      coalesce(address_json->>'address_line1', address_json->>'address_line_1', address_json->>'line1', address_json->>'street'),
      coalesce(address_json->>'address_line2', address_json->>'address_line_2', address_json->>'line2'),
      address_json->>'city', address_json->>'state', address_json->>'postal_code'),
    'shop_name', coalesce(shop_json->>'name', 'Shop'),
    'shop_phone', coalesce(shop_json->>'phone', ''),
    'shop_address', '',
    'items', item_json
  );
end;
$$;

create or replace function public.get_rider_return_assignments()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'assignment_id', da.id,
    'return_request_id', rr.id,
    'shop_order_id', rr.shop_order_id,
    'status', da.status,
    'assigned_at', da.assigned_at,
    'delivery_attempt_count', da.delivery_attempt_count,
    'shop_name', s.name,
    'pickup_area', coalesce(to_jsonb(a)->>'city', to_jsonb(a)->>'area', ''),
    'item_count', (select coalesce(sum(ri.quantity),0)
      from public.return_items ri where ri.return_request_id = rr.id)
  ) order by da.assigned_at desc), '[]'::jsonb)
    from public.delivery_assignments da
    join public.delivery_profiles dp on dp.id = da.rider_id
    join public.return_requests rr on rr.id = da.return_request_id
    join public.shop_orders so on so.id = rr.shop_order_id
    join public.shops s on s.id = so.shop_id
    join public.orders o on o.id = rr.order_id
    left join public.addresses a on a.id = o.shipping_address_id
   where da.assignment_type = 'return_pickup'
     and dp.user_id = auth.uid();
$$;

create or replace function public.update_return_pickup(
  p_assignment_id uuid,
  p_target_status text,
  p_confirmation_code text default null,
  p_note text default null,
  p_proof_path text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_row public.delivery_assignments%rowtype;
  request_row public.return_requests%rowtype;
  next_return_status text;
  attempt_count integer;
  proof_mimetype text;
begin
  select * into assignment_row from public.delivery_assignments
   where id = p_assignment_id and assignment_type = 'return_pickup' for update;
  if not found or not exists (
    select 1 from public.delivery_profiles dp
     where dp.id = assignment_row.rider_id and dp.user_id = auth.uid()
  ) then raise exception 'Return pickup not found'; end if;
  select * into request_row from public.return_requests
   where id = assignment_row.return_request_id for update;
  if p_proof_path is not null then
    if p_proof_path !~ ('^' || auth.uid()::text || '/') then
      raise exception 'Proof photo path is not owned by this rider';
    end if;
    select o.metadata->>'mimetype' into proof_mimetype
      from storage.objects o
     where o.bucket_id = 'return-evidence' and o.name = p_proof_path;
    if proof_mimetype is null or proof_mimetype not like 'image/%' then
      raise exception 'Proof must be an image in the private evidence bucket';
    end if;
    insert into public.return_evidence(return_request_id, uploaded_by, object_path, content_type)
    values (request_row.id, auth.uid(), p_proof_path, proof_mimetype);
  end if;

  if p_target_status = 'accepted' and assignment_row.status = 'assigned' then
    update public.delivery_assignments set status = 'accepted', accepted_at = now(), updated_at = now()
     where id = p_assignment_id;
    next_return_status := request_row.status;
  elsif p_target_status = 'accepted' and assignment_row.status = 'failed'
     and assignment_row.delivery_attempt_count < 2 then
    update public.delivery_assignments set status = 'accepted', accepted_at = now(),
      failure_reason = null, updated_at = now()
     where id = p_assignment_id;
    next_return_status := request_row.status;
  elsif p_target_status = 'picked_up' and assignment_row.status = 'accepted' then
    if not exists (select 1 from public.return_customer_pickup_codes
      where return_request_id = request_row.id and pickup_code = p_confirmation_code) then
      if length(trim(coalesce(p_note,''))) < 5 or p_proof_path is null then
        raise exception 'Enter the customer pickup code, or provide a note and photo';
      end if;
    end if;
    update public.delivery_assignments set status = 'picked_up', picked_up_at = now(), updated_at = now()
     where id = p_assignment_id;
    next_return_status := 'picked_up';
  elsif p_target_status = 'out_for_delivery' and assignment_row.status = 'picked_up' then
    update public.delivery_assignments set status = 'out_for_delivery', out_for_delivery_at = now(), updated_at = now()
     where id = p_assignment_id;
    next_return_status := request_row.status;
  elsif p_target_status = 'delivered' and assignment_row.status = 'out_for_delivery' then
    update public.delivery_assignments set status = 'delivered', delivered_at = now(), updated_at = now()
     where id = p_assignment_id;
    next_return_status := 'returned_to_shop';
  elsif p_target_status = 'failed' and assignment_row.status in ('assigned','accepted') then
    if length(trim(coalesce(p_note,''))) < 5 or p_proof_path is null then
      raise exception 'Add a note and photo for this failed pickup attempt';
    end if;
    attempt_count := coalesce((select delivery_attempt_count from public.delivery_assignments where id = p_assignment_id), 0) + 1;
    update public.delivery_assignments set status = 'failed', failed_at = now(),
      failure_reason = trim(p_note), issue_note = trim(p_note),
      proof_url = coalesce(p_proof_path, proof_url),
      delivery_attempt_count = attempt_count, updated_at = now()
     where id = p_assignment_id;
    insert into public.delivery_events(assignment_id, status, note, created_by)
    values (p_assignment_id, 'failed', trim(p_note), auth.uid());
    perform public.record_return_event(request_row.id, request_row.status, request_row.status,
      'pickup_attempt_failed', trim(p_note), 'rider',
      jsonb_build_object('attempt', attempt_count, 'admin_attention', attempt_count >= 2));
    perform public.notify_return_event(request_row.id, 'pickup_failed_attempt_' || attempt_count::text, 'customer');
    if attempt_count >= 2 then
      perform public.notify_return_event(request_row.id, 'pickup_failed_twice', 'admin');
    end if;
    return true;
  else
    raise exception 'Invalid return-pickup status transition';
  end if;

  update public.delivery_assignments set
    proof_url = coalesce(p_proof_path, proof_url),
    updated_at = now()
   where id = p_assignment_id;
  if next_return_status is distinct from request_row.status then
    update public.return_requests set status = next_return_status, updated_at = now()
     where id = request_row.id;
    perform public.record_return_event(request_row.id, request_row.status, next_return_status,
      'rider_' || p_target_status, p_note, 'rider');
    if p_target_status = 'picked_up' then
      perform public.notify_return_event(request_row.id, 'rider_picked_up', 'customer');
      perform public.notify_return_event(request_row.id, 'rider_picked_up', 'seller');
    elsif p_target_status = 'delivered' then
      perform public.notify_return_event(request_row.id, 'rider_handed_to_shop', 'seller');
      perform public.notify_return_event(request_row.id, 'rider_handed_to_shop', 'admin');
    end if;
  else
    insert into public.delivery_events(assignment_id, status, note, created_by)
    values (p_assignment_id, p_target_status, p_note, auth.uid());
    perform public.record_return_event(request_row.id, request_row.status, request_row.status,
      'rider_' || p_target_status, p_note, 'rider');
  end if;
  return true;
end;
$$;

create or replace function public.seller_confirm_return_receipt(p_return_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  row_return public.return_requests%rowtype;
  assignment_status text;
begin
  if not public.is_return_shop_staff(p_return_request_id) then
    raise exception 'You do not have access to this shop return';
  end if;
  select * into row_return from public.return_requests
   where id = p_return_request_id for update;
  if row_return.status <> 'returned_to_shop' or row_return.receipt_confirmed_at is not null then
    raise exception 'This return is not awaiting receipt confirmation';
  end if;
  select da.status into assignment_status
    from public.return_requests rr
    join public.delivery_assignments da on da.id = rr.delivery_assignment_id
   where rr.id = p_return_request_id
     and da.return_request_id = p_return_request_id
     and da.assignment_type = 'return_pickup'
   for update of da;
  if assignment_status <> 'delivered' then raise exception 'The rider has not marked this pickup delivered'; end if;
  update public.return_requests set receipt_confirmed_at = now(), updated_at = now()
   where id = p_return_request_id;
  perform public.record_return_event(
    p_return_request_id, 'returned_to_shop', 'returned_to_shop',
    'seller_confirmed_receipt', null, 'seller'
  );
  return true;
end;
$$;

create or replace function public.seller_report_return_not_received(
  p_return_request_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  row_return public.return_requests%rowtype;
  assignment_status text;
begin
  if not public.is_return_shop_staff(p_return_request_id) then
    raise exception 'You do not have access to this shop return';
  end if;
  if length(trim(coalesce(p_reason,''))) < 5 then raise exception 'Explain why the return was not received'; end if;
  select * into row_return from public.return_requests where id = p_return_request_id for update;
  if row_return.status <> 'returned_to_shop' or row_return.receipt_confirmed_at is not null then
    raise exception 'This return is not awaiting receipt confirmation';
  end if;
  select da.status into assignment_status
    from public.delivery_assignments da
   where da.id = row_return.delivery_assignment_id
     and da.return_request_id = p_return_request_id
     and da.assignment_type = 'return_pickup'
   for update;
  if assignment_status <> 'delivered' then raise exception 'The rider has not marked this pickup delivered'; end if;
  update public.return_requests
     set status = 'inspection_failed',
         inspection_failure_code = 'not_received',
         inspection_note = trim(p_reason),
         updated_at = now()
   where id = p_return_request_id;
  perform public.record_return_event(p_return_request_id, 'returned_to_shop', 'inspection_failed',
    'seller_reported_not_received', trim(p_reason), 'seller',
    jsonb_build_object('reason_code','not_received'));
  perform public.notify_return_event(p_return_request_id, 'not_received', 'customer', trim(p_reason));
  perform public.notify_return_event(p_return_request_id, 'not_received', 'admin', trim(p_reason));
  return true;
end;
$$;

create or replace function public.get_shop_return_rider_details(p_return_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare rider_details jsonb;
begin
  if not public.is_return_shop_staff(p_return_request_id) then
    raise exception 'You do not have access to this shop return';
  end if;
  select jsonb_build_object('name', dp.full_name, 'phone', dp.phone)
    into rider_details
    from public.return_requests rr
    join public.delivery_assignments da on da.id = rr.delivery_assignment_id
    join public.delivery_profiles dp on dp.id = da.rider_id
   where rr.id = p_return_request_id and da.assignment_type = 'return_pickup';
  if rider_details is null then raise exception 'Return pickup rider is not assigned'; end if;
  return rider_details;
end;
$$;

create or replace function public.seller_inspect_return(
  p_return_request_id uuid,
  p_passed boolean,
  p_note text,
  p_evidence_paths text[] default '{}'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  old_status text;
  seller_user uuid := auth.uid();
begin
  if not public.is_return_shop_staff(p_return_request_id) then
    raise exception 'You do not have access to this shop return';
  end if;
  select status into old_status from public.return_requests
   where id = p_return_request_id for update;
  if old_status <> 'returned_to_shop' then raise exception 'Return is not awaiting inspection'; end if;
  if not exists (select 1 from public.return_requests
    where id = p_return_request_id and receipt_confirmed_at is not null) then
    raise exception 'Confirm receipt before inspecting this return';
  end if;
  if length(trim(coalesce(p_note,''))) < 3 then raise exception 'Add an inspection note'; end if;
  if coalesce(cardinality(p_evidence_paths),0) > 4 then raise exception 'Attach no more than four photos'; end if;
  if coalesce(cardinality(p_evidence_paths),0) = 0 then raise exception 'Attach at least one inspection photo'; end if;
  if exists (select 1 from unnest(p_evidence_paths) path
    where path is null or path !~ ('^' || seller_user::text || '/')) then
    raise exception 'Evidence path is not owned by this seller';
  end if;
  if exists (
    select 1
      from unnest(coalesce(p_evidence_paths,'{}')) path
      left join storage.objects o
        on o.bucket_id = 'return-evidence' and o.name = path
     where o.id is null or coalesce(o.metadata->>'mimetype','') not like 'image/%'
  ) then raise exception 'Inspection photos must be uploaded to the private evidence bucket'; end if;
  insert into public.return_evidence(return_request_id, uploaded_by, object_path, content_type)
  select p_return_request_id, seller_user, path, o.metadata->>'mimetype'
    from unnest(coalesce(p_evidence_paths,'{}')) path
    join storage.objects o on o.bucket_id = 'return-evidence' and o.name = path;

  if p_passed then
    update public.return_requests set status = 'inspection_passed', inspection_note = trim(p_note), updated_at = now()
     where id = p_return_request_id;
    perform public.record_return_event(p_return_request_id, 'returned_to_shop', 'inspection_passed',
      'seller_inspection_passed', trim(p_note), 'seller');
    update public.return_requests set status = 'refund_pending', updated_at = now()
     where id = p_return_request_id;
    perform public.record_return_event(p_return_request_id, 'inspection_passed', 'refund_pending',
      'refund_awaiting_admin', null, 'seller');
  else
    update public.return_requests set status = 'inspection_failed', inspection_failure_code = 'inspection_failed', inspection_note = trim(p_note), updated_at = now()
     where id = p_return_request_id;
    perform public.record_return_event(p_return_request_id, 'returned_to_shop', 'inspection_failed',
      'seller_inspection_failed', trim(p_note), 'seller');
    perform public.notify_return_event(p_return_request_id, 'inspection_failed', 'customer', trim(p_note));
    perform public.notify_return_event(p_return_request_id, 'inspection_failed', 'admin', trim(p_note));
  end if;
  if p_passed then
    perform public.notify_return_event(p_return_request_id, 'seller_inspection_passed', 'customer');
    perform public.notify_return_event(p_return_request_id, 'seller_inspection_passed', 'admin');
  end if;
  return true;
end;
$$;

create or replace function public.admin_mark_return_refunded(
  p_return_request_id uuid,
  p_refund_method text,
  p_refund_reference text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  row_return public.return_requests%rowtype;
  row_item record;
  total_refunded numeric(14,2);
  parent_gross numeric(14,2);
  shop_refunded numeric(14,2);
begin
  if not coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) then
    raise exception 'Administrator access required';
  end if;
  if p_refund_method is null or p_refund_method not in ('jazzcash','easypaisa','bank_transfer') then
    raise exception 'Choose a supported refund method';
  end if;
  if length(trim(coalesce(p_refund_reference,''))) < 3 then
    raise exception 'A refund reference is required';
  end if;
  select * into row_return from public.return_requests where id = p_return_request_id for update;
  if not found then raise exception 'Return request not found'; end if;
  if row_return.status = 'refunded' then return true; end if;
  if row_return.status <> 'refund_pending' then raise exception 'Return is not ready for refund'; end if;
  if row_return.refund_amount < 0 then raise exception 'Refund amount cannot be negative'; end if;

  for row_item in
    select ri.order_item_id, ri.quantity
      from public.return_items ri where ri.return_request_id = p_return_request_id
       for update
  loop
    update public.order_items
       set returned_qty = returned_qty + row_item.quantity
     where id = row_item.order_item_id
       and returned_qty + row_item.quantity <= quantity;
    if not found then raise exception 'Returned quantity exceeds the purchased quantity'; end if;
  end loop;

  update public.return_requests set status = 'refunded', refunded_at = now(),
    refund_method = p_refund_method, refund_reference = trim(p_refund_reference),
    updated_at = now()
   where id = p_return_request_id;
  update public.shop_orders
     set refund_amount = coalesce(refund_amount,0) + row_return.refund_amount,
         payout_status = case when payout_status in ('paid','requested') then payout_status else 'pending' end
   where id = row_return.shop_order_id;
  select coalesce(refund_amount,0) into shop_refunded
    from public.shop_orders where id = row_return.shop_order_id;

  select coalesce(sum(so.refund_amount),0),
         coalesce(sum(so.gross_amount),0)
    into total_refunded, parent_gross
    from public.shop_orders so where so.parent_order_id = row_return.order_id;
  update public.orders set refund_amount = total_refunded,
    payment_status = case
      when total_refunded <= 0 then payment_status
      when total_refunded >= parent_gross and parent_gross > 0 then 'refunded'
      else 'partially_refunded' end,
    refunded_at = case when total_refunded > 0 then now() else refunded_at end
   where id = row_return.order_id;
  update public.shop_earnings
     set refund_amount = shop_refunded,
         adjustment_amount = coalesce(adjustment_amount,0) - row_return.refund_amount,
         net_amount = greatest(0, coalesce(gross_amount,0) - coalesce(commission_amount,0)
                               - shop_refunded),
         updated_at = now()
   where shop_order_id = row_return.shop_order_id;
  update public.payouts
     set refund_amount = shop_refunded,
         adjustment_amount = coalesce(adjustment_amount,0) - row_return.refund_amount,
         amount = greatest(0, coalesce(gross_amount,0) - coalesce(commission_amount,0)
                           - shop_refunded),
         net_amount = greatest(0, coalesce(gross_amount,0) - coalesce(commission_amount,0)
                               - shop_refunded)
   where source_shop_order_id = row_return.shop_order_id;
  perform public.record_return_event(p_return_request_id, 'refund_pending', 'refunded',
    'admin_refunded', 'Refund marked as paid via ' || p_refund_method, 'admin',
    jsonb_build_object('method', p_refund_method, 'reference', trim(p_refund_reference),
                       'amount_pkr', row_return.refund_amount));
  perform public.notify_return_event(p_return_request_id, 'refunded', 'customer',
    null, row_return.refund_amount, p_refund_method, trim(p_refund_reference));
  perform public.notify_return_event(p_return_request_id, 'refunded', 'seller',
    null, row_return.refund_amount);
  return true;
end;
$$;

create or replace function public.admin_refund_return_anyway(
  p_return_request_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  old_status text;
begin
  if not coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) then
    raise exception 'Administrator access required';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Provide a reason for overriding the failed inspection';
  end if;
  select status into old_status
    from public.return_requests
   where id = p_return_request_id
   for update;
  if old_status <> 'inspection_failed' then
    raise exception 'Only a failed inspection can be overridden';
  end if;
  update public.return_requests
     set status = 'refund_pending', updated_at = now()
   where id = p_return_request_id;
  perform public.record_return_event(
    p_return_request_id, old_status, 'refund_pending',
    'admin_refund_anyway', trim(p_reason), 'admin'
  );
  perform public.notify_return_event(p_return_request_id, 'admin_refund_anyway', 'customer_and_seller', trim(p_reason));
  return true;
end;
$$;

alter table public.payouts
  add column if not exists adjustment_amount numeric(14,2) not null default 0;

-- Prevent the older trigger from overwriting cumulative refund totals.
drop trigger if exists return_financials_after_update on public.return_requests;

-- Replace the outbound assignment RPC so new outbound rows continue to be
-- explicitly typed and never conflict with a return pickup row.
create or replace function public.assign_delivery(target_shop_order_id uuid, target_rider_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_id uuid;
  expected numeric;
  active_count integer;
  max_count integer;
begin
  if not coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) then return null; end if;
  if not exists (select 1 from public.shop_orders where id = target_shop_order_id and lower(order_status) = 'ready_for_pickup') then return null; end if;
  select max_active_deliveries into max_count from public.delivery_profiles
   where id = target_rider_id and status = 'approved' and availability_status = 'available';
  if max_count is null then return null; end if;
  select count(*) into active_count from public.delivery_assignments
   where rider_id = target_rider_id
     and status in ('assigned','accepted','picked_up','out_for_delivery');
  if active_count >= max_count then return null; end if;
  select greatest(coalesce(nullif(so.gross_amount,0),
    (to_jsonb(so)->>'total_amount')::numeric,
    (to_jsonb(so)->>'subtotal')::numeric,0),0)
    into expected from public.shop_orders so where so.id = target_shop_order_id;
  insert into public.delivery_assignments (
    shop_order_id, return_request_id, assignment_type, rider_id, assigned_by, cod_expected_amount
  ) values (
    target_shop_order_id, null, 'delivery', target_rider_id, auth.uid(),
    case when lower(coalesce((select payment_method from public.shop_orders where id = target_shop_order_id),
                             'cash_on_delivery')) = 'cash_on_delivery' then expected else 0 end
  )
  on conflict (shop_order_id)
    where assignment_type = 'delivery' and shop_order_id is not null
  do update set rider_id = excluded.rider_id, assigned_by = excluded.assigned_by,
    status = 'assigned', rejection_reason = null, updated_at = now()
  returning id into assignment_id;
  insert into public.delivery_events(assignment_id,status,created_by)
  values (assignment_id,'assigned',auth.uid());
  return assignment_id;
end;
$$;

create or replace function public.update_delivery_assignment(
  target_assignment_id uuid,
  target_status text,
  target_collected_amount numeric default 0,
  target_failure_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_row public.delivery_assignments%rowtype;
  order_row public.shop_orders%rowtype;
  rider_row public.delivery_profiles%rowtype;
  now_time timestamptz := now();
  valid_transition boolean := false;
begin
  select * into assignment_row
    from public.delivery_assignments
   where id = target_assignment_id and assignment_type = 'delivery'
   for update;
  if not found then return false; end if;
  select * into rider_row from public.delivery_profiles where id = assignment_row.rider_id;
  if not (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
      or rider_row.user_id = auth.uid()) then return false; end if;
  select * into order_row from public.shop_orders where id = assignment_row.shop_order_id;
  if not found then return false; end if;

  valid_transition := (assignment_row.status = 'assigned' and target_status = 'accepted')
    or (assignment_row.status = 'accepted' and target_status = 'picked_up')
    or (assignment_row.status = 'picked_up' and target_status = 'out_for_delivery')
    or (assignment_row.status = 'out_for_delivery' and target_status = 'delivered')
    or (target_status = 'failed' and assignment_row.status in ('accepted', 'picked_up', 'out_for_delivery'));
  if not valid_transition then return false; end if;
  if target_status = 'failed' and nullif(trim(target_failure_reason), '') is null then return false; end if;
  if target_status = 'delivered'
     and lower(coalesce(order_row.payment_method, 'cash_on_delivery')) = 'cash_on_delivery'
     and target_collected_amount < assignment_row.cod_expected_amount then return false; end if;

  update public.delivery_assignments set
    status = target_status,
    accepted_at = case when target_status = 'accepted' then now_time else accepted_at end,
    picked_up_at = case when target_status = 'picked_up' then now_time else picked_up_at end,
    out_for_delivery_at = case when target_status = 'out_for_delivery' then now_time else out_for_delivery_at end,
    delivered_at = case when target_status = 'delivered' then now_time else delivered_at end,
    failed_at = case when target_status = 'failed' then now_time else failed_at end,
    failure_reason = case when target_status = 'failed' then trim(target_failure_reason) else failure_reason end,
    delivery_attempt_count = case when target_status = 'failed' then delivery_attempt_count + 1 else delivery_attempt_count end,
    cod_collected_amount = case when target_status = 'delivered' then target_collected_amount else cod_collected_amount end,
    cod_collected_at = case when target_status = 'delivered'
      and lower(coalesce(order_row.payment_method, 'cash_on_delivery')) = 'cash_on_delivery'
      then now_time else cod_collected_at end,
    updated_at = now_time
  where id = target_assignment_id and assignment_type = 'delivery';

  if target_status in ('picked_up', 'out_for_delivery', 'delivered') then
    update public.shop_orders set
      order_status = case when target_status = 'picked_up' then 'shipped'
        when target_status = 'out_for_delivery' then 'out_for_delivery' else 'delivered' end,
      cod_collected_amount = case when target_status = 'delivered' then target_collected_amount else cod_collected_amount end,
      cod_collected_at = case when target_status = 'delivered' then now_time else cod_collected_at end,
      cod_collection_status = case when target_status = 'delivered'
        and lower(coalesce(payment_method, 'cash_on_delivery')) = 'cash_on_delivery'
        then 'collected' else cod_collection_status end
     where id = assignment_row.shop_order_id;
  end if;
  if target_status = 'delivered'
     and lower(coalesce(order_row.payment_method, 'cash_on_delivery')) = 'cash_on_delivery' then
    update public.orders set payment_status = 'paid', paid_at = coalesce(paid_at, now_time)
     where id = order_row.parent_order_id and payment_method = 'cash_on_delivery';
  end if;
  insert into public.delivery_events(assignment_id,status,note,created_by)
  values (target_assignment_id,target_status,nullif(trim(target_failure_reason),''),auth.uid());
  return true;
end;
$$;

create or replace function public.reject_delivery_assignment(target_assignment_id uuid, target_reason text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_row public.delivery_assignments%rowtype;
  rider_row public.delivery_profiles%rowtype;
  shop_name text;
  order_label text;
begin
  select * into assignment_row from public.delivery_assignments
   where id = target_assignment_id and assignment_type = 'delivery'
   for update;
  if not found or assignment_row.status <> 'assigned' then return false; end if;
  select * into rider_row from public.delivery_profiles where id = assignment_row.rider_id;
  if rider_row.user_id <> auth.uid() or nullif(trim(target_reason), '') is null then return false; end if;
  select s.name into shop_name from public.shop_orders so
    join public.shops s on s.id = so.shop_id where so.id = assignment_row.shop_order_id;
  order_label := 'Shop Order #' || left(assignment_row.shop_order_id::text, 8);
  update public.delivery_assignments set status = 'cancelled',
    rejection_reason = trim(target_reason), updated_at = now()
   where id = assignment_row.id and assignment_type = 'delivery';
  insert into public.delivery_events(assignment_id,status,note,created_by)
  values (assignment_row.id,'rejected',trim(target_reason),auth.uid());
  insert into public.notifications(user_id,type,title,body,message,entity_type,entity_id,entity_url)
  select recipient.user_id, 'delivery_rejected', 'Rider rejected delivery',
    order_label || ' from ' || coalesce(shop_name, 'the shop') || ' was rejected: ' || trim(target_reason),
    order_label || ' from ' || coalesce(shop_name, 'the shop') || ' was rejected: ' || trim(target_reason),
    'shop_order', assignment_row.shop_order_id, '/admin/deliveries'
  from (
    select s.owner_id as user_id from public.shop_orders so
      join public.shops s on s.id = so.shop_id
     where so.id = assignment_row.shop_order_id and s.owner_id is not null
  ) recipient;
  return true;
end;
$$;

-- Riders continue to use the existing outbound tables only for outbound work.
drop policy if exists "Riders can read assigned deliveries" on public.delivery_assignments;
create policy "Riders can read assigned deliveries" on public.delivery_assignments
  for select to authenticated
  using (assignment_type = 'delivery' and exists (
    select 1 from public.delivery_profiles p where p.id = rider_id and p.user_id = auth.uid()
  ));
drop policy if exists "Riders can read own return pickup assignments" on public.delivery_assignments;
create policy "Riders can read own return pickup assignments" on public.delivery_assignments
  for select to authenticated
  using (
    assignment_type = 'return_pickup'
    and exists (
      select 1 from public.delivery_profiles p
       where p.id = rider_id and p.user_id = auth.uid()
    )
  );
drop policy if exists "Riders can update assigned deliveries" on public.delivery_assignments;
create policy "Riders can update assigned deliveries" on public.delivery_assignments
  for update to authenticated
  using (assignment_type = 'delivery' and exists (
    select 1 from public.delivery_profiles p where p.id = rider_id and p.user_id = auth.uid()
  ))
  with check (assignment_type = 'delivery' and exists (
    select 1 from public.delivery_profiles p where p.id = rider_id and p.user_id = auth.uid()
  ));
drop policy if exists "Riders can read own delivery events" on public.delivery_events;
create policy "Riders can read own delivery events" on public.delivery_events
  for select to authenticated
  using (exists (
    select 1 from public.delivery_assignments a
    join public.delivery_profiles p on p.id = a.rider_id
    where a.id = assignment_id and a.assignment_type = 'delivery' and p.user_id = auth.uid()
  ));
drop policy if exists "Admins can manage delivery assignments" on public.delivery_assignments;
drop policy if exists "Admins can manage outbound delivery assignments" on public.delivery_assignments;
create policy "Admins can manage outbound delivery assignments"
  on public.delivery_assignments for all to authenticated
  using (
    assignment_type = 'delivery'
    and coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  )
  with check (
    assignment_type = 'delivery'
    and coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  );
drop policy if exists "Admins can read return pickup assignments" on public.delivery_assignments;
create policy "Admins can read return pickup assignments"
  on public.delivery_assignments for select to authenticated
  using (
    assignment_type = 'return_pickup'
    and coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  );

-- Return evidence is private; authenticated paths are namespaced by uploader.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'return-evidence',
  'return-evidence',
  false,
  8388608,
  array['image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Customers sellers admins can read return evidence objects" on storage.objects;
drop policy if exists "Customers can upload return evidence objects" on storage.objects;
drop policy if exists "Evidence owners can delete unattached return evidence" on storage.objects;
create policy "Customers can upload return evidence objects"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'return-evidence' and split_part(name,'/',1) = auth.uid()::text);
create policy "Customers sellers admins can read return evidence objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'return-evidence'
    and (
      exists (
        select 1 from public.return_evidence e
        join public.return_requests rr on rr.id = e.return_request_id
        where e.object_path = name
          and (rr.customer_id = auth.uid() or public.is_return_shop_staff(rr.id)
               or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean,false))
      )
      or split_part(name,'/',1) = auth.uid()::text
    )
  );
create policy "Evidence owners can delete unattached return evidence"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'return-evidence'
    and split_part(name,'/',1) = auth.uid()::text
    and not exists (select 1 from public.return_evidence e where e.object_path = name)
  );

-- Seed audit history for migrated legacy rows without changing their status.
insert into public.return_events (
  return_request_id, from_status, to_status, event_type, note, actor_role, metadata
)
select rr.id, null, rr.status, 'legacy_migrated',
       'Existing return request migrated without changing its original status.',
       'system', jsonb_build_object('legacy_reason', rr.reason)
  from public.return_requests rr
 where not exists (
   select 1 from public.return_events re
    where re.return_request_id = rr.id
 );

create or replace function public.prevent_return_event_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Return event history is append-only';
end;
$$;
drop trigger if exists return_events_append_only on public.return_events;
create trigger return_events_append_only
before update or delete on public.return_events
for each row execute function public.prevent_return_event_mutation();

create or replace function public.validate_return_evidence_photo_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reason_code text;
  current_count integer;
begin
  select rr.reason_code into reason_code from public.return_requests rr where rr.id = new.return_request_id;
  select count(*) into current_count from public.return_evidence e where e.return_request_id = new.return_request_id;
  if current_count >= 4 then raise exception 'A return may have at most four photos'; end if;
  if new.evidence_type = 'photo' and new.content_type is not null
     and new.content_type not like 'image/%' then raise exception 'Return evidence must be an image'; end if;
  return new;
end;
$$;
drop trigger if exists return_evidence_validate on public.return_evidence;
create trigger return_evidence_validate before insert on public.return_evidence
for each row execute function public.validate_return_evidence_photo_count();

-- Limit rider access to return details to the purpose-built, amount-free RPC.
revoke all on public.return_requests, public.return_items, public.return_evidence,
  public.return_events, public.return_refund_accounts,
  public.return_customer_pickup_codes, public.return_notification_dedupe
  from anon;
revoke insert, update, delete on public.return_requests, public.return_items,
  public.return_evidence, public.return_events, public.return_refund_accounts,
  public.return_customer_pickup_codes, public.return_notification_dedupe
  from authenticated;

revoke all on function public.create_return_request(uuid,jsonb,text,text,text[],text,text,text,text) from public;
revoke all on function public.seller_respond_return(uuid,text,text) from public;
revoke all on function public.get_customer_return_pickup_code(uuid) from public;
revoke all on function public.get_customer_return_rider_details(uuid) from public;
revoke all on function public.cancel_return_request(uuid,text) from public;
revoke all on function public.escalate_return_request(uuid,text) from public;
revoke all on function public.admin_decide_return(uuid,text,text) from public;
revoke all on function public.assign_return_pickup(uuid,uuid) from public;
revoke all on function public.get_rider_return_pickup_details(uuid) from public;
revoke all on function public.get_rider_return_assignments() from public;
revoke all on function public.update_return_pickup(uuid,text,text,text,text) from public;
revoke all on function public.seller_inspect_return(uuid,boolean,text,text[]) from public;
revoke all on function public.seller_confirm_return_receipt(uuid) from public;
revoke all on function public.seller_report_return_not_received(uuid,text) from public;
revoke all on function public.get_shop_return_rider_details(uuid) from public;
revoke all on function public.notify_return_event(uuid,text,text,text,numeric,text,text) from public;
revoke all on function public.notify_return_response_reminders() from public;
revoke all on function public.admin_mark_return_refunded(uuid,text,text) from public;
revoke all on function public.admin_refund_return_anyway(uuid,text) from public;
grant execute on function public.create_return_request(uuid,jsonb,text,text,text[],text,text,text,text) to authenticated;
grant execute on function public.seller_respond_return(uuid,text,text) to authenticated;
grant execute on function public.get_customer_return_pickup_code(uuid) to authenticated;
grant execute on function public.get_customer_return_rider_details(uuid) to authenticated;
grant execute on function public.cancel_return_request(uuid,text) to authenticated;
grant execute on function public.escalate_return_request(uuid,text) to authenticated;
grant execute on function public.admin_decide_return(uuid,text,text) to authenticated;
grant execute on function public.assign_return_pickup(uuid,uuid) to authenticated;
grant execute on function public.get_rider_return_pickup_details(uuid) to authenticated;
grant execute on function public.get_rider_return_assignments() to authenticated;
grant execute on function public.update_return_pickup(uuid,text,text,text,text) to authenticated;
grant execute on function public.seller_inspect_return(uuid,boolean,text,text[]) to authenticated;
grant execute on function public.seller_confirm_return_receipt(uuid) to authenticated;
grant execute on function public.seller_report_return_not_received(uuid,text) to authenticated;
grant execute on function public.get_shop_return_rider_details(uuid) to authenticated;
grant execute on function public.admin_mark_return_refunded(uuid,text,text) to authenticated;
grant execute on function public.admin_refund_return_anyway(uuid,text) to authenticated;
grant execute on function public.notify_return_response_reminders() to service_role;

do $$
declare
  existing_job bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and to_regclass('cron.job') is not null then
    execute 'select jobid from cron.job where jobname = $1'
      into existing_job using 'return-response-reminders';
    if existing_job is not null then
      execute 'select cron.unschedule($1)' using existing_job;
    end if;
    execute 'select cron.schedule($1, $2, $3)'
      into existing_job
      using 'return-response-reminders', '*/15 * * * *',
            'select public.notify_return_response_reminders()';
  end if;
end;
$$;
