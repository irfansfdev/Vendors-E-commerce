export function publicStorageUrl(bucket: string, value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || raw === "null" || raw === "undefined") return "";
  if (/^(https?:\/\/|data:image\/)/i.test(raw)) return raw;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!baseUrl) return raw;
  const publicPath = raw.match(/\/storage\/v1\/object\/public\/(.+)$/i)?.[1];
  const path = (publicPath ?? raw).replace(/^\/+/, "");
  const objectPath = path.startsWith(`${bucket}/`) ? path : `${bucket}/${path}`;
  return `${baseUrl.replace(/\/$/, "")}/storage/v1/object/public/${objectPath}`;
}
