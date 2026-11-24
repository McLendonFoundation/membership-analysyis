import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import SchoolBreakdown from "@/components/SchoolBreakdown";
import { supabaseServer } from "@/lib/supabase/server";
import { dateLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SchoolsPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (!profile || profile.status !== "approved") redirect("/pending");
  const isAdmin = profile.role === "admin";

  const { data: mine } = await supabase.from("profile_associations").select("association_code").eq("user_id", user.id);
  const myCodes = (mine ?? []).map((r) => r.association_code);
  if (!myCodes.length && profile.association_code) myCodes.push(profile.association_code);

  const { data: snap } = await supabase.from("school_breakdown_snapshots").select("payload,as_of")
    .order("as_of", { ascending: false }).limit(1).maybeSingle();

  return (
    <Shell title="School Breakdown" isAdmin={isAdmin}
      subtitle={snap ? `Members per association for every school · Data as of ${dateLabel(snap.as_of)}` : undefined}>
      {snap ? <SchoolBreakdown data={snap.payload} myCodes={myCodes} />
        : <div className="card">The school breakdown appears after the next weekly run.</div>}
    </Shell>
  );
}
