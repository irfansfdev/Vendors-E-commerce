import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";
import { getAvailablePortals, getPortalDestination } from "@/lib/portal";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const { data } = await supabase.auth.getUser();
        const portals = data.user ? await getAvailablePortals(data.user.id) : { isSeller: false, isRider: false };
        const destination = data.user?.app_metadata?.is_admin === true ? "/admin" : getPortalDestination(portals, next);
        return NextResponse.redirect(new URL(destination, url.origin));
      }
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin));
    } catch {
      return NextResponse.redirect(new URL("/login?error=Unable%20to%20complete%20authentication", url.origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=Unable%20to%20complete%20authentication", url.origin));
}
