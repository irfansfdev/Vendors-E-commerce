create or replace function public.get_admin_user_display_names(target_user_ids uuid[])
returns table (user_id uuid, display_name text)
language sql
security definer
stable
set search_path = public, auth
as $$
  select u.id,
         coalesce(
           nullif(u.raw_user_meta_data ->> 'full_name', ''),
           nullif(u.raw_user_meta_data ->> 'name', ''),
           split_part(coalesce(u.email, ''), '@', 1)
         )
    from auth.users u
   where u.id = any(target_user_ids)
     and coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true;
$$;

grant execute on function public.get_admin_user_display_names(uuid[]) to authenticated;
