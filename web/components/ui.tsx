"use client";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { downloadCsv } from "@/lib/format";

export const NAVY = "#242931";
export const MUTED = "#c8c9cc";

export function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <div className="kpi">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{label}</div>
    </div>
  );
}

export function Section({ letter, title, children }: { letter: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="section-title"><b>{letter}</b>{title}</div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="font-semibold">{title}</div>
      {note && <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{note}</div>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function ComingSoon({ what }: { what: string }) {
  return (
    <div className="rounded-md p-6 text-center text-sm" style={{ background: "var(--tint)", color: "var(--muted)" }}>
      <div className="font-semibold" style={{ color: "var(--ink)" }}>Coming soon</div>
      {what} will appear here once the data connection to NetForum is live.
    </div>
  );
}

/** Horizontal bar chart. value is a number; fmt formats labels/tooltips. */
export function HBar({ data, label, value, fmt, reference, refLabel, highlight, accent = "#962a2e", height }:
  { data: any[]; label: string; value: string; fmt: (v: number) => string; reference?: number; refLabel?: string;
    highlight?: (d: any) => boolean; accent?: string; height?: number }) {
  const h = height ?? Math.max(160, data.length * 28 + 40);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="#eee" />
        <XAxis type="number" tickFormatter={fmt} fontSize={11} />
        <YAxis type="category" dataKey={label} width={190} fontSize={11} interval={0} />
        <Tooltip formatter={(v: any) => fmt(Number(v))} />
        {reference != null && <ReferenceLine x={reference} stroke={accent} strokeDasharray="4 3" label={{ value: refLabel, fontSize: 10, fill: accent, position: "top" }} />}
        <Bar dataKey={value} radius={[0, 3, 3, 0]} label={{ position: "right", fontSize: 10, formatter: (v: any) => fmt(Number(v)) }}>
          {data.map((d, i) => <Cell key={i} fill={highlight ? (highlight(d) ? NAVY : MUTED) : NAVY} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function VBar({ data, x, y, fmt = (v: number) => v.toLocaleString(), color = NAVY }:
  { data: any[]; x: string; y: string; fmt?: (v: number) => string; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="#eee" />
        <XAxis dataKey={x} fontSize={11} />
        <YAxis fontSize={11} />
        <Tooltip formatter={(v: any) => fmt(Number(v))} />
        <Bar dataKey={y} fill={color} radius={[3, 3, 0, 0]} label={{ position: "top", fontSize: 10 }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

type Col = { key: string; label: string; fmt?: (v: any, row: any) => React.ReactNode };

export function DataTable({ rows, cols, csvName, searchKeys, filters, pageSize = 25 }:
  { rows: any[]; cols: Col[]; csvName?: string; searchKeys?: string[];
    filters?: { label: string; test: (r: any) => boolean }[]; pageSize?: number }) {
  const [q, setQ] = useState("");
  const [f, setF] = useState<number | null>(null);
  const [sort, setSort] = useState<{ k: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);
  const view = useMemo(() => {
    let r = rows;
    if (f != null && filters) r = r.filter(filters[f].test);
    if (q && searchKeys) {
      const s = q.toLowerCase();
      r = r.filter((x) => searchKeys.some((k) => String(x[k] ?? "").toLowerCase().includes(s)));
    }
    if (sort) r = [...r].sort((a, b) => (a[sort.k] > b[sort.k] ? 1 : a[sort.k] < b[sort.k] ? -1 : 0) * sort.dir);
    return r;
  }, [rows, q, f, sort, filters, searchKeys]);
  const pages = Math.max(1, Math.ceil(view.length / pageSize));
  const shown = view.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <div>
      <div className="flex flex-wrap gap-2 items-center mb-2 no-print">
        {searchKeys && <input className="input" style={{ maxWidth: 260 }} placeholder="Search" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />}
        {filters?.map((fl, i) => (
          <button key={fl.label} className="btn-ghost" style={f === i ? { background: "var(--navy)", color: "#fff" } : {}}
            onClick={() => { setF(f === i ? null : i); setPage(0); }}>{fl.label}</button>
        ))}
        <span className="text-xs ml-auto" style={{ color: "var(--muted)" }}>{view.length.toLocaleString()} rows</span>
        {csvName && <button className="btn-ghost" onClick={() => downloadCsv(csvName, view, cols.map((c) => c.key))}>Export CSV</button>}
      </div>
      <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
        <table className="tbl">
          <thead><tr>{cols.map((c) => (
            <th key={c.key} className="cursor-pointer select-none"
              onClick={() => setSort(sort?.k === c.key ? { k: c.key, dir: sort.dir === 1 ? -1 : 1 } : { k: c.key, dir: -1 })}>
              {c.label}{sort?.k === c.key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
            </th>))}</tr></thead>
          <tbody>{shown.map((r, i) => (
            <tr key={i}>{cols.map((c) => <td key={c.key}>{c.fmt ? c.fmt(r[c.key], r) : r[c.key] ?? ""}</td>)}</tr>
          ))}</tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex gap-2 items-center mt-2 text-sm no-print">
          <button className="btn-ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page + 1} of {pages}</span>
          <button className="btn-ghost" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
