const statusPriority = ["pending", "confirmed", "processing", "shipped", "out_for_delivery", "delivered", "completed"];

export function getOrderStatus(order: Record<string, unknown>) {
  const shipments = Array.isArray(order.shop_orders) ? order.shop_orders as Record<string, unknown>[] : [];
  if (!shipments.length) return String(order.order_status ?? order.status ?? "pending").toLowerCase();

  const statuses = shipments.map((shipment) => String(shipment.order_status ?? shipment.status ?? "pending").toLowerCase());
  if (statuses.every((status) => status === "cancelled")) return "cancelled";
  return statuses.reduce((current, status) => statusPriority.indexOf(status) < statusPriority.indexOf(current) ? status : current, statuses[0]);
}
