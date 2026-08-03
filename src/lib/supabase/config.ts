function requirePublicEnvironmentVariable(
  name: string,
  value: string | undefined,
) {
  if (!value) throw new Error(`${name} is required. Add it to .env.local.`);
  return value;
}

export function getSupabaseConfig() {
  return {
    url: requirePublicEnvironmentVariable(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    publishableKey: requirePublicEnvironmentVariable(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}
