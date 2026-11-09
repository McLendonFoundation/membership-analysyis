import { createServerClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";
import { cookies } from "next/headers";

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(
    supabaseUrl(),
    supabaseAnonKey(),
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            /* called from a Server Component: middleware refreshes the session instead */
          }
        },
      },
    },
  );
}
