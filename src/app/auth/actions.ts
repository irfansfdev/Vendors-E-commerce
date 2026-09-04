"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";

export type AuthState = { error?: string; success?: string };

const credentialsSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function loginAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message };
  const destination = data.user.app_metadata?.is_admin === true
    ? "/admin"
    : safeNextPath(String(formData.get("next") ?? ""));
  redirect(destination);
}

export async function signupAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  const fullName = String(formData.get("fullName") ?? "").trim();
  if (fullName.length < 2) return { error: "Enter your full name." };
  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? `https://${headerStore.get("host")}`;
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { data: { full_name: fullName }, emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { error: error.message };
  if (data.session) redirect(next);
  const { data: signedIn, error: signInError } = await supabase.auth.signInWithPassword(parsed.data);
  if (signedIn.session) redirect(next);
  if (signInError?.message.toLowerCase().includes("confirm")) {
    return { success: "Confirm your email from the link in your inbox. You will be signed in automatically after confirmation." };
  }
  return { error: signInError?.message ?? "Your account was created, but automatic sign-in could not be completed." };
}

export async function googleAction(formData: FormData) {
  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? `https://${headerStore.get("host")}`;
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  if (data.url) redirect(data.url);
}

export async function resetPasswordAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = z.string().email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email address." };
  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? `https://${headerStore.get("host")}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${origin}/auth/callback?next=/reset-password` });
  return error ? { error: error.message } : { success: "Password reset instructions are on their way." };
}

const passwordSchema = z.object({ password: z.string().min(8, "Password must be at least 8 characters.") });

export async function updatePasswordAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = passwordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Choose a stronger password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  return error ? { error: error.message } : { success: "Your password has been updated. You can now sign in." };
}

export async function signoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
