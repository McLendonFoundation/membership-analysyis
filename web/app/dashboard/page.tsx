import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import Dashboard from "@/components/Dashboard";
import AssociationPicker from "@/components/AssociationPicker";
import { supabaseServer } from "@/lib/supabase/server";
import { dateLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ a?: string }> }) {
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (!profile || profile.status !== "approved") redirect("/pending");
  const isAdmin = profile.role === "admin";

  let codes: string[] = [];
  if (isAdmin) {
    const { data } = await supabase.from("association_snapshots").select("association_code").order("association_code");
    codes = Array.from(new Set((data ?? []).map((r) => r.association_code)));
  }
  const assn = isAdmin ? (sp.a && codes.includes(sp.a) ? sp.a : codes[0]) : profile.association_code;

  const { data: snap } = await supabase.from("association_snapshots").select("payload,as_of")
    .eq("association_code", assn).order("as_of", { ascending: false }).limit(1).maybeSingle();
  const { data: brand } = await supabase.from("associations").select("name,branding").eq("code", assn).maybeSingle();
  const { data: lapsed } = await supabase.from("lapsed_members").select("*").eq("association_code", assn)
    .order("organization").limit(10000);

  if (!snap) {
    return (
      <Shell title={assn ?? "Dashboard"} isAdmin={isAdmin}>
        {isAdmin && <AssociationPicker codes={codes} current={assn} />}
        <div className="card mt-4">No data has been published for this association yet. It appears after the next weekly run.</div>
      </Shell>
    );
  }
  return (
    <Shell title={`${assn}${brand?.name ? `: ${brand.name}` : ""} Membership`}
      subtitle={`Data as of ${dateLabel(snap.as_of)} · Source: ${snap.payload.meta?.source ?? "weekly export"}`} isAdmin={isAdmin}>
      {isAdmin && <AssociationPicker codes={codes} current={assn} />}
      <Dashboard snap={snap.payload} lapsed={lapsed ?? []} accent={brand?.branding?.accent} />
    </Shell>
  );
}
