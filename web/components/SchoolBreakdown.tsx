"use client";
import { useMemo, useState } from "react";
import { Card, DataTable, Kpi } from "@/components/ui";
import { num } from "@/lib/format";

type Row = { organization: string; group: string; subdivision: string | null; org_type: string | null;
  conference: string | null; state: string | null; on_roster: boolean; counts: Record<string, number>; total: number };
type Data = { as_of: string; associations: string[]; rows: Row[]; roster_loaded: boolean };

const GROUPS = ["D1", "D2", "D3", "NAIA", "JC/CC", "Canadian", "Other"];
const SUBS = ["FBS", "FCS", "AAA"];
const REP = ["Rep", "All Rep", "No Rep"] as const;

function Chips({ options, value, onChange, all = "All" }:
  { options: readonly string[]; value: string | null; onChange: (v: string | null) => void; all?: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {[null, ...options].map((o) => (
        <button key={o ?? "_all"} className="btn-ghost text-xs"
          style={value === o ? { background: "var(--navy)", color: "#fff" } : {}}
          onClick={() => onChange(o)}>{o ?? all}</button>
      ))}
    </div>
  );
}

export default function SchoolBreakdown({ data, myCodes }: { data: Data; myCodes: string[] }) {
  const [group, setGroup] = useState<string | null>("D1");
  const [sub, setSub] = useState<string | null>(null);
  const [orgType, setOrgType] = useState("");
  const [conf, setConf] = useState("");
  const [rep, setRep] = useState<string | null>(null);
  const [focus, setFocus] = useState(myCodes.find((c) => data.associations.includes(c)) ?? "");
  const [notIn, setNotIn] = useState(false);
  const [colMode, setColMode] = useState<"active" | "all" | "mine">("active");

  // Rows in the chosen division (before the column-dependent filters)
  const base = useMemo(() => data.rows.filter((r) =>
    (!group || r.group === group) && (!sub || r.subdivision === sub) &&
    (!orgType || (r.org_type ?? "") === orgType) && (!conf || (r.conference ?? "") === conf)), [data, group, sub, orgType, conf]);

  const confs = useMemo(() => Array.from(new Set(data.rows.filter((r) => !group || r.group === group)
    .map((r) => r.conference).filter(Boolean) as string[])).sort(), [data, group]);
  const orgTypes = useMemo(() => Array.from(new Set(data.rows.map((r) => r.org_type).filter(Boolean) as string[])).sort(), [data]);

  const cols = useMemo(() => {
    if (colMode === "all") return data.associations;
    if (colMode === "mine" && myCodes.length) return data.associations.filter((a) => myCodes.includes(a));
    return data.associations.filter((a) => base.some((r) => r.counts[a]));
  }, [colMode, data, base, myCodes]);

  const status = (r: Row) => {
    const hit = cols.filter((a) => r.counts[a]).length;
    return hit === 0 ? "No Rep" : hit === cols.length ? "All Rep" : "Rep";
  };

  const rows = useMemo(() => base
    .map((r) => {
      const flat: any = { organization: r.organization, division: r.subdivision ? `${r.group} ${r.subdivision}` : r.group,
        org_type: r.org_type, conference: r.conference, state: r.state };
      cols.forEach((a) => (flat[a] = r.counts[a] ?? 0));
      flat.total = cols.reduce((s, a) => s + (r.counts[a] ?? 0), 0);
      flat.status = status(r);
      return flat;
    })
    .filter((f) => (!rep || f.status === rep) && (!notIn || !focus || !f[focus]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  , [base, cols, rep, notIn, focus]);

  const max = Math.max(1, ...rows.flatMap((r) => cols.map((a) => r[a] as number)));
  const shade = (v: number, a: string) => {
    if (!v) return <span style={{ color: "#c8c9cc" }}>0</span>;
    const t = 0.12 + 0.6 * Math.sqrt(v / max);
    const mine = a === focus;
    return <span className="inline-block min-w-[2.2rem] text-center rounded px-1"
      style={{ background: mine ? `rgba(150,42,46,${t})` : `rgba(36,41,49,${t})`, color: t > 0.45 ? "#fff" : "inherit" }}>{v}</span>;
  };

  const perAssn = cols.map((a) => ({
    association: a,
    schools: rows.filter((r) => r[a]).length,
    members: rows.reduce((s, r) => s + (r[a] as number), 0),
  }));
  const repCount = rows.filter((r) => r.status !== "No Rep").length;

  const tableCols = [
    { key: "organization", label: "Organization" },
    { key: "division", label: "Division" },
    { key: "conference", label: "Conference" },
    ...cols.map((a) => ({ key: a, label: a, fmt: (v: number) => shade(v, a) })),
    { key: "total", label: "Total", fmt: (v: number) => <b>{num(v)}</b> },
    { key: "status", label: "Members", fmt: (v: string) => (
      <span className="text-xs font-semibold" style={{ color: v === "No Rep" ? "#962a2e" : v === "All Rep" ? "#1f7a3a" : "inherit" }}>{v}</span>) },
  ];

  return (
    <div>
      <div className="card no-print">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="text-xs font-semibold mb-1">Division</div>
            <Chips options={GROUPS} value={group} onChange={(v) => { setGroup(v); setSub(null); setConf(""); }} />
            {group === "D1" && <div className="mt-2"><Chips options={SUBS} value={sub} onChange={setSub} all="All D1" /></div>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold">Conference
              <select className="input mt-1" value={conf} onChange={(e) => setConf(e.target.value)}>
                <option value="">All conferences</option>{confs.map((c) => <option key={c}>{c}</option>)}
              </select></label>
            <label className="text-xs font-semibold">Organization type
              <select className="input mt-1" value={orgType} onChange={(e) => setOrgType(e.target.value)}>
                <option value="">All types</option>{orgTypes.map((c) => <option key={c}>{c}</option>)}
              </select></label>
          </div>
          <div>
            <div className="text-xs font-semibold mb-1">Representation (across the columns shown)</div>
            <Chips options={REP} value={rep} onChange={setRep} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold">Highlight association
              <select className="input mt-1" value={focus} onChange={(e) => setFocus(e.target.value)}>
                <option value="">None</option>{data.associations.map((c) => <option key={c}>{c}</option>)}
              </select></label>
            <label className="text-xs font-semibold">Columns
              <select className="input mt-1" value={colMode} onChange={(e) => setColMode(e.target.value as any)}>
                <option value="active">Associations with members here</option>
                <option value="all">All {data.associations.length} associations</option>
                {myCodes.length > 0 && <option value="mine">My associations</option>}
              </select></label>
            {focus && <label className="text-sm col-span-2 flex items-center gap-2">
              <input type="checkbox" checked={notIn} onChange={(e) => setNotIn(e.target.checked)} />
              Only schools with no {focus} members (prospects)</label>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <Kpi value={num(rows.length)} label="Organizations in view" />
        <Kpi value={num(repCount)} label="With at least one member" />
        <Kpi value={num(rows.length - repCount)} label="No members (No Rep)" />
        <Kpi value={num(rows.reduce((s, r) => s + r.total, 0))} label="Members in view" />
      </div>

      <div className="mt-4">
        <Card title="By association" note="Schools with at least one member, and total members, for the organizations in view.">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th></th>{perAssn.map((p) => <th key={p.association}
                style={p.association === focus ? { color: "#962a2e" } : {}}>{p.association}</th>)}</tr></thead>
              <tbody>
                <tr><td className="font-semibold">Schools</td>{perAssn.map((p) => <td key={p.association}>{num(p.schools)}</td>)}</tr>
                <tr><td className="font-semibold">Coverage</td>{perAssn.map((p) => <td key={p.association}>
                  {rows.length ? `${Math.round((100 * p.schools) / rows.length)}%` : "n/a"}</td>)}</tr>
                <tr><td className="font-semibold">Members</td>{perAssn.map((p) => <td key={p.association}>{num(p.members)}</td>)}</tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <Card title="Members per organization"
          note={data.roster_loaded ? "Schools from the roster appear even with no members. Counts are unique people per association."
            : "No school roster uploaded yet, so only organizations with members are listed."}>
          <DataTable rows={rows} cols={tableCols as any} csvName={`school_breakdown_${group ?? "all"}${sub ? "_" + sub : ""}_${data.as_of}.csv`}
            searchKeys={["organization", "conference", "state"]} pageSize={50} />
        </Card>
      </div>
    </div>
  );
}
