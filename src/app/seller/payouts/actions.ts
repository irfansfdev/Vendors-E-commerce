"use server";

import { revalidatePath } from "next/cache";
import { getSellerContext } from "@/lib/seller";

export async function requestPayoutAction(formData: FormData) {
  const { supabase } = await getSellerContext();
  const payoutId = String(formData.get("payoutId") ?? "");
  if (!payoutId) return;
  await supabase.rpc("request_payout", { payout_id: payoutId });
  revalidatePath("/seller");
  revalidatePath("/seller/payouts");
}