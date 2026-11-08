"use client";
import { useMemo, useState } from "react";
import USMap from "@/components/USMap";
import { Card, ComingSoon, DataTable, HBar, Kpi, Section, VBar } from "@/components/ui";
import { num, pct } from "@/lib/format";
import type { Snapshot } from "@/lib/types";

const TABS = ["Geography", "Institutions", "New vs renewal", "Renewals and lapsed", "Prospects", "Member profile", "Data quality"] as const;
type Tab = (typeof TABS)[number];
const METRICS = {
  members: { label: "Members", fmt: num },
  organizations: { label: "Organizations", fmt: num },
  new_rate: { label: "New-member rate", fmt: (v: number) => pct(v) },
  members_per_org: { label: "Members per organization", fmt: (v: number) => v?.toFixed(1) },
} as const;

export default function Dashboard({ snap, lapsed, accent }: { snap: Snapshot; lapsed: any[]; accent?: string }) {
  const [tab, setTab] = useState<Tab>("Geography");
  const [metric, setMetric] = useState<keyof typeof METRICS>("members");
  const [region, setRegion] = useState("All");
  const k = snap.kpis;
  const yoy = snap.year_over_year ?? {};
  const nacda = snap.nacda;

  const states = useMemo(() => snap.geography.states.filter((s) => region === "All" || s.region === region), [snap, region]);
  const mapValues = useMemo(() => Object.fromEntries(states.map((s) => [s.state, Number(s[metric]) || 0])), [states, metric]);
  const stateByCode = useMemo(() => Object.fromEntries(snap.geography.states.map((s) => [s.state, s])), [snap]);
  const regions = ["All", ...snap.geography.regions.map((r) => r.region)];

  return (
    <div>
      <div className="flex gap-2 flex-wrap">
        {[["N", "Narrative"], ["A", "Analysis"], ["C", "Causes"], ["D", "Direction"], ["A", "Agenda"]].map(([l, w]) => (
          <a key={w} href={`#${w.toLowerCase()}`} className="chip" style={accent ? { background: accent } : {}}>{l} <span className="font-normal opacity-90">{w}</span></a>
        ))}
      </div>

      <div id="narrative"><Section letter="N" title="Narrative">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <Kpi value={num(k.members)} label="Paid members" />
          <Kpi value={k.new_rate == null ? "n/a" : num(k.new_members)} label={k.new_rate == null ? "New members (not coded)" : `New members (${pct(k.new_rate)})`} />
          <Kpi value={yoy.available ? pct(yoy.renewal_rate_so_far) : "n/a"} label="Of last year's members renewed so far" />
          <Kpi value={yoy.available ? num(yoy.not_yet_renewed) : "n/a"} label="Not yet renewed" />
          <Kpi value={num(k.institutions)} label="Institutions" />
          <Kpi value={num(k.single_member_institutions)} label="Single-member institutions" />
        </div>
        <p className="mt-4 leading-relaxed">{nacda.narrative}</p>
      </Section></div>

      <div id="analysis"><Section letter="A" title="Analysis: what happened">
        <div className="flex gap-1 flex-wrap border-b mb-4" style={{ borderColor: "var(--rule)" }}>
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className="px-3 py-2 text-sm font-semibold"
              style={tab === t ? { borderBottom: "3px solid var(--accent)" } : { color: "var(--muted)" }}>{t}</button>
          ))}
        </div>

        {tab === "Geography" && (
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2"><Card title="Members by state">
              <div className="flex gap-2 flex-wrap mb-2">
                <select className="input" style={{ width: 210 }} value={metric} onChange={(e) => setMetric(e.target.value as any)}>
                  {Object.entries(METRICS).map(([key, m]) => <option key={key} value={key}>{m.label}</option>)}
                </select>
                <select className="input" style={{ width: 170 }} value={region} onChange={(e) => setRegion(e.target.value)}>
                  {regions.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <USMap values={mapValues} label={(s) => {
                const r = stateByCode[s];
                return r ? `${num(r.members)} members · ${num(r.organizations)} orgs · ${pct(r.new_rate)} new` : "no members";
              }} />
            </Card></div>
            <Card title="Members by region">
              <HBar data={snap.geography.regions} label="region" value="members" fmt={num} />
            </Card>
            <div className="lg:col-span-3"><Card title="States">
              <DataTable rows={states} csvName={`${snap.association}_states.csv`} searchKeys={["state"]} cols={[
                { key: "state", label: "State" }, { key: "region", label: "Region" },
                { key: "members", label: "Members", fmt: num }, { key: "organizations", label: "Organizations", fmt: num },
                { key: "new", label: "New", fmt: num }, { key: "new_rate", label: "New rate", fmt: (v) => pct(v) },
                { key: "members_per_org", label: "Members per org", fmt: (v) => Number(v).toFixed(1) },
              ]} />
            </Card></div>
          </div>
        )}

        {tab === "Institutions" && (
          <div className="grid lg:grid-cols-3 gap-4">
            <Card title="Members per institution" note={`Median ${k.median_members_per_institution}. Single-member institutions are group-upgrade targets.`}>
              <VBar data={snap.institution_depth.members_per_institution} x="bucket" y="institutions" />
            </Card>
            <div className="lg:col-span-2"><Card title="Member institutions">
              <DataTable rows={snap.institution_depth.institutions} csvName={`${snap.association}_institutions.csv`}
                searchKeys={["organization", "state", "conference"]}
                filters={[{ label: `Single member (${k.single_member_institutions})`, test: (r) => r.members === 1 },
                          { label: "Has new members", test: (r) => r.new > 0 }]}
                cols={[{ key: "organization", label: "Institution" }, { key: "state", label: "State" },
                       { key: "division", label: "Division" }, { key: "conference", label: "Conference" },
                       { key: "members", label: "Members", fmt: num }, { key: "new", label: "New", fmt: num },
                       { key: "primary_members", label: "Primary contacts", fmt: num }]} />
            </Card></div>
          </div>
        )}

        {tab === "New vs renewal" && (
          snap.new_vs_renewal.available ? (
            <div className="grid lg:grid-cols-2 gap-4">
              <Card title="New-member rate by role" note="Roles with 20 or more members.">
                <HBar data={snap.new_vs_renewal.by_role} label="segment" value="new_rate" fmt={(v) => pct(v)}
                  reference={k.new_rate} refLabel={`overall ${pct(k.new_rate)}`} highlight={(d) => d.new_rate >= k.new_rate} />
              </Card>
              <Card title="New-member rate by division">
                <HBar data={snap.new_vs_renewal.by_division} label="segment" value="new_rate" fmt={(v) => pct(v)}
                  reference={k.new_rate} highlight={(d) => d.new_rate >= k.new_rate} />
              </Card>
              <Card title="Payment pace">
                {snap.payment_pace.available
                  ? <VBar data={snap.payment_pace.months} x="month" y="total" />
                  : <ComingSoon what="Members paid by month" />}
              </Card>
              <Card title="New-member rate by region">
                <HBar data={snap.new_vs_renewal.by_region} label="segment" value="new_rate" fmt={(v) => pct(v)} reference={k.new_rate} />
              </Card>
            </div>
          ) : <Card title="New vs renewal"><p className="text-sm">{snap.new_vs_renewal.reason}. Renewal comparison with last year is under Renewals and lapsed.</p></Card>
        )}

        {tab === "Renewals and lapsed" && (
          yoy.available ? (
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="grid grid-cols-2 gap-3 content-start">
                <Kpi value={num(yoy.prior_members)} label="Members last year" />
                <Kpi value={num(yoy.renewed_so_far)} label="Renewed so far" />
                <Kpi value={num(yoy.not_in_prior_year)} label="Not on last year's list" />
                <Kpi value={num(yoy.institutions_fully_lapsed)} label="Institutions with no renewals yet" />
              </div>
              <div className="lg:col-span-2"><Card title="Renewal rate so far by role" note="Lowest first. Groups of 10 or more.">
                <HBar data={yoy.by_role} label="segment" value="renewal_rate" fmt={(v) => pct(v)}
                  reference={yoy.renewal_rate_so_far} refLabel={`overall ${pct(yoy.renewal_rate_so_far)}`}
                  highlight={(d) => d.renewal_rate >= yoy.renewal_rate_so_far} />
              </Card></div>
              <div className="lg:col-span-3"><Card title="Institutions to follow up" note="Most members not yet renewed.">
                <DataTable rows={yoy.top_institutions_to_follow_up} csvName={`${snap.association}_follow_up.csv`} cols={[
                  { key: "organization", label: "Institution" }, { key: "state", label: "State" },
                  { key: "prior", label: "Last year", fmt: num }, { key: "renewed", label: "Renewed", fmt: num },
                  { key: "not_yet_renewed", label: "Not yet", fmt: num }]} />
              </Card></div>
              <div className="lg:col-span-3"><Card title={`Lapsed members (${num(lapsed.length)})`}
                note="Paid last year, not yet this year. Contact details are visible only to your association's approved users.">
                <DataTable rows={lapsed} csvName={`${snap.association}_lapsed_members.csv`}
                  searchKeys={["first_name", "last_name", "email", "organization", "role", "state"]}
                  filters={[{ label: "Primary contacts", test: (r) => r.is_primary_member }]}
                  cols={[{ key: "first_name", label: "First" }, { key: "last_name", label: "Last" },
                         { key: "title", label: "Title" }, { key: "organization", label: "Organization" },
                         { key: "state", label: "State" }, { key: "role", label: "Role" },
                         { key: "email", label: "Email", fmt: (v) => v ? <a className="underline" href={`mailto:${v}`}>{v}</a> : "" },
                         { key: "is_primary_member", label: "Primary contact", fmt: (v) => (v ? "Yes" : "") }]} />
              </Card></div>
            </div>
          ) : <Card title="Renewals"><p className="text-sm">{yoy.reason ?? "No prior-year data loaded."}</p></Card>
        )}

        {tab === "Prospects" && (
          <div className="grid lg:grid-cols-3 gap-4">
            <Card title="Members who also belong to" note={`${num(snap.cross_association.members_in_other_associations)} of your members are in other NACDA associations.`}>
              <HBar data={snap.cross_association.member_overlap.slice(0, 12)} label="association" value="shared_members" fmt={num} />
            </Card>
            <div className="lg:col-span-2"><Card title={`Prospect institutions (${num(snap.cross_association.prospect_count)})`}
              note="Active in other NACDA associations, in the divisions you already serve, but not in yours.">
              <DataTable rows={snap.cross_association.prospect_institutions} csvName={`${snap.association}_prospects.csv`}
                searchKeys={["organization", "state", "conference"]} cols={[
                  { key: "organization", label: "Institution" }, { key: "state", label: "State" },
                  { key: "division", label: "Division" }, { key: "conference", label: "Conference" },
                  { key: "members_elsewhere", label: "Members elsewhere", fmt: num },
                  { key: "associations", label: "In associations", fmt: (v) => (Array.isArray(v) ? v.join(", ") : v) }]} />
            </Card></div>
          </div>
        )}

        {tab === "Member profile" && (
          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="Members by role">
              <HBar data={snap.role_mix.roles.slice(0, 15)} label="role" value="members" fmt={num} />
            </Card>
            <Card title="Female share by role" note={`All members: ${pct(k.female_share)}. Roles with 10+ reporting gender.`}>
              <HBar data={snap.role_mix.roles.filter((r) => r.female_share != null && r.members >= 20)} label="role" value="female_share"
                fmt={(v) => pct(v)} reference={k.female_share} />
            </Card>
            <Card title="Years of membership">
              {snap.tenure.available
                ? <VBar data={snap.tenure.years} x="years" y="members" />
                : <ComingSoon what="Members by total years of membership" />}
            </Card>
          </div>
        )}

        {tab === "Data quality" && (
          <Card title="Missing data by field" note="Green under 5%, amber 5 to 25%, red over 25%.">
            <DataTable rows={snap.data_quality} cols={[
              { key: "field", label: "Field" }, { key: "missing", label: "Missing", fmt: num },
              { key: "pct_missing", label: "% missing", fmt: (v) => (
                <span style={{ color: v > 0.25 ? "#b42318" : v > 0.05 ? "#b54708" : "#067647", fontWeight: 600 }}>{pct(v, 1)}</span>) }]} />
          </Card>
        )}
      </Section></div>

      <div id="causes"><Section letter="C" title="Causes: why it happened">
        <ol className="list-decimal pl-5 space-y-2">{nacda.causes.map((c, i) => <li key={i}>{c}</li>)}</ol>
        <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>Caveats: {nacda.caveats.join(" ")}</p>
      </Section></div>

      <div id="direction"><Section letter="D" title="Direction: what we do">
        <DataTable rows={nacda.direction} cols={[{ key: "action", label: "Action" }, { key: "owner", label: "Owner" }, { key: "impact", label: "Expected impact" }]} />
      </Section></div>

      <div id="agenda"><Section letter="A" title="Agenda: when we decide">
        <DataTable rows={nacda.agenda} cols={[{ key: "when", label: "When" }, { key: "decision", label: "Decision or checkpoint" }]} />
      </Section></div>
    </div>
  );
}
