"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Card, DataTable, Kpi } from "@/components/ui";
import { dateLabel, num, pct } from "@/lib/format";
import type { Profile } from "@/lib/types";

const TABS = ["Users", "Invites", "All associations", "Weekly data"] as const;

export default function Admin({ myId, canTriggerRun }: { myId: string; canTriggerRun: boolean }) {
  const sb = supabaseBrowser();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Users");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [assns, setAssns] = useState<{ code: string }[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<any | null>(null);
  const [links, setLinks] = useState<{ user_id: string; association_code: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, i, a, r, pf, pa] = await Promise.all([
      sb.from("profiles").select("*").order("created_at", { ascending: false }),
      sb.from("invites").select("*").order("created_at", { ascending: false }),
      sb.from("associations").select("code").order("code"),
      sb.from("pipeline_runs").select("as_of,status,created_at,report").order("created_at", { ascending: false }).limit(12),
      sb.from("portfolio_snapshots").select("*").order("as_of", { ascending: false }).limit(1).maybeSingle(),
      sb.from("profile_associations").select("user_id,association_code"),
    ]);
    setLinks(pa.data ?? []);
    setProfiles((p.data as Profile[]) ?? []); setInvites(i.data ?? []); setAssns(a.data ?? []);
    setRuns(r.data ?? []); setPortfolio(pf.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const pending = profiles.filter((p) => p.status === "pending");
  const setStatus = async (id: string, status: Profile["status"], role?: Profile["role"]) => {
    const patch: any = { status };
    if (status === "approved") { patch.approved_at = new Date().toISOString(); patch.approved_by = myId; }
    if (role) patch.role = role;
    const { error } = await sb.from("profiles").update(patch).eq("user_id", id);
    setMsg(error ? error.message : "Saved."); load();
  };

  const assnOf = (id: string) => links.filter((l) => l.user_id === id).map((l) => l.association_code).sort();
  const addAssn = async (id: string, code: string) => {
    if (!code) return;
    const { error } = await sb.from("profile_associations").insert({ user_id: id, association_code: code });
    setMsg(error ? error.message : `Added ${code}.`); load();
  };
  const removeAssn = async (id: string, code: string) => {
    const { error } = await sb.from("profile_associations").delete().eq("user_id", id).eq("association_code", code);
    setMsg(error ? error.message : `Removed ${code}.`); load();
  };
  const rows = profiles.map((p) => ({ ...p, associations: assnOf(p.user_id).join(", ") }));

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi value={num(pending.length)} label="Waiting for approval" />
        <Kpi value={num(profiles.filter((p) => p.status === "approved").length)} label="Approved users" />
        <Kpi value={num(invites.filter((i) => !i.revoked && new Date(i.expires_at) > new Date()).length)} label="Active invite links" />
        <Kpi value={runs[0] ? `${runs[0].status.toUpperCase()}` : "none"} label={runs[0] ? `Last run, ${dateLabel(runs[0].as_of)}` : "No runs yet"} />
      </div>
      <div className="flex gap-1 flex-wrap border-b mb-4" style={{ borderColor: "var(--rule)" }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-3 py-2 text-sm font-semibold"
            style={tab === t ? { borderBottom: "3px solid var(--accent)" } : { color: "var(--muted)" }}>
            {t}{t === "Users" && pending.length ? ` (${pending.length} pending)` : ""}
          </button>
        ))}
      </div>
      {msg && <p className="text-sm mb-3" style={{ color: "var(--accent)" }}>{msg}</p>}

      {tab === "Users" && (
        <Card title="Users" note="Approve people after checking they belong to the association they chose.">
          <DataTable rows={rows} searchKeys={["email", "full_name", "associations"]}
            filters={[{ label: "Pending", test: (r) => r.status === "pending" }, { label: "Approved", test: (r) => r.status === "approved" }]}
            cols={[
              { key: "full_name", label: "Name" }, { key: "email", label: "Email" },
              { key: "associations", label: "Associations", fmt: (_v, r) => (
                <div className="flex flex-wrap gap-1 items-center">
                  {assnOf(r.user_id).map((c) => (
                    <span key={c} className="text-xs rounded px-1.5 py-0.5" style={{ background: "var(--tint)" }}>
                      {c} <button title={`Remove ${c}`} onClick={() => removeAssn(r.user_id, c)} style={{ color: "var(--accent)" }}>×</button>
                    </span>))}
                  <select className="text-xs border rounded" style={{ borderColor: "var(--rule)" }} value=""
                    onChange={(e) => addAssn(r.user_id, e.target.value)}>
                    <option value="">+ add</option>
                    {assns.filter((a) => !assnOf(r.user_id).includes(a.code)).map((a) => <option key={a.code} value={a.code}>{a.code}</option>)}
                  </select>
                </div>) },
              { key: "role", label: "Role" },
              { key: "status", label: "Status" }, { key: "created_at", label: "Signed up", fmt: (v) => dateLabel(v) },
              { key: "user_id", label: "Actions", fmt: (id, r) => id === myId ? "You" : (
                <div className="flex gap-1 flex-wrap">
                  {r.status !== "approved" && <button className="btn" onClick={() => setStatus(id, "approved")}>Approve</button>}
                  {r.status !== "revoked" && <button className="btn-ghost" onClick={() => setStatus(id, "revoked")}>Revoke</button>}
                  {r.status === "approved" && r.role !== "admin" && <button className="btn-ghost" onClick={() => setStatus(id, "approved", "admin")}>Make admin</button>}
                </div>) },
            ]} />
        </Card>
      )}

      {tab === "Invites" && <Invites assns={assns} invites={invites} onChange={load} setMsg={setMsg} />}

      {tab === "All associations" && (
        <Card title="All associations" note={portfolio ? `Data as of ${dateLabel(portfolio.as_of)}` : "No data yet"}>
          <DataTable rows={portfolio?.payload ?? []} csvName="all_associations.csv" cols={[
            { key: "association", label: "Association", fmt: (v) => <a className="underline" href={`/dashboard?a=${encodeURIComponent(v)}`}>{v}</a> },
            { key: "members", label: "Members", fmt: num }, { key: "new_members", label: "New", fmt: num },
            { key: "institutions", label: "Institutions", fmt: num }, { key: "prior_members", label: "Last year", fmt: num },
            { key: "renewal_rate_so_far", label: "Renewed so far", fmt: (v) => pct(v) },
            { key: "not_yet_renewed", label: "Not yet renewed", fmt: num }]} />
        </Card>
      )}

      {tab === "Weekly data" && <WeeklyData runs={runs} canTriggerRun={canTriggerRun} onChange={load} setMsg={setMsg} />}
    </div>
  );
}

function Invites({ assns, invites, onChange, setMsg }: { assns: { code: string }[]; invites: any[]; onChange: () => void; setMsg: (m: string) => void }) {
  const sb = supabaseBrowser();
  const [assn, setAssn] = useState("");
  const [days, setDays] = useState(30);
  const [uses, setUses] = useState(25);
  const [note, setNote] = useState("");
  // Always build links on the public production address, never on a protected preview URL.
  const base = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
  const link = (t: string) => `${base.replace(/\/$/, "")}/signup?token=${t}`;

  const create = async () => {
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from("invites").insert({
      association_code: assn || null, max_uses: uses, note: note || null, created_by: user?.id,
      expires_at: new Date(Date.now() + days * 864e5).toISOString(),
    });
    setMsg(error ? error.message : "Invite link created. Copy it from the list below."); onChange();
  };
  const revoke = async (id: string) => { await sb.from("invites").update({ revoked: true }).eq("id", id); onChange(); };

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card title="Create an invite link" note="Leave the association blank to let people pick their own.">
        <div className="space-y-2">
          <select className="input" value={assn} onChange={(e) => setAssn(e.target.value)}>
            <option value="">Any association (they choose)</option>
            {assns.map((a) => <option key={a.code} value={a.code}>{a.code}</option>)}
          </select>
          <label className="text-xs block">Valid for (days)<input className="input" type="number" min={1} value={days} onChange={(e) => setDays(+e.target.value)} /></label>
          <label className="text-xs block">Maximum sign-ups<input className="input" type="number" min={1} value={uses} onChange={(e) => setUses(+e.target.value)} /></label>
          <input className="input" placeholder="Note (e.g. NADIIIAA staff)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn w-full" onClick={create}>Create link</button>
        </div>
      </Card>
      <div className="lg:col-span-2"><Card title="Invite links">
        <DataTable rows={invites} cols={[
          { key: "association_code", label: "Association", fmt: (v) => v ?? "Any" }, { key: "note", label: "Note" },
          { key: "uses", label: "Used", fmt: (v, r) => `${v} of ${r.max_uses}` },
          { key: "expires_at", label: "Expires", fmt: (v) => dateLabel(v) },
          { key: "token", label: "Link", fmt: (t, r) => r.revoked || new Date(r.expires_at) < new Date() ? "Inactive" : (
            <div className="flex gap-1">
              <button className="btn" onClick={() => { navigator.clipboard.writeText(link(t)); setMsg("Link copied."); }}>Copy link</button>
              <button className="btn-ghost" onClick={() => revoke(r.id)}>Revoke</button>
            </div>) }]} />
      </Card></div>
    </div>
  );
}

function WeeklyData({ runs, canTriggerRun, onChange, setMsg }: { runs: any[]; canTriggerRun: boolean; onChange: () => void; setMsg: (m: string) => void }) {
  const sb = supabaseBrowser();
  const [busy, setBusy] = useState(false);
  const upload = async (slot: "current" | "prior" | "supplement", file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    const stamp = new Date().toISOString().slice(0, 10);
    const { error } = await sb.storage.from("uploads").upload(`${slot}/${stamp} ${file.name}`, file, { upsert: true });
    setBusy(false);
    setMsg(error ? error.message : `Uploaded to ${slot}. It will be used by the next run.`);
  };
  const runNow = async () => {
    setBusy(true);
    const r = await fetch("/api/run", { method: "POST" });
    const j = await r.json();
    setBusy(false);
    setMsg(j.ok ? "Run started. Results appear in about two minutes; refresh this page." : j.error);
  };
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card title="Upload files" note="The newest file in each slot is used. Only the current file is needed each week.">
        {(["current", "prior", "supplement"] as const).map((slot) => (
          <label key={slot} className="block text-sm mb-3">
            <span className="font-semibold capitalize">{slot}</span>
            <span className="text-xs block" style={{ color: "var(--muted)" }}>
              {slot === "current" ? "This week's All Paids export" : slot === "prior" ? "Last year's FINAL paid list (once a year)" : "Optional: file with paid date and total years"}
            </span>
            <input type="file" accept=".xlsx,.xls,.csv" disabled={busy} onChange={(e) => upload(slot, e.target.files?.[0])} className="text-xs mt-1" />
          </label>
        ))}
        <button className="btn w-full mt-2" disabled={busy || !canTriggerRun} onClick={runNow}>Run the analysis now</button>
        {!canTriggerRun && <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>Runs every Monday automatically. To enable this button, add GITHUB_DISPATCH_TOKEN in Vercel.</p>}
      </Card>
      <div className="lg:col-span-2"><Card title="Recent runs">
        <DataTable rows={runs.map((r) => ({ ...r, members: r.report?.rows_clean, warnings: [...(r.report?.warnings ?? []), ...(r.report?.blocking_problems ?? [])].join(" ") }))}
          cols={[{ key: "as_of", label: "Data as of", fmt: (v) => dateLabel(v) }, { key: "status", label: "Status" },
                 { key: "members", label: "Members", fmt: num }, { key: "created_at", label: "Ran at", fmt: (v) => new Date(v).toLocaleString() },
                 { key: "warnings", label: "Warnings" }]} />
        <button className="btn-ghost mt-2" onClick={onChange}>Refresh</button>
      </Card></div>
    </div>
  );
}
