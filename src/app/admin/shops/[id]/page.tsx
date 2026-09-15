import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShopDetails } from "@/components/admin-shop-details";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Shop details | BabulShop Admin" };
export const dynamic = "force-dynamic";
type Row = Record<string, unknown>;

export default async function AdminShopDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (shopError || !shop) notFound();

  const [
    { data: products },
    { data: orders },
    { data: members },
    { data: payouts },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("shop_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("shop_orders")
      .select("*")
      .eq("shop_id", id)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("shop_members")
      .select("*")
      .eq("shop_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("payouts")
      .select("*")
      .eq("shop_id", id)
      .order("created_at", { ascending: false }),
  ]);
  const productRows = (products ?? []) as Row[];
  const productIdsForVariants = productRows
    .map((product) => String(product.id))
    .filter(Boolean);
  const { data: variantRows } = productIdsForVariants.length
    ? await supabase
        .from("product_variants")
        .select("product_id,sku,stock_quantity,stock,price")
        .in("product_id", productIdsForVariants)
    : { data: [] };
  const variantsByProduct = new Map<string, Row[]>();
  for (const variant of (variantRows ?? []) as Row[]) {
    const productId = String(variant.product_id ?? "");
    const current = variantsByProduct.get(productId) ?? [];
    current.push(variant);
    variantsByProduct.set(productId, current);
  }
  const shopProducts = productRows
    .filter((product) => !product.deleted_at)
    .map((product) => {
      const variants = variantsByProduct.get(String(product.id)) ?? [];
      const variantStock = variants.reduce(
        (total, variant) =>
          total + Number(variant.stock_quantity ?? variant.stock ?? 0),
        0,
      );
      const variantSku = variants
        .map((variant) => String(variant.sku ?? ""))
        .filter((sku) => sku && sku !== "-")
        .join(", ");
      return {
        ...product,
        stock: variants.length
          ? variantStock
          : Number(
              product.stock_quantity ?? product.stock ?? product.quantity ?? 0,
            ),
        sku: product.sku ?? (variantSku || "-"),
      };
    });
  const orderRows = (orders ?? []) as Row[];
  const memberRows = (members ?? []) as Row[];
  const orderIds = orderRows.map((order) => String(order.id));
  const productIds = productRows
    .filter((product) => !product.deleted_at)
    .map((product) => String(product.id));
  const customerIds = orderRows
    .map((order) => String(order.customer_id ?? order.user_id ?? ""))
    .filter(Boolean);
  const relatedIds = [
    ...new Set(
      [
        String((shop as Row).owner_id ?? ""),
        ...memberRows.map((member) => String(member.user_id ?? "")),
        ...customerIds,
      ].filter(Boolean),
    ),
  ];
  const [{ data: orderItems }, { data: profiles }, { data: reviews }] =
    await Promise.all([
      orderIds.length
        ? supabase
            .from("order_items")
            .select("*, product_variants(price, products(id,title))")
            .in("shop_order_id", orderIds)
        : Promise.resolve({ data: [] }),
      relatedIds.length
        ? supabase.from("profiles").select("*").in("id", relatedIds)
        : Promise.resolve({ data: [] }),
      productIds.length
        ? supabase
            .from("product_reviews")
            .select("*")
            .in("product_id", productIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);
  const parentIds = [
    ...new Set(
      orderRows
        .map((order) => String(order.parent_order_id ?? ""))
        .filter(Boolean),
    ),
  ];
  const { data: parentOrders } = parentIds.length
    ? await supabase
        .from("orders")
        .select("id,customer_id,customer_name,full_name,shipping_address_id")
        .in("id", parentIds)
    : { data: [] };
  const addressIds = ((parentOrders ?? []) as Row[])
    .map((order) => String(order.shipping_address_id ?? ""))
    .filter(Boolean);
  const { data: addresses } = addressIds.length
    ? await supabase
        .from("addresses")
        .select("id,full_name,name")
        .in("id", addressIds)
    : { data: [] };
  const profileMap = new Map(
    ((profiles ?? []) as Row[]).map((profile) => [String(profile.id), profile]),
  );
  const reviewUserIds = [
    ...new Set(
      ((reviews ?? []) as Row[])
        .map((review) => String(review.user_id ?? ""))
        .filter((userId) => userId && !profileMap.has(userId)),
    ),
  ];
  if (reviewUserIds.length) {
    const { data: reviewProfiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", reviewUserIds);
    for (const profile of (reviewProfiles ?? []) as Row[])
      profileMap.set(String(profile.id), profile);
  }
  const parentMap = new Map(
    ((parentOrders ?? []) as Row[]).map((order) => [String(order.id), order]),
  );
  const addressMap = new Map(
    ((addresses ?? []) as Row[]).map((address) => [
      String(address.id),
      address,
    ]),
  );
  const identityIds = [
    ...new Set(
      [
        String((shop as Row).owner_id ?? ""),
        ...((parentOrders ?? []) as Row[]).map((order) =>
          String(order.customer_id ?? ""),
        ),
      ].filter(Boolean),
    ),
  ];
  const { data: authNames } = identityIds.length
    ? await supabase.rpc("get_admin_user_display_names", {
        target_user_ids: identityIds,
      })
    : { data: [] };
  for (const identity of (authNames ?? []) as Row[]) {
    const existing = profileMap.get(String(identity.user_id)) ?? {
      id: identity.user_id,
    };
    existing.full_name = identity.display_name;
    profileMap.set(String(identity.user_id), existing);
  }
  for (const order of orderRows) {
    const parent = parentMap.get(String(order.parent_order_id));
    const address = parent
      ? addressMap.get(String(parent.shipping_address_id))
      : null;
    order.customer_id =
      parent?.customer_id ?? order.customer_id ?? order.user_id;
    order.customer_name =
      address?.full_name ??
      address?.name ??
      parent?.customer_name ??
      parent?.full_name ??
      order.customer_name;
  }
  const customerMap = new Map<string, Row>();
  for (const order of orderRows) {
    const parent = parentMap.get(String(order.parent_order_id));
    const address = parent
      ? addressMap.get(String(parent.shipping_address_id))
      : null;
    const customerId = String(
      parent?.customer_id ?? order.customer_id ?? order.user_id ?? "",
    );
    if (!customerId) continue;
    const existing = customerMap.get(customerId) ?? {
      ...(profileMap.get(customerId) ?? {}),
      id: customerId,
      full_name:
        address?.full_name ??
        address?.name ??
        parent?.customer_name ??
        parent?.full_name ??
        profileMap.get(customerId)?.full_name,
      total_orders: 0,
      total_spent: 0,
      last_order: order.created_at,
      status: "active",
    };
    existing.total_orders = Number(existing.total_orders) + 1;
    existing.total_spent =
      Number(existing.total_spent) +
      Number(order.gross_amount ?? order.total_amount ?? order.subtotal ?? 0);
    if (
      new Date(String(order.created_at ?? 0)) >
      new Date(String(existing.last_order ?? 0))
    )
      existing.last_order = order.created_at;
    customerMap.set(customerId, existing);
  }
  const reviewRows = ((reviews ?? []) as Row[]).map((review) => ({
    ...review,
    product:
      productRows.find(
        (product) => String(product.id) === String(review.product_id),
      ) ?? null,
    customer: profileMap.get(String(review.user_id)) ?? null,
  }));
  const memberView = memberRows.map((member) => ({
    ...member,
    profile: profileMap.get(String(member.user_id)) ?? null,
  }));
  const performanceMap = new Map<string, { sales: number; orders: number }>();
  for (const order of orderRows) {
    if (
      !["delivered", "completed"].includes(
        String(order.order_status ?? order.status ?? "").toLowerCase(),
      )
    )
      continue;
    const key = new Date(String(order.created_at)).toLocaleDateString(
      undefined,
      { month: "short", year: "numeric" },
    );
    const item = performanceMap.get(key) ?? { sales: 0, orders: 0 };
    item.sales += Number(
      order.gross_amount ?? order.total_amount ?? order.subtotal ?? 0,
    );
    item.orders += 1;
    performanceMap.set(key, item);
  }
  const ownerProfile = profileMap.get(String((shop as Row).owner_id));
  const owner = ownerProfile
    ? {
        ...ownerProfile,
        owner_name: ownerProfile.owner_name ?? (shop as Row).owner_name,
        email: ownerProfile.email ?? (shop as Row).owner_email,
      }
    : {
        owner_name: (shop as Row).owner_name,
        email: (shop as Row).owner_email,
        owner_email: (shop as Row).owner_email,
        user_id: (shop as Row).owner_id,
      };
  return (
    <AdminShopDetails
      data={{
        shop: shop as Row,
        products: shopProducts,
        orders: orderRows,
        customers: [...customerMap.values()],
        payouts: (payouts ?? []) as Row[],
        reviews: reviewRows,
        members: memberView,
        owner: owner ?? null,
        orderItems: (orderItems ?? []) as Row[],
        performance: [...performanceMap.entries()]
          .slice(-6)
          .map(([label, values]) => ({ label, ...values })),
      }}
    />
  );
}
