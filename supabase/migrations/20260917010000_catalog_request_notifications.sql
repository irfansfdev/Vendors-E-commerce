-- Notify admins about shop/product requests and owners about review decisions.
alter table public.notifications add column if not exists entity_url text;

create or replace function public.create_business_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_user record;
  owner_id uuid;
  item_name text;
  item_slug text;
  next_status text;
  decision_label text;
  target_url text;
begin
  if tg_table_name = 'shops' then
    item_name := coalesce(to_jsonb(new)->>'name', 'Your shop');
    next_status := coalesce(to_jsonb(new)->>'status', 'pending');
    if tg_op = 'INSERT' and next_status = 'pending' then
      for admin_user in select id from auth.users where coalesce((raw_app_meta_data->>'is_admin')::boolean, false) loop
        insert into public.notifications (user_id, shop_id, type, title, body, message, entity_type, entity_id, entity_url)
        values (admin_user.id, new.id, 'shop_request', 'New shop request', item_name || ' has been submitted for approval.', item_name || ' has been submitted for approval.', 'shop', new.id, '/admin/shops');
      end loop;
    elsif tg_op = 'UPDATE' and to_jsonb(new)->>'status' is distinct from to_jsonb(old)->>'status' then
      target_url := '/seller';
      decision_label := case when next_status = 'active' then 'approved' else next_status end;
      insert into public.notifications (user_id, shop_id, type, title, body, message, entity_type, entity_id, entity_url)
      values (new.owner_id, new.id, 'shop_status', 'Shop decision for ' || item_name, 'Your shop "' || item_name || '" has been ' || decision_label || '.', 'Your shop "' || item_name || '" has been ' || decision_label || '.', 'shop', new.id, target_url);
    end if;
  elsif tg_table_name = 'products' then
    item_name := coalesce(to_jsonb(new)->>'name', to_jsonb(new)->>'title', 'Your product');
    item_slug := coalesce(to_jsonb(new)->>'slug', to_jsonb(new)->>'id');
    next_status := coalesce(to_jsonb(new)->>'status', 'draft');
    select s.owner_id into owner_id from public.shops s where s.id = new.shop_id;
    if tg_op = 'INSERT' and next_status in ('draft', 'pending') then
      for admin_user in select id from auth.users where coalesce((raw_app_meta_data->>'is_admin')::boolean, false) loop
        insert into public.notifications (user_id, shop_id, type, title, body, message, entity_type, entity_id, entity_url)
        values (admin_user.id, new.shop_id, 'product_request', 'Product approval needed: ' || item_name, '"' || item_name || '" has been submitted and is waiting for your approval. Open Product Requests to review it.', '"' || item_name || '" has been submitted and is waiting for your approval. Open Product Requests to review it.', 'product', new.id, '/admin/products?status=pending');
      end loop;
    elsif tg_op = 'UPDATE' and to_jsonb(new)->>'status' is distinct from to_jsonb(old)->>'status' and owner_id is not null then
      target_url := case when next_status = 'published' and nullif(to_jsonb(new)->>'slug', '') is not null then '/product/' || item_slug else '/seller/products/' || new.id || '/edit' end;
      decision_label := case when next_status = 'published' then 'approved and is now live' when next_status = 'archived' and to_jsonb(old)->>'status' = 'pending' then 'rejected' when next_status = 'archived' then 'archived' else next_status end;
      insert into public.notifications (user_id, shop_id, type, title, body, message, entity_type, entity_id, entity_url)
      values (owner_id, new.shop_id, 'product_status', 'Product decision for ' || item_name, 'Your product "' || item_name || '" has been ' || decision_label || '.', 'Your product "' || item_name || '" has been ' || decision_label || '.', 'product', new.id, target_url);
    end if;
  elsif tg_table_name = 'product_reviews' and to_jsonb(new)->>'status' is distinct from to_jsonb(old)->>'status' then
    insert into public.notifications (user_id, type, title, body, message, entity_type, entity_id, entity_url)
    values (new.user_id, 'review_status', 'Review status updated', 'Your product review was ' || (to_jsonb(new)->>'status') || '.', 'Your product review was ' || (to_jsonb(new)->>'status') || '.', 'review', new.id, '/account/orders');
  elsif tg_table_name = 'orders' and (tg_op = 'INSERT' or coalesce(to_jsonb(new)->>'status', to_jsonb(new)->>'order_status') is distinct from coalesce(to_jsonb(old)->>'status', to_jsonb(old)->>'order_status')) then
    next_status := coalesce(to_jsonb(new)->>'status', to_jsonb(new)->>'order_status', 'pending');
    insert into public.notifications (user_id, type, title, body, message, entity_type, entity_id, entity_url)
    values (new.customer_id, case when tg_op = 'INSERT' then 'order_created' else 'order_status' end, case when tg_op = 'INSERT' then 'Order received' else 'Order status updated' end, case when tg_op = 'INSERT' then 'Your order has been received.' else 'Your order is now ' || next_status || '.' end, case when tg_op = 'INSERT' then 'Your order has been received.' else 'Your order is now ' || next_status || '.' end, 'order', new.id, '/account/orders/' || new.id);
  end if;
  return new;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'shops_request_notification') then
    create trigger shops_request_notification after insert on public.shops for each row execute function public.create_business_notification();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'products_business_notification') then
    create trigger products_business_notification after insert or update of status on public.products for each row execute function public.create_business_notification();
  end if;
end $$;
