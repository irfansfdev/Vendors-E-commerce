-- Calculate rider COD amount from the real shop-order line items when derived totals are empty.
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
  select max_active_deliveries into max_count from public.delivery_profiles where id = target_rider_id and status = 'approved' and availability_status = 'available';
  if max_count is null then return null; end if;
  select count(*) into active_count from public.delivery_assignments where rider_id = target_rider_id and status in ('assigned', 'accepted', 'picked_up', 'out_for_delivery');
  if active_count >= max_count then return null; end if;
  select greatest(
    coalesce(nullif(so.gross_amount, 0), nullif(so.total_amount, 0), nullif(so.subtotal, 0), 0),
    coalesce((select sum(coalesce(oi.quantity, 0) * coalesce(pv.price, p.price, 0))
      from public.order_items oi
      join public.product_variants pv on pv.id = oi.variant_id
      join public.products p on p.id = pv.product_id
      where oi.shop_order_id = so.id), 0)
  ) into expected
  from public.shop_orders so
  where so.id = target_shop_order_id;
  insert into public.delivery_assignments (shop_order_id, rider_id, assigned_by, cod_expected_amount)
  values (target_shop_order_id, target_rider_id, auth.uid(), case when lower(coalesce((select payment_method from public.shop_orders where id = target_shop_order_id), 'cash_on_delivery')) = 'cash_on_delivery' then coalesce(expected, 0) else 0 end)
  on conflict (shop_order_id) do update
    set rider_id = excluded.rider_id, assigned_by = excluded.assigned_by, status = 'assigned', rejection_reason = null, cod_expected_amount = excluded.cod_expected_amount, updated_at = now()
  returning id into assignment_id;
  insert into public.delivery_events (assignment_id, status, created_by) values (assignment_id, 'assigned', auth.uid());
  return assignment_id;
end;
$$;

grant execute on function public.assign_delivery(uuid, uuid) to authenticated;
