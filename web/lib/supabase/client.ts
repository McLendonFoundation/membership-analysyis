import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

export function supabaseBrowser() {
  return createBrowserClient(
    supabaseUrl(),
    supabaseAnonKey(),
  );
}
