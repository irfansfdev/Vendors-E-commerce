-- Complete shop-order delivery workflow. This migration extends the existing delivery model.

alter table public.delivery_profiles add column if not exists availability_status text not null default 'available';
alter table public.delivery_profiles add column if not exists current_latitude numeric(9,6);
alter table public.delivery_profiles add column if not exists current_longitude numeric(9,6);
alter table public.delivery_profiles add column if not exists last_location_updated_at timestamptz;
alter table public.delivery_profiles add column if not exists max_active_deliveries integer not null default 2;

do $$
begin
  alter table public.delivery_profiles add constraint delivery_profiles_availability_check
    check (availability_status in ('available', 'busy', 'offline'));
exception when duplicate_object then null;
end $$;

alter table public.delivery_assignments add column if not exists rejection_reason text;
alter table public.delivery_assignments add column if not exists issue_type text;
alter table public.delivery_assignments add column if not exists issue_note text;
alter table public.delivery_assignments add column if not exists delivery_attempt_count integer not null default 0;

create index if not exists delivery_profiles_assignment_search_idx
  on public.delivery_profiles(status, availability_status, last_location_updated_at);

-- Rider assignment is a Super Admin operation. Shop staff may only prepare and announce readiness.
create or replace function public.assign_delivery(target_shop_order_id uuid, target_rider_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare assignment_id uuid; expected numeric; active_count integer; max_count integer;
begin
  if not coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) then return null; end if;
  if not exists (select 1 from public.shop_orders where id = target_shop_order_id and lower(order_status) = 'ready_for_pickup') then return null; end if;
  select max_active_deliveries into max_count from public.delivery_profiles where id = target_rider_id and status = 'approved' and availability_status = 'available';
  if max_count is null then return null; end if;
  select count(*) into active_count from public.delivery_assignments where rider_id = target_rider_id and status in ('assigned', 'accepted', 'picked_up', 'out_for_delivery');
  if active_count >= max_count then return null; end if;
  select greatest(coalesce(nullif(so.gross_amount, 0), (to_jsonb(so) ->> 'total_amount')::numeric, (to_jsonb(so) ->> 'subtotal')::numeric, 0), 0) into expected from public.shop_orders so where so.id = target_shop_order_id;
  insert into public.delivery_assignments (shop_order_id, rider_id, assigned_by, cod_expected_amount)
  values (target_shop_order_id, target_rider_id, auth.uid(), case when lower(coalesce((select payment_method from public.shop_orders where id = target_shop_order_id), 'cash_on_delivery')) = 'cash_on_delivery' then expected else 0 end)
  on conflict (shop_order_id) do update set rider_id = excluded.rider_id, assigned_by = excluded.assigned_by, status = 'assigned', rejection_reason = null, updated_at = now()
  returning id into assignment_id;
  insert into public.delivery_events (assignment_id, status, created_by) values (assignment_id, 'assigned', auth.uid());
  return assignment_id;
end;
$$;

grant execute on function public.assign_delivery(uuid, uuid) to authenticated;

-- Extend the existing parent roll-up so a ready shop-order is still in progress.
create or replace function public.refresh_order_overall_status(target_parent_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare total_count integer; cancelled_count integer; delivered_count integer; shipped_count integer; processing_count integer; next_status text;
begin
  select count(*), count(*) filter (where lower(coalesce(order_status, 'pending')) = 'cancelled'), count(*) filter (where lower(coalesce(order_status, 'pending')) in ('delivered', 'completed')), count(*) filter (where lower(coalesce(order_status, 'pending')) in ('shipped', 'out_for_delivery')), count(*) filter (where lower(coalesce(order_status, 'pending')) in ('processing', 'confirmed', 'ready_for_pickup')) into total_count, cancelled_count, delivered_count, shipped_count, processing_count from public.shop_orders where parent_order_id = target_parent_order_id;
  next_status := case when total_count = 0 then 'pending' when cancelled_count = total_count then 'cancelled' when delivered_count = total_count then 'delivered' when delivered_count > 0 then 'partially_delivered' when shipped_count > 0 then 'partially_shipped' when processing_count > 0 then 'processing' else 'pending' end;
  update public.orders set order_status = next_status where id = target_parent_order_id;
end;
$$;

-- Replace the permissive RPC with a transition-guarded version. Financial settlement remains
-- owned by the existing shop-order settlement triggers.
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
  select * into assignment_row from public.delivery_assignments where id = target_assignment_id for update;
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
    cod_collected_at = case when target_status = 'delivered' and lower(coalesce(order_row.payment_method, 'cash_on_delivery')) = 'cash_on_delivery' then now_time else cod_collected_at end,
    updated_at = now_time
  where id = target_assignment_id;

  if target_status in ('picked_up', 'out_for_delivery', 'delivered') then
    update public.shop_orders set
      order_status = case when target_status = 'picked_up' then 'shipped' when target_status = 'out_for_delivery' then 'out_for_delivery' else 'delivered' end,
      cod_collected_amount = case when target_status = 'delivered' then target_collected_amount else cod_collected_amount end,
      cod_collected_at = case when target_status = 'delivered' then now_time else cod_collected_at end,
      cod_collection_status = case when target_status = 'delivered' and lower(coalesce(payment_method, 'cash_on_delivery')) = 'cash_on_delivery' then 'collected' else cod_collection_status end
    where id = assignment_row.shop_order_id;
  end if;
  if target_status = 'delivered' and lower(coalesce(order_row.payment_method, 'cash_on_delivery')) = 'cash_on_delivery' then
    update public.orders set payment_status = 'paid', paid_at = coalesce(paid_at, now_time)
     where id = order_row.parent_order_id and payment_method = 'cash_on_delivery';
  end if;
  insert into public.delivery_events (assignment_id, status, note, created_by)
  values (target_assignment_id, target_status, nullif(trim(target_failure_reason), ''), auth.uid());
  return true;
end;
$$;

grant execute on function public.update_delivery_assignment(uuid, text, numeric, text) to authenticated;

create or replace function public.reject_delivery_assignment(target_assignment_id uuid, target_reason text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare a public.delivery_assignments%rowtype; r public.delivery_profiles%rowtype; shop_name text; order_label text;
begin
  select * into a from public.delivery_assignments where id = target_assignment_id for update;
  if not found or a.status <> 'assigned' then return false; end if;
  select * into r from public.delivery_profiles where id = a.rider_id;
  if r.user_id <> auth.uid() or nullif(trim(target_reason), '') is null then return false; end if;
  select s.name into shop_name from public.shop_orders so join public.shops s on s.id = so.shop_id where so.id = a.shop_order_id;
  order_label := 'Shop Order #' || left(a.shop_order_id::text, 8);
  update public.delivery_assignments set status = 'cancelled', rejection_reason = trim(target_reason), updated_at = now() where id = a.id;
  insert into public.delivery_events (assignment_id, status, note, created_by) values (a.id, 'rejected', trim(target_reason), auth.uid());
  insert into public.notifications (user_id, type, title, body, message, entity_type, entity_id, entity_url)
  select recipient.user_id, 'delivery_rejected', 'Rider rejected delivery', order_label || ' from ' || coalesce(shop_name, 'the shop') || ' was rejected: ' || trim(target_reason), order_label || ' from ' || coalesce(shop_name, 'the shop') || ' was rejected: ' || trim(target_reason), 'shop_order', a.shop_order_id, '/admin/deliveries'
    from (select s.owner_id as user_id from public.shop_orders so join public.shops s on s.id = so.shop_id where so.id = a.shop_order_id and s.owner_id is not null) recipient;
  return true;
end;
$$;

grant execute on function public.reject_delivery_assignment(uuid, text) to authenticated;

-- Event-based, actionable notifications for the rider and customer. The unique event row
-- prevents dashboard re-renders from producing duplicates.
create or replace function public.notify_delivery_assignment_event()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  rider_user uuid; customer_user uuid; shop_name text; order_id uuid; order_label text; title text; body text; route text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  select dp.user_id, s.name, o.parent_order_id into rider_user, shop_name, order_id
    from public.delivery_profiles dp join public.shop_orders o on o.id = new.shop_order_id join public.shops s on s.id = o.shop_id where dp.id = new.rider_id;
  select o.customer_id into customer_user from public.orders o where o.id = order_id;
  order_label := 'Shop Order #' || left(new.shop_order_id::text, 8);
  route := case when rider_user is not null then '/rider/assignments/' || new.id::text else '/account/orders/' || order_id::text end;
  title := case new.status when 'assigned' then 'New delivery assigned' when 'picked_up' then 'Order picked up' when 'out_for_delivery' then 'Your order is on the way' when 'delivered' then 'Order delivered' when 'failed' then 'Delivery attempt needs attention' else 'Delivery updated' end;
  body := case new.status
    when 'assigned' then 'You have been assigned ' || order_label || ' from ' || coalesce(shop_name, 'a shop') || '.'
    when 'picked_up' then order_label || ' from ' || coalesce(shop_name, 'the shop') || ' has been picked up.'
    when 'out_for_delivery' then 'Your order from ' || coalesce(shop_name, 'the shop') || ' is on the way. ' || order_label || ' is in progress.'
    when 'delivered' then 'Your order from ' || coalesce(shop_name, 'the shop') || ' was delivered successfully. ' || order_label || ' is complete.'
    when 'failed' then 'Delivery for ' || order_label || ' from ' || coalesce(shop_name, 'the shop') || ' could not be completed. Check the delivery details for the next step.'
    else 'Delivery for ' || order_label || ' from ' || coalesce(shop_name, 'the shop') || ' was updated.'
  end;
  if rider_user is not null and new.status = 'assigned' then
    insert into public.notifications (user_id, type, title, body, message, entity_type, entity_id, entity_url)
    select rider_user, 'order_assigned', title, body, body, 'delivery_assignment', new.id, '/rider/assignments/' || new.id::text
    where not exists (select 1 from public.notifications n where n.user_id = rider_user and n.type = 'order_assigned' and n.entity_id = new.id);
  end if;
  if customer_user is not null and new.status in ('picked_up', 'out_for_delivery', 'delivered', 'failed') then
    insert into public.notifications (user_id, type, title, body, message, entity_type, entity_id, entity_url)
    select customer_user, lower(new.status), title, body, body, 'order', order_id, '/account/orders/' || order_id::text
    where not exists (select 1 from public.notifications n where n.user_id = customer_user and n.type = lower(new.status) and n.entity_id = order_id and n.created_at > now() - interval '1 minute');
  end if;
  return new;
end;
$$;

drop trigger if exists delivery_assignment_event_notification on public.delivery_assignments;
create trigger delivery_assignment_event_notification
after insert or update of status on public.delivery_assignments
for each row execute function public.notify_delivery_assignment_event();

-- Only ready shop-orders enter the assignment queue; each shop-order is independent.
create or replace function public.notify_shop_order_ready_for_pickup()
returns trigger language plpgsql security definer set search_path = public
as $$
declare shop_name text; label text; recipient record;
begin
  if lower(coalesce(new.order_status, '')) = 'ready_for_pickup' and lower(coalesce(old.order_status, '')) <> 'ready_for_pickup' then
    select name into shop_name from public.shops where id = new.shop_id;
    label := 'Shop Order #' || left(new.id::text, 8);
    for recipient in select id from auth.users where coalesce((raw_app_meta_data->>'is_admin')::boolean, false) loop
      if not exists (select 1 from public.notifications n where n.user_id = recipient.id and n.type = 'shop_order_ready' and n.entity_id = new.id) then
        insert into public.notifications (user_id, shop_id, type, title, body, message, entity_type, entity_id, entity_url)
        values (recipient.id, new.shop_id, 'shop_order_ready', 'Shop order ready for pickup', label || ' from ' || coalesce(shop_name, 'the shop') || ' is ready for rider assignment.', label || ' from ' || coalesce(shop_name, 'the shop') || ' is ready for rider assignment.', 'shop_order', new.id, '/admin/deliveries');
      end if;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists shop_order_ready_for_pickup_notification on public.shop_orders;
create trigger shop_order_ready_for_pickup_notification
after update of order_status on public.shop_orders
for each row execute function public.notify_shop_order_ready_for_pickup();
