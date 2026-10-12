# Pricing and Coupon Test Plan

Use two active shops (Shop A and Shop B), one customer, one seller account per shop, an admin account, and a rider account. Use real product variants with known stock and prices. The SQL migrations are not applied as part of this test plan; run them in order in a non-production Supabase project before testing.

## Setup

1. Set the base delivery fee to Rs 200 and the free-delivery threshold to Rs 3,000.
2. Add one product to each shop and note each variant's current price and stock.
3. Create shop coupon `SHOPA20` for Shop A: 20% off, minimum Rs 500, max discount Rs 250.
4. Create platform coupon `BABUL10`: 10% off, minimum Rs 500, max discount Rs 500.
5. Create platform free-delivery coupon `SHIPFREE`.
6. Record each order's `orders` and `shop_orders` money fields, `order_items.discount_amount`, coupon redemption, payout, and shop earning rows for reconciliation.

## Cart and coupon eligibility

| Scenario | Steps | Expected result |
| --- | --- | --- |
| Two-shop cart without coupon | Add one item from each shop with each subtotal below Rs 3,000. Open cart and checkout. | Pricing is calculated by the RPC. Each shop has its own delivery fee; overall total is the sum of per-shop totals. |
| Shop coupon scope | Apply `SHOPA20` to the two-shop cart. | Discount applies only to Shop A items; Shop B subtotal, fee, and payable stay unchanged. |
| Platform coupon scope | Apply `BABUL10` to the two-shop cart. | Discount is distributed over eligible items in both shops; seller item gross/commission is not reduced; platform discount cost records the discount. |
| Largest remainder allocation | Use several line items and a fixed coupon that creates fractional-paisa shares. | Stored line discounts sum exactly to the coupon discount; no item has a negative net price. |
| Free delivery | Apply `SHIPFREE` to a cart with a delivery fee. | Delivery discount waives the qualifying shop delivery fee; item discount stays zero. |
| Free delivery at threshold | Raise one shop's pre-coupon subtotal to Rs 3,000 or more. | That shop's base delivery fee is already zero; other shop fees are still independently evaluated. |
| Minimum not met | Apply a coupon with a minimum above its eligible subtotal. | Cart shows the minimum-order message and amount still needed; checkout prevents placing an invalid coupon order. |
| Unknown, paused, scheduled, expired | Try a missing code and coupons in each lifecycle state. | RPC returns the corresponding friendly code message; invalid coupons do not produce a discount. |
| Shop coupon on another shop only | Apply Shop A's coupon when cart contains only Shop B products. | Coupon is rejected as not applicable. |
| First order only | Use the coupon after placing a non-cancelled order, then after cancelling the only order. | Non-cancelled prior order blocks it; a cancelled order does not count as a first-order redemption. |
| Usage limits | Redeem up to total and per-customer limits, then try each limit again. | Further attempts are rejected with the appropriate usage-limit or already-used message. |
| Percentage cap | Try creating a shop coupon above the configured max percentage and lower the setting beneath an existing coupon. | DB rejects an over-limit shop coupon; admin must lower/pause existing shop coupons before lowering the configured maximum. |

## Checkout, concurrency, revenue, and refunds

| Scenario | Steps | Expected result |
| --- | --- | --- |
| Persisted checkout totals | Place a two-shop order with a platform coupon. Compare cart quote, order confirmation, and stored rows. | Confirmation matches stored totals. Parent payable equals the sum of shop payable totals; each shop row and order item stores its own allocated values. |
| Concurrent coupon use | With one remaining total use, submit two checkouts concurrently for the same coupon. | At most one order gets the coupon redemption; the other is rejected without a success-shaped un-discounted order. |
| Coupon usage on cancel | Place an order with a coupon, cancel before delivery, and retry the coupon. | Redemption becomes `released`; customer can use it again if other limits allow. |
| Two-shop seller settlement | Complete both shop deliveries, one with a shop coupon and the other with a platform coupon. | Shop coupon reduces only its shop's gross; platform coupon is absorbed by BabulShop. Delivery fee/platform discount cost do not increase commission or seller earnings. |
| Admin revenue | Compare admin sales charts and rankings with delivered `shop_orders`. | Revenue is item gross after seller-funded coupon discount, not customer payable or delivery fees. |
| Full shop-fault return | Return every item in one shop order for a shop-fault reason. | Refund is based on purchase-time price less item discount; that shop delivery fee is added only when the full shop order qualifies. Earnings and platform discount cost reverse the credited amounts only. |
| Partial return | Return a subset of a shop order. | Refund uses `price_at_checkout × quantity - allocated item discount`; delivery is not refunded and coupon/free-delivery thresholds are not recalculated. |
| Customer-fault return | Return eligible items with customer fault. | Rs 150 pickup charge is deducted according to the returns workflow; remaining refund is based on stored purchase-time prices and allocated discounts. |
| COD payable | Assign a rider to a discounted order and complete with the payable amount; retry with less than payable. | Expected collection equals that shop order's `payable_total`; lower collection is rejected. |
| Seller and payout views | Open seller order detail, seller payouts, admin order management, and admin payouts. | Views distinguish subtotal, shop/platform discount funding, platform discount cost, delivery collected by BabulShop, refunds, payable, and seller earnings. |

## Access and settings

1. As a seller, create/edit/pause/resume a coupon for the owned shop; confirm a different seller cannot alter it.
2. As admin, create a platform coupon, pause/resume shop coupons, inspect redemptions, and update the three pricing settings.
3. As an ordinary customer, verify coupon definitions/redemption rows and pricing settings cannot be listed directly through the Supabase API.
4. Change the base delivery fee and threshold in admin settings; quote a new cart and confirm the new values are returned by the RPC.
