// Accepts https://xyz.supabase.co, a trailing slash or a /rest/v1/ path, and returns the base URL.
export function supabaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/^["']|["']$/g, "");
  try { return new URL(raw).origin; } catch { return raw.replace(/\/+$/, ""); }
}
export function supabaseAnonKey(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim().replace(/^["']|["']$/g, "");
}
