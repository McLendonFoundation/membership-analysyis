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
  if (!profile && meta.invite_token && meta.association_code) {
    await supabase.rpc("redeem_invite", {
      p_token: meta.invite_token, p_association: meta.association_code, p_full_name: meta.full_name ?? null,
    });
    ({ data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle());
  }
  if (!profile || profile.status !== "approved") redirect("/pending");
  redirect(profile.role === "admin" ? "/admin" : "/dashboard");
}
