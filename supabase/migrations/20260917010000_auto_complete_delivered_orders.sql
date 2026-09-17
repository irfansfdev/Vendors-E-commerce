-- Automatically complete delivered shop orders after the seven-day customer window.
create or replace function public.auto_complete_delivered_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  completed_count integer;
begin
  with completed_orders as (
    update public.shop_orders
       set order_status = 'completed'
     where lower(coalesce(order_status, 'pending')) = 'delivered'
       and delivered_at is not null
       and delivered_at <= now() - interval '7 days'
    returning id
  )
  select count(*) into completed_count from completed_orders;

  return completed_count;
end;
$$;

grant execute on function public.auto_complete_delivered_orders() to service_role;

-- Supabase projects with pg_cron will run this once a day. The guard keeps
-- deployments without the extension from failing.
do $$
begin
  if to_regnamespace('cron') is not null then
    perform cron.unschedule(jobid)
      from cron.job
     where jobname = 'auto-complete-delivered-orders';
    perform cron.schedule(
      'auto-complete-delivered-orders',
      '15 2 * * *',
      'select public.auto_complete_delivered_orders();'
    );
  end if;
exception when undefined_table or undefined_function then
  raise notice 'pg_cron is unavailable; call auto_complete_delivered_orders from a scheduled worker.';
end
$$;
