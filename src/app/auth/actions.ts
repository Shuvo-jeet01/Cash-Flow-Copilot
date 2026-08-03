"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}
function fail(path: string): never {
  redirect(
    `${path}?message=${encodeURIComponent("Unable to complete that request. Check the information and try again.")}`,
  );
}

export async function signIn(formData: FormData) {
  const email = clean(formData.get("email"));
  const password = clean(formData.get("password"));
  if (!email || password.length < 8) fail("/sign-in");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) fail("/sign-in");
  const { data } = await supabase.auth.getUser();
  if (!data.user) fail("/sign-in");
  const displayName = String(
    data.user.user_metadata.display_name ?? email.split("@")[0],
  ).slice(0, 100);
  await supabase.rpc("ensure_profile", { profile_display_name: displayName });
  redirect("/organizations");
}

export async function signUp(formData: FormData) {
  const displayName = clean(formData.get("displayName"));
  const email = clean(formData.get("email"));
  const password = clean(formData.get("password"));
  if (!displayName || displayName.length > 100 || !email || password.length < 8)
    fail("/sign-up");
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: { display_name: displayName },
    },
  });
  if (error) fail("/sign-up");
  if (data.session) {
    await supabase.rpc("ensure_profile", { profile_display_name: displayName });
    redirect("/organizations");
  }
  redirect("/check-email");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.getUser();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
