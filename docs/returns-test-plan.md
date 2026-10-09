# Returns and refunds test plan

## Preconditions

- On a fresh database, apply `supabase/migrations/20261009000000_returns_and_refunds.sql`;
  on an existing returns installation, apply
  `supabase/migrations/20261009140000_returns_handover_notifications.sql`.
  Run SQL manually in the Supabase editor, not from the application or a local
  test command.
- Seed separate customer, shop owner/manager, admin (`app_metadata.is_admin`),
  and approved rider accounts.
- Create a delivered COD shop order with at least two items, a purchase-time
  `order_items.price_at_checkout`, and an available customer shipping address.
  The current `shops` schema has no shop-address column; rider return-pickup
  details show an unavailable-address message until a shop address is added to
  the schema.
- Configure one product as returnable and one as non-returnable. Set the shop
  return window to 7 days for the main scenarios; also test 0 days.
- Configure the private `return-evidence` bucket and ensure only authorized
  users can upload/read evidence according to the migration's storage policies.

## Customer request and eligibility

1. Open `/account/orders` and confirm each delivered shop order shows its
   return deadline; confirm a zero-day shop window is presented as not
   returnable.
2. Open an eligible order and verify returnability, remaining quantity, and
   item price use the purchase-time snapshot, not the current catalog price.
3. Complete all four request steps for multiple quantities in one shop order.
   Verify reasons `damaged_defective`, `wrong_item`, `not_as_described`, and
   `missing_item` require 1–4 photos; `size_fit` and `changed_mind` permit no
   photos and deduct exactly Rs 150.
4. Verify refund amount is purchase price × requested quantity, less only the
   allowed pickup fee; shipping is excluded. Verify quantity cannot exceed
   purchased quantity minus refunded and active reserved quantities.
5. Try submitting an item from another shop order, a non-returnable product,
   a duplicate active request, and an out-of-window request; each must fail
   without partially inserting request, items, account, or evidence records.
6. Verify the customer can view only their requests, evidence, refund account,
   pickup code, and assigned rider contact. Verify cancellation is allowed only
   before pickup and escalation after rejection only within three days.

## Seller and rider handling

1. As shop owner and shop-member owner/manager, open `/seller/returns`. Confirm
   the response, in-progress, inspection, and completed queues and the 48-hour
   overdue indicator. Verify a seller from another shop cannot access a return
   or refund account.
2. Approve and reject requests. Confirm approval generates the customer's
   pickup code; rejected requests can only be escalated by the owning customer
   within the allowed period.
3. Confirm the seller can mark a delivered return as received without a code,
   or report it as not received with a reason. Inspect with a note and photo;
   verify pass moves the request to
   `refund_pending` and failure can be escalated to admin.
4. Change the shop return window from 0 to 365 days and toggle returnability on
   an owned product. Verify another shop's product cannot be changed.
5. In `/admin/deliveries`, assign an approved rider to a return pickup without
   changing outbound delivery assignments. Verify return pickup shows as a
   separate task on `/rider/assignments`, with no price, amount, or refund
   account data.
6. Complete pickup with the customer's code; test note+photo fallback, the
   first unavailable attempt and retry, and the second unavailable attempt
   notification/reassignment. Complete shop handover without a code, with an
   optional note and photo, then test seller receipt confirmation or dispute.
7. Verify seller dashboard revenue and payout balances subtract refunds;
   already-paid payout adjustments are recorded as negative amounts. Confirm
   the refunded-last-30-days card is based on `refunded_at`.

## Admin decisions, refunds, and payout ledger

1. Open `/admin/returns`; verify the attention, rider, refund, and all queues,
   search filters, overdue seller response, escalations, pickup assignment,
   refund-pending total, and current-month refunded total.
2. Open a return detail. Verify evidence links, ordered audit timeline, item
   purchase prices, pickup fee, final refund, and restricted refund-account
   details are available to an admin only.
3. Test admin approval/rejection for escalations and overdue seller responses.
   On failed inspection, test final rejection and the explicit refund-anyway
   override; verify both create audit events and notifications.
4. Assign/reassign a return pickup from `/admin/returns` and `/admin/deliveries`.
   Verify only approved, available riders with capacity are offered.
5. Process a `refund_pending` request with each supported payment method and a
   reference. Repeat the RPC call to confirm it is idempotent. Verify
   `order_items.returned_qty`, `shop_orders.refund_amount`, `orders.refund_amount`,
   payment status, earnings, payout refund/adjustment totals, and `return_events`.
6. Open `/admin/orders` and `/admin/payouts`; confirm order refunds and payout
   refund/adjustment/net amounts are visible. Confirm a payout with status
   `requested` has an Approve action; approving then permits Mark paid.
7. Verify non-admin users are redirected from admin routes and server actions
   reject missing admin claims or unauthorized return ownership.

## Responsive and dark-mode check

Run the app with the migration applied and use browser device emulation at
**360 CSS px wide**:

- Check `/admin/returns`, `/admin/returns/[id]`, `/admin/deliveries`,
  `/rider/assignments`, `/rider/assignments/[id]`, `/seller/returns`,
  `/seller/returns/[id]`, and `/admin/payouts`.
- Confirm no page-level horizontal overflow; wide data tables should scroll
  within their own containers. Confirm action buttons and form controls remain
  visible and usable without overlapping.
- Repeat with the app's dark theme enabled. Check status badges, evidence links,
  timeline separators, alerts, tables, selects, and disabled buttons for
  readable contrast.

## Regression checks

- `npm run typecheck`
- `npm run lint`
- `git diff --check`
- Verify outbound delivery queries and rider COD/earnings metrics continue to
  include only `assignment_type = 'delivery'`.
- Verify rider-facing return RPC responses never include refund amounts or
  refund-account columns.
