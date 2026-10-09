-- Keep the assignment conflict target identical to its partial unique index.
drop index if exists public.delivery_assignments_one_pickup_per_return;
create unique index delivery_assignments_one_pickup_per_return
  on public.delivery_assignments(return_request_id)
  where assignment_type = 'return_pickup' and return_request_id is not null;

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
    shop_order_id, return_request_id, assignment_type, rider_id, assigned_by, status,
    return_handover_code
  ) values (
    null, p_return_request_id, 'return_pickup', p_rider_id, auth.uid(), 'assigned',
    lpad(floor(random() * 1000000)::integer::text, 6, '0')
  )
  on conflict (return_request_id)
    where assignment_type = 'return_pickup' and return_request_id is not null
  do update set rider_id = excluded.rider_id, assigned_by = excluded.assigned_by,
    status = 'assigned', assigned_at = now(), updated_at = now(), failure_reason = null,
    return_handover_code = excluded.return_handover_code
  returning id into assignment_id;

  update public.return_requests set status = 'pickup_assigned',
    delivery_assignment_id = assignment_id, updated_at = now()
   where id = p_return_request_id;
  insert into public.delivery_events(assignment_id, status, note, created_by)
  values (assignment_id, 'assigned', 'Return pickup assigned', auth.uid());
  perform public.record_return_event(p_return_request_id, 'approved', 'pickup_assigned',
    'return_pickup_assigned', null, 'admin');
  insert into public.notifications(user_id, type, title, body, message, entity_type, entity_id, entity_url)
  select dp.user_id, 'return_pickup_assigned', 'Return pickup assigned',
    'You have a return pickup assignment.', 'You have a return pickup assignment.',
    'delivery_assignment', assignment_id, '/rider/assignments/' || assignment_id::text
    from public.delivery_profiles dp where dp.id = p_rider_id and dp.user_id is not null;
  return assignment_id;
end;
$$;

revoke all on function public.assign_return_pickup(uuid, uuid) from public;
grant execute on function public.assign_return_pickup(uuid, uuid) to authenticated;
