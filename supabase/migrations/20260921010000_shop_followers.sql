create table if not exists public.shop_followers (
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);

alter table public.shop_followers enable row level security;

drop policy if exists "Users can read their followed shops" on public.shop_followers;
create policy "Users can read their followed shops"
  on public.shop_followers for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can follow shops" on public.shop_followers;
create policy "Users can follow shops"
  on public.shop_followers for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can unfollow shops" on public.shop_followers;
create policy "Users can unfollow shops"
  on public.shop_followers for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.notify_shop_followers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.notifications (user_id, shop_id, type, title, body, message, entity_type, entity_id, entity_url)
    select sf.user_id, new.shop_id, 'shop_update', 'New product from a shop you follow', new.title, new.title, 'product', new.id, '/product/' || new.slug
    from public.shop_followers sf
    where sf.shop_id = new.shop_id;
  end if;
  return new;
end;
$$;

drop trigger if exists shop_product_follower_notification on public.products;
create trigger shop_product_follower_notification
after insert or update of status on public.products
for each row execute function public.notify_shop_followers();
