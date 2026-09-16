import { createClient } from "@/lib/supabase/server";

export async function getAvailablePortals(userId: string) {
  const supabase = await createClient();
  const [shopOwner, shopMember, rider] = await Promise.all([
    supabase.from("shops").select("id").eq("owner_id", userId).eq("status", "active").limit(1).maybeSingle(),
    supabase.from("shop_members").select("shop_id").eq("user_id", userId).in("role", ["owner", "manager"]).limit(1).maybeSingle(),
    supabase.from("delivery_profiles").select("status").eq("user_id", userId).eq("status", "approved").maybeSingle(),
  ]);
  return { isSeller: Boolean(shopOwner.data || shopMember.data), isRider: Boolean(rider.data) };
}

export function getPortalDestination(portals: { isSeller: boolean; isRider: boolean }, requestedPath?: string) {
  if (portals.isSeller && portals.isRider) return "/choose-role";
  if (portals.isRider) return "/rider";
  if (portals.isSeller) return "/seller";
  return requestedPath || "/account";
}
