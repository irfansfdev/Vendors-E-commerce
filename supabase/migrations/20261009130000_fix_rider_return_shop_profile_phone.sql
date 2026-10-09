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
  select jsonb_build_object('name', s.name) into shop_json
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
    'shop_phone', '',
    'shop_address', '',
    'rider_handover_code', assignment_row.return_handover_code,
    'items', item_json
  );
end;
$$;

revoke all on function public.get_rider_return_pickup_details(uuid) from public;
grant execute on function public.get_rider_return_pickup_details(uuid) to authenticated;
