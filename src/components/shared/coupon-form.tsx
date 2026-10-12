type CouponRow = Record<string, unknown>;

function dateTimeLocal(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function CouponForm({
  action,
  coupon,
  title,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  coupon?: CouponRow | null;
  title: string;
  submitLabel: string;
}) {
  const discountType = String(coupon?.discount_type ?? "percentage");
  return (
    <form action={action} className="surface space-y-5 p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-black">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">Coupon amounts are validated and recalculated by the pricing RPC.</p>
      </div>
      {coupon?.id != null && <input type="hidden" name="id" value={String(coupon.id)} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-2 block text-xs font-bold">Coupon code</span>
          <input name="code" required minLength={2} maxLength={40} pattern="[A-Za-z0-9_-]+" defaultValue={String(coupon?.code ?? "")} className="field uppercase" autoComplete="off" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold">Discount type</span>
          <select name="discount_type" defaultValue={discountType} className="field">
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed amount</option>
            <option value="free_delivery">Free delivery</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold">Discount value</span>
          <input name="discount_value" type="number" min="0" step="0.01" required defaultValue={String(coupon?.discount_value ?? (discountType === "free_delivery" ? 0 : ""))} className="field" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold">Minimum order (PKR)</span>
          <input name="min_order_value" type="number" min="0" step="0.01" defaultValue={String(coupon?.min_order_value ?? 0)} className="field" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold">Maximum discount (PKR, optional)</span>
          <input name="max_discount" type="number" min="0" step="0.01" defaultValue={coupon?.max_discount == null ? "" : String(coupon.max_discount)} className="field" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold">Starts at</span>
          <input name="start_date" type="datetime-local" defaultValue={dateTimeLocal(coupon?.start_date)} className="field" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold">Ends at</span>
          <input name="end_date" type="datetime-local" defaultValue={dateTimeLocal(coupon?.end_date)} className="field" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold">Total usage limit</span>
          <input name="usage_limit_total" type="number" min="1" step="1" defaultValue={coupon?.usage_limit_total == null ? "" : String(coupon.usage_limit_total)} className="field" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold">Uses per customer</span>
          <input name="usage_limit_per_user" type="number" min="1" step="1" defaultValue={coupon?.usage_limit_per_user == null ? "" : String(coupon.usage_limit_per_user)} className="field" />
        </label>
      </div>
      <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-white/10">
        <input name="first_order_only" type="checkbox" value="true" defaultChecked={coupon?.first_order_only === true} className="mt-0.5 accent-orange-500" />
        <span><b>First order only</b><span className="mt-1 block text-xs text-slate-500">Limit this offer to customers who have not placed a non-cancelled order.</span></span>
      </label>
      <div className="flex justify-end">
        <button className="button-primary bg-orange-500 hover:bg-orange-600">{submitLabel}</button>
      </div>
    </form>
  );
}
