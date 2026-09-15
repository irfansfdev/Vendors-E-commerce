create or replace function public.notify_review_available_after_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_id uuid;
  product_row record;
begin
  if lower(coalesce(new.order_status, 'pending')) not in ('delivered', 'completed')
     or lower(coalesce(old.order_status, 'pending')) in ('delivered', 'completed') then
    return new;
  end if;

  select o.customer_id into customer_id from public.orders o where o.id = new.parent_order_id;
  if customer_id is null then return new; end if;

  for product_row in
    select distinct pv.product_id
      from public.order_items oi
      join public.product_variants pv on pv.id = coalesce(
        nullif(to_jsonb(oi)->>'product_variant_id', '')::uuid,
        nullif(to_jsonb(oi)->>'variant_id', '')::uuid
      )
     where oi.shop_order_id = new.id
  loop
    insert into public.notifications (user_id, type, title, body, message, entity_type, entity_id)
    select customer_id, 'review_available', 'Your order has arrived',
      'Your delivery is complete. Share your experience by reviewing this product.',
      'Your delivery is complete. Share your experience by reviewing this product.',
      'product', product_row.product_id
    where not exists (
      select 1 from public.notifications n
       where n.user_id = customer_id and n.type = 'review_available'
         and n.entity_type = 'product' and n.entity_id = product_row.product_id
         and n.created_at > now() - interval '30 days'
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists review_available_after_delivery on public.shop_orders;
create trigger review_available_after_delivery
after update of order_status on public.shop_orders
for each row execute function public.notify_review_available_after_delivery();
