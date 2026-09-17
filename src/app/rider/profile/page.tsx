import type { Metadata } from "next";
import { CheckCircle2, ImagePlus, LockKeyhole, UserRound } from "lucide-react";
import { getRiderContext } from "@/lib/rider";
import { updateRiderProfileAction } from "@/app/rider/actions";

export const metadata: Metadata = { title: "Rider profile" };
export const dynamic = "force-dynamic";

type Params = Promise<{ saved?: string }>;
export default async function RiderProfilePage({
  searchParams,
}: {
  searchParams: Params;
}) {
  const { rider } = await getRiderContext();
  const { saved } = await searchParams;
  return (
    <main>
      <div className="mb-8">
        <p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-500">
          Account
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-[-.055em]">
          Rider profile
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Keep your contact, vehicle, and delivery documents up to date.
        </p>
      </div>
      {saved && (
        <p className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
          <CheckCircle2 className="size-4" /> Profile updated successfully.
        </p>
      )}
      <form
        action={updateRiderProfileAction}
        encType="multipart/form-data"
        className="grid gap-6 lg:grid-cols-[1fr_300px]"
      >
        <section className="surface p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <UserRound className="size-5 text-orange-500" />
            <div>
              <h2 className="font-black">Personal information</h2>
              <p className="mt-1 text-xs text-slate-500">
                Your email is fixed to protect your rider account.
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field
              label="Full name"
              name="fullName"
              defaultValue={String(rider.full_name ?? "")}
              required
            />
            <label className="grid gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
              <span>Email</span>

              <div className="relative">
                <input
                  value={String(rider.email ?? "")}
                  readOnly
                  disabled
                  className="field bg-slate-50 text-slate-500 dark:bg-white/5"
                />
              </div>
            </label>
            <Field
              label="Phone"
              name="phone"
              defaultValue={String(rider.phone ?? "")}
            />
            <Field
              label="CNIC / ID"
              name="cnic"
              defaultValue={String(rider.cnic ?? "")}
            />
            <Field
              label="Address"
              name="address"
              defaultValue={String(rider.address ?? "")}
              className="sm:col-span-2"
            />
          </div>
          <div className="mt-8 flex items-center gap-3 border-t border-slate-100 pt-6 dark:border-white/10">
            <UserRound className="size-5 text-orange-500" />
            <div>
              <h2 className="font-black">Vehicle and license</h2>
              <p className="mt-1 text-xs text-slate-500">
                These details help operations verify your deliveries.
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field
              label="Vehicle type"
              name="vehicleType"
              defaultValue={String(rider.vehicle_type ?? "")}
              placeholder="Bike, car, van"
            />
            <Field
              label="Vehicle number"
              name="vehicleNumber"
              defaultValue={String(rider.vehicle_number ?? "")}
            />
            <Field
              label="License number"
              name="licenseNumber"
              defaultValue={String(rider.license_number ?? "")}
            />
          </div>
          <button className="button-primary mt-7 bg-orange-500">
            Save profile
          </button>
        </section>
        <aside className="surface h-fit p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <ImagePlus className="size-5 text-orange-500" />
            <div>
              <h2 className="font-black">Documents</h2>
              <p className="mt-1 text-xs text-slate-500">
                JPG, PNG, or WEBP up to 5MB.
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-5">
            <Upload
              label="Profile photo"
              name="profilePhoto"
              current={rider.profile_photo_url}
            />
            <Upload
              label="License image"
              name="licenseImage"
              current={rider.license_image_url}
            />
          </div>
        </aside>
      </form>
    </main>
  );
}
function Field({
  label,
  name,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label
      className={`grid gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200 ${className}`}
    >
      <span>{label}</span>
      <input {...props} name={name} className="field" />
    </label>
  );
}
function Upload({
  label,
  name,
  current,
}: {
  label: string;
  name: string;
  current: unknown;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
      <span>{label}</span>
      {current ? (
        <img
          src={String(current)}
          alt={`${label} preview`}
          className="h-32 w-full rounded-xl border border-slate-200 object-cover dark:border-white/10"
        />
      ) : (
        <span className="grid h-32 place-items-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-400 dark:border-white/20">
          No file uploaded
        </span>
      )}
      <input
        type="file"
        name={name}
        accept="image/png,image/jpeg,image/webp"
        className="field px-3 py-2 text-xs"
      />
    </label>
  );
}
