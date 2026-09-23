-- Allow the preparation and delivery statuses used by the integrated shop-order workflow.
-- Keep legacy values so existing shop orders and rider updates remain valid.
alter table public.shop_orders drop constraint if exists shop_orders_order_status_check;
alter table public.shop_orders add constraint shop_orders_order_status_check
  check (order_status in (
    'pending',
    'confirmed',
    'preparing',
    'processing',
    'ready_for_pickup',
    'shipped',
    'out_for_delivery',
    'delivered',
    'completed',
    'cancelled'
  ));
