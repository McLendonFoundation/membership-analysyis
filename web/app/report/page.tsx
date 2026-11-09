import { redirect } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import PrintOnLoad from "@/components/PrintOnLoad";
import { supabaseServer } from "@/lib/supabase/server";
import { dateLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

// Print-ready report: every section expanded, lapsed contact list left out. Opens the browser's Save as PDF dialog.
export default async function Report({ searchParams }: { searchParams: Promise<{ a?: string }> }) {
  const { a } = await searchParams;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // Row-level security returns nothing if this user can't see the association.
  const { data: snap } = await supabase.from("association_snapshots").select("payload,as_of")
    .eq("association_code", a ?? "").order("as_of", { ascending: false }).limit(1).maybeSingle();
  if (!snap) redirect("/dashboard");
  const { count } = await supabase.from("lapsed_members").select("member_id", { count: "exact", head: true }).eq("association_code", a!);
  const { data: brand } = await supabase.from("associations").select("name,branding").eq("code", a!).maybeSingle();
  return (
    <main className="max-w-5xl mx-auto px-6 py-6">
      <PrintOnLoad />
      <div className="flex items-end justify-between border-b pb-3 mb-2" style={{ borderColor: "var(--rule)" }}>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--accent)" }}>Membership report</div>
          <h1 className="text-2xl font-bold">{a}{brand?.name ? `: ${brand.name}` : ""}</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>Data as of {dateLabel(snap.as_of)} · Prepared {dateLabel(new Date().toISOString().slice(0, 10))}</p>
        </div>
      </div>
      <Dashboard snap={snap.payload} lapsed={Array.from({ length: count ?? 0 })} accent={brand?.branding?.accent} printMode />
      <p className="text-xs mt-10" style={{ color: "var(--muted)" }}>
        Structured with the NACDA Framework (Narrative, Analysis, Causes, Direction, Agenda), adapted from the Trust Insights SAINT framework. Created by Ishita Tibrewal.
      </p>
    </main>
  );
}
