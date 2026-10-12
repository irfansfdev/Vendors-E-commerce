"use client";

import { useActionState } from "react";
import { Star } from "lucide-react";
import { submitReviewAction } from "@/app/actions/reviews";

export function ReviewForm({ productId, slug }: { productId: string; slug: string }) {
  const [state, action, pending] = useActionState(submitReviewAction, {});
  return <form action={action} className="surface mt-6 space-y-4 p-5"><input type="hidden" name="product_id" value={productId} /><input type="hidden" name="slug" value={slug} /><div><h3 className="font-black">Write a review</h3><p className="mt-1 text-xs text-slate-500">Only customers with a delivered order can submit a review.</p></div><label className="block text-sm font-bold">Rating<select name="rating" defaultValue="5" className="field mt-2"><option value="5">5 stars</option><option value="4">4 stars</option><option value="3">3 stars</option><option value="2">2 stars</option><option value="1">1 star</option></select></label><label className="block text-sm font-bold">Your review<textarea name="review" required minLength={10} maxLength={2000} rows={4} className="field mt-2" placeholder="What did you think?" /></label>{state.error && <p className="text-sm font-bold text-rose-600">{state.error}</p>}{state.success && <p className="text-sm font-bold text-emerald-600">{state.success}</p>}<button disabled={pending} className="button-primary bg-orange-500 hover:bg-orange-600">{pending ? "Submitting..." : <><Star className="size-4" /> Submit for approval</>}</button></form>;
}