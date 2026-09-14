alter table public.addresses enable row level security;

drop policy if exists "Users can read their own addresses" on public.addresses;
create policy "Users can read their own addresses"
  on public.addresses for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own addresses" on public.addresses;
create policy "Users can create their own addresses"
  on public.addresses for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own addresses" on public.addresses;
create policy "Users can update their own addresses"
  on public.addresses for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own addresses" on public.addresses;
create policy "Users can delete their own addresses"
  on public.addresses for delete to authenticated
  using (auth.uid() = user_id);