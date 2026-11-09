import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();

  // First login after email confirmation: finish the invite using what was saved at sign-up.
  const meta = user.user_metadata ?? {};
  const codes: string[] = meta.association_codes ?? (meta.association_code ? [meta.association_code] : []);
  if (!profile && meta.invite_token && codes.length) {
    await supabase.rpc("redeem_invite_multi", {
      p_token: meta.invite_token, p_associations: codes, p_full_name: meta.full_name ?? null,
    });
    ({ data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle());
  }
  if (!profile || profile.status !== "approved") redirect("/pending");
  redirect(profile.role === "admin" ? "/admin" : "/dashboard");
}
