# Returns and refunds: schema and integration notes

This document describes the additive return/refund migration and its trust
boundaries. It does not apply the migration.

## Migration to run manually

Run [20261009000000_returns_and_refunds.sql](../supabase/migrations/20261009000000_returns_and_refunds.sql)
in the Supabase SQL editor after confirming the deployed schema matches the
project assumptions below. No migration command is run by this implementation.
For an existing returns installation, run the newer
[20261009140000_returns_handover_notifications.sql](../supabase/migrations/20261009140000_returns_handover_notifications.sql)
hotfix instead of re-running the already-applied base migration.

The purchase-time item price column is `order_items.price_at_checkout` (numeric).
Refund item amounts use that stored purchase price multiplied by the requested
quantity; current product/variant prices are not consulted.

## Existing and added schema

- `return_requests` is extended in place; existing records and statuses remain
  intact. Legacy `received` remains an accepted status and a seed audit event is
  recorded for existing requests.
- `return_items` stores one row for each requested `order_items.id`, with
  quantity, purchase-time unit price, and the item refund amount.
- `return_evidence` stores private object paths, uploader, content type, and
  evidence type.
- `return_events` is append-only and records prior/next status, actor, note,
  event type, metadata, and timestamp.
- `return_refund_accounts` stores a customer's JazzCash, Easypaisa, or bank
  refund destination. Only that customer and admins have row access; seller and
  rider policies are intentionally absent.
- `return_customer_pickup_codes` stores the customer's 6-digit pickup code.
  Only the customer and admins can read it directly; the assigned rider checks
  it through the pickup RPC. No seller-to-rider receipt code is used.
- `shops.return_window_days` defaults to 7; zero disables returns.
- `products.is_returnable` defaults to true so existing catalog items keep
  their pre-migration return availability.
- `order_items.returned_qty` defaults to zero and cannot exceed purchased
  quantity.
- `delivery_assignments.assignment_type` defaults existing rows to `delivery`.
  The old unique constraint on `shop_order_id` is replaced with partial unique
  indexes for outbound shop-order delivery and return pickup separately.
- The private Supabase Storage bucket is `return-evidence`. Evidence object
  paths are namespaced by the authenticated uploader's user ID, limited to
  8 MiB image files, and private. Customers can remove their own unattached
  uploads if a request submission fails.

For `size_fit` and `changed_mind`, one fixed PKR 150 pickup fee is deducted once
from the return request's item-only refund, with a floor of zero. Other reasons
require one to four image evidence objects.

## State changes and authorization

Applications should use the RPC-backed server actions in
`src/lib/returns/actions.ts`; they must not insert/update return workflow rows
directly. SQL functions enforce customer ownership, seller shop membership
(shop owner or `shop_members.role` owner/manager), admin status from
`app_metadata.is_admin`, and rider assignment ownership. Each successful
transition records a `return_events` row and creates notifications.

The principal RPCs are `create_return_request`, `seller_respond_return`,
`cancel_return_request`, `escalate_return_request`, `admin_decide_return`,
`assign_return_pickup`, `update_return_pickup`, `seller_inspect_return`, and
`admin_mark_return_refunded`. Admins resolve escalations and overdue requests
with `admin_decide_return`; `admin_refund_return_anyway` records an audited
`inspection_failed` → `refund_pending` override. After the rider marks a return
delivered, `seller_confirm_return_receipt` records the seller's receipt without
a code; `seller_report_return_not_received` records a dispute for admin review.
The rider-to-shop step is recorded without a confirmation code.
`get_rider_return_pickup_details` returns only
pickup/handover logistics and item names/quantities, never prices, refunds, or
refund account data. `get_customer_return_rider_details` exposes the assigned
rider's name and phone only to the customer who owns the return.

The seller response deadline is stored as
`return_requests.seller_response_due_at` (48 hours after submission). The admin
queue can identify overdue requests with
`status = 'requested' AND seller_response_due_at < now()`. Rejections can be
escalated within three days of the decision.

Refund completion increments `order_items.returned_qty`, cumulatively updates
`shop_orders.refund_amount` and `orders.refund_amount`, updates payment state,
and reduces seller earnings/payout amounts. If a payout was already paid, its
`adjustment_amount` records the negative adjustment.

## Integration sequencing

The customer return flow is under `/account/returns`; seller review, inspection,
and return-window controls are under `/seller/returns` and seller settings.
Admins review returns in `/admin/returns`, including the audit timeline,
private evidence, and refund-account details (admin-only); they assign return
pickups from `/admin/returns` or `/admin/deliveries`, separately from outbound
delivery assignment. Riders see a distinct return-pickup task under
`/rider/assignments`. Customer-unavailable attempts require a note and evidence
photo; a second failed attempt notifies admins and makes the pickup eligible
for reassignment. The admin overview reports open/attention/pending/refunded
metrics and shop return rates. Admin order and payout pages display cumulative
refund amounts and payout adjustments.

The base migration and subsequent idempotent hotfix migrations remain unapplied
until run manually in Supabase. For an existing database, apply the newest
hotfix migration rather than re-running an already-applied base migration. The
application UI and RPCs require the SQL changes to be applied before they can
be verified end-to-end against the database.
