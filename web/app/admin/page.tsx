import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import Admin from "@/components/Admin";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (!me || me.status !== "approved" || me.role !== "admin") redirect("/");
  return (
    <Shell title="Admin" subtitle="Invites, user approvals, weekly data and the cross-association view" isAdmin>
      <Admin myId={user.id} canTriggerRun={!!process.env.GITHUB_DISPATCH_TOKEN} />
    </Shell>
  );
}
