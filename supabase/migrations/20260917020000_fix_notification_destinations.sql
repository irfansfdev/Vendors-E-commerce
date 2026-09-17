-- Shop requests are actionable from the admin shop request list, not a shop detail route.
update public.notifications
set entity_url = '/admin/shops'
where type = 'shop_request';

-- Keep product requests actionable from the admin product review screen.
update public.notifications
set entity_url = '/admin/products/' || entity_id || '/edit'
where type = 'product_request'
  and entity_id is not null;

update public.notifications
set entity_url = '/admin/products?status=pending'
where type = 'product_request';

-- A product approval should never use a UUID as a storefront slug.
update public.notifications n
set entity_url = '/seller/products/' || n.entity_id || '/edit'
where n.type = 'product_status'
  and n.entity_id is not null
  and (n.entity_url is null or n.entity_url like '/product/%')
  and not exists (
    select 1 from public.products p
    where p.id = n.entity_id
      and nullif(p.slug, '') is not null
  );

-- Correct future shop-request inserts when the earlier notification trigger already exists.
create or replace function public.create_shop_request_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_user record;
  item_name text;
begin
  item_name := coalesce(to_jsonb(new)->>'name', 'A new shop');
  for admin_user in select id from auth.users where coalesce((raw_app_meta_data->>'is_admin')::boolean, false) loop
    insert into public.notifications (user_id, shop_id, type, title, body, message, entity_type, entity_id, entity_url)
    values (admin_user.id, new.id, 'shop_request', 'New shop request', item_name || ' has been submitted for approval.', item_name || ' has been submitted for approval.', 'shop', new.id, '/admin/shops');
  end loop;
  return new;
end;
$$;

drop trigger if exists shops_request_notification on public.shops;
create trigger shops_request_notification
after insert on public.shops
for each row execute function public.create_shop_request_notification();

-- Replace the earlier product trigger so deployed databases also get the corrected destinations.
create or replace function public.create_product_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_user record;
  owner_id uuid;
  item_name text;
  target_url text;
  decision_label text;
  next_status text;
begin
  item_name := coalesce(to_jsonb(new)->>'name', to_jsonb(new)->>'title', 'Your product');
  next_status := coalesce(to_jsonb(new)->>'status', 'draft');
  select s.owner_id into owner_id from public.shops s where s.id = new.shop_id;
  if tg_op = 'INSERT' and next_status in ('draft', 'pending') then
    for admin_user in select id from auth.users where coalesce((raw_app_meta_data->>'is_admin')::boolean, false) loop
      insert into public.notifications (user_id, shop_id, type, title, body, message, entity_type, entity_id, entity_url)
      values (admin_user.id, new.shop_id, 'product_request', 'Product approval needed: ' || item_name, '"' || item_name || '" has been submitted and is waiting for your approval. Open Product Requests to review it.', '"' || item_name || '" has been submitted and is waiting for your approval. Open Product Requests to review it.', 'product', new.id, '/admin/products?status=pending');
    end loop;
  elsif tg_op = 'UPDATE' and to_jsonb(new)->>'status' is distinct from to_jsonb(old)->>'status' and next_status = 'pending' then
    for admin_user in select id from auth.users where coalesce((raw_app_meta_data->>'is_admin')::boolean, false) loop
      insert into public.notifications (user_id, shop_id, type, title, body, message, entity_type, entity_id, entity_url)
      values (admin_user.id, new.shop_id, 'product_request', 'Product approval needed: ' || item_name, '"' || item_name || '" has been resubmitted for approval. Open Product Requests to review it.', '"' || item_name || '" has been resubmitted for approval. Open Product Requests to review it.', 'product', new.id, '/admin/products?status=pending');
    end loop;
  elsif tg_op = 'UPDATE' and to_jsonb(new)->>'status' is distinct from to_jsonb(old)->>'status' and owner_id is not null then
    target_url := case when next_status = 'published' and nullif(to_jsonb(new)->>'slug', '') is not null then '/product/' || (to_jsonb(new)->>'slug') else '/seller/products/' || new.id || '/edit' end;
    decision_label := case when next_status = 'published' then 'approved and is now live' when next_status = 'archived' and to_jsonb(old)->>'status' = 'pending' then 'rejected' when next_status = 'archived' then 'archived' else next_status end;
    insert into public.notifications (user_id, shop_id, type, title, body, message, entity_type, entity_id, entity_url)
    values (owner_id, new.shop_id, 'product_status', 'Product decision for ' || item_name, 'Your product "' || item_name || '" has been ' || decision_label || '.', 'Your product "' || item_name || '" has been ' || decision_label || '.', 'product', new.id, target_url);
  end if;
  return new;
end;
$$;

drop trigger if exists products_business_notification on public.products;
create trigger products_business_notification
after insert or update of status on public.products
for each row execute function public.create_product_notification();