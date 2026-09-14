-- Keep customers informed when an order is created or its fulfillment changes.
create or replace function public.create_business_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  order_state text;
  customer_id uuid;
  notification_title text;
  notification_body text;
  notification_order_id uuid;
  notification_shop_id uuid;
begin
  if tg_table_name = 'orders' then
    if tg_op = 'UPDATE'
      and coalesce(to_jsonb(old)->>'status', to_jsonb(old)->>'order_status', 'pending')
          = coalesce(to_jsonb(new)->>'status', to_jsonb(new)->>'order_status', 'pending') then
      return new;
    end if;
    order_state := lower(coalesce(to_jsonb(new)->>'status', to_jsonb(new)->>'order_status', 'pending'));
    customer_id := new.customer_id;
    notification_order_id := new.id;
  elsif tg_table_name = 'shop_orders' then
    if tg_op = 'UPDATE' and old.order_status is not distinct from new.order_status then
      return new;
    end if;
    select o.customer_id, o.id
      into customer_id, notification_order_id
      from public.orders o
     where o.id = new.parent_order_id;
    notification_shop_id := new.shop_id;
    order_state := lower(coalesce(new.order_status, 'pending'));
  else
    return new;
  end if;

  if tg_op = 'INSERT' then
    notification_title := 'Order placed';
    notification_body := 'You have placed an order successfully.';
  else
    notification_title := case order_state
      when 'pending' then 'Order received'
      when 'confirmed' then 'Order confirmed'
      when 'processing' then 'Order is being prepared'
      when 'shipped' then 'Your order is on the way'
      when 'delivered' then 'Order delivered'
      when 'completed' then 'Order completed'
      when 'cancelled' then 'Order cancelled'
      else 'Order status updated'
    end;
    notification_body := case order_state
      when 'pending' then 'Your order is waiting to be processed.'
      when 'confirmed' then 'The shop has confirmed your order.'
      when 'processing' then 'The shop is preparing your order.'
      when 'shipped' then 'Your order has shipped and is on the way.'
      when 'delivered' then 'Your order has been delivered.'
      when 'completed' then 'Your order has been completed. Thank you for shopping with us.'
      when 'cancelled' then 'Your order has been cancelled.'
      else 'Your order status is now ' || order_state || '.'
    end;
  end if;

  if customer_id is not null and (tg_table_name = 'orders' or tg_op <> 'INSERT') then
    begin
      insert into public.notifications (user_id, type, title, body, message, entity_type, entity_id)
      values (
        customer_id,
        case when tg_op = 'INSERT' then 'order_created' else 'order_status' end,
        notification_title,
        notification_body,
        notification_body,
        'order',
        notification_order_id
      );
    exception when others then
      raise warning 'Order notification was not created: %', sqlerrm;
    end;
  end if;

  if tg_table_name = 'shop_orders' and tg_op = 'INSERT' and notification_shop_id is not null then
    begin
      insert into public.notifications (user_id, shop_id, type, title, body, message, entity_type, entity_id)
      select recipient.user_id,
        notification_shop_id,
        'seller_order_created',
        'New order received',
        'Someone ordered a product from your shop.',
        'Someone ordered a product from your shop.',
        'order',
        new.id
      from (
        select s.owner_id as user_id
          from public.shops s
         where s.id = notification_shop_id
        union
        select sm.user_id
          from public.shop_members sm
         where sm.shop_id = notification_shop_id
           and sm.role in ('owner', 'manager')
      ) recipient
      where recipient.user_id is not null;
    exception when others then
      raise warning 'Seller order notification was not created: %', sqlerrm;
    end;
  end if;

  return new;
end
$$;

drop trigger if exists shop_orders_business_notification on public.shop_orders;
create trigger shop_orders_business_notification
after insert or update on public.shop_orders
for each row
execute function public.create_business_notification();

do $$
begin
  drop trigger if exists orders_business_notification on public.orders;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'status') then
    execute 'create trigger orders_business_notification after insert or update of status on public.orders for each row execute function public.create_business_notification()';
  elsif exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'order_status') then
    execute 'create trigger orders_business_notification after insert or update of order_status on public.orders for each row execute function public.create_business_notification()';
  else
    execute 'create trigger orders_business_notification after insert on public.orders for each row execute function public.create_business_notification()';
  end if;
end
$$;