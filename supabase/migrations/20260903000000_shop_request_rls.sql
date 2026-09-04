-- Allow authenticated customers to submit and track their own shop requests.
-- Admin access is determined by user.app_metadata.is_admin = true.
alter table public.shops enable row level security;

drop policy if exists "Customers can submit shop requests" on public.shops;
create policy "Customers can submit shop requests"
  on public.shops
  for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and status = 'pending'
  );

drop policy if exists "Owners can view their shops" on public.shops;
create policy "Owners can view their shops"
  on public.shops
  for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean, false)
  );

drop policy if exists "Admins can manage shops" on public.shops;
create policy "Admins can manage shops"
  on public.shops
  for update
  to authenticated
  using (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean, false))
  with check (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean, false));

drop policy if exists "Admins can remove shops" on public.shops;
create policy "Admins can remove shops"
  on public.shops
  for delete
  to authenticated
  using (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean, false));
