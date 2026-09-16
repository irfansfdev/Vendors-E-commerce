import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export async function getRiderContext() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/rider");
  const supabase = await createClient();
  const { data: rider } = await supabase.from("delivery_profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (!rider || rider.status !== "approved") redirect("/rider/apply");
  return { supabase, user, rider: rider as Record<string, unknown> };
}
