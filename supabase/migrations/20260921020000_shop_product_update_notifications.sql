create or replace function public.notify_shop_followers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_title text;
  notification_body text;
begin
  if new.status = 'published' then
    if tg_op = 'INSERT' then
      notification_title := 'New product from a shop you follow';
      notification_body := new.title || ' is now available.';
    elsif old.status is distinct from new.status then
      notification_title := 'New product approved from a shop you follow';
      notification_body := new.title || ' has been approved and is now available.';
    elsif row(new.*) is distinct from row(old.*) then
      notification_title := 'Product updated by a shop you follow';
      notification_body := new.title || ' has been updated.';
    else
      return new;
    end if;

    insert into public.notifications (user_id, shop_id, type, title, body, message, entity_type, entity_id, entity_url)
    select sf.user_id, new.shop_id, 'shop_update', notification_title, notification_body, notification_body, 'product', new.id, '/product/' || new.slug
    from public.shop_followers sf
    where sf.shop_id = new.shop_id;
  end if;
  return new;
end;
$$;

drop trigger if exists shop_product_follower_notification on public.products;
create trigger shop_product_follower_notification
after insert or update on public.products
for each row execute function public.notify_shop_followers();
