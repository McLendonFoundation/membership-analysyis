"""Command-line entry point.

Usage:
  python -m assoc_pipeline.run --current "All Paids 11.02.26.xlsx" --prior "All Paids FINAL 6.22.26.xlsx" \
      --out out/ [--as-of 2026-11-02] [--supplement nadiiiaa_extra.xlsx] [--assn NADIIIAA]

Outputs (one folder per run, dated):
  out/<as_of>/run_report.json                 load + validation summary
  out/<as_of>/portfolio.json                  admin comparison across associations
  out/<as_of>/associations/<ASSN>.json        aggregates + NACDA text (safe for all users of that association)
  out/<as_of>/restricted/lapsed_<ASSN>.csv    lapsed members with contact details (restricted)

Author: Ishita Tibrewal
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

from . import analyze, compare, load, narrative

VERSION = "1.0.0"


def _json_default(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return None if np.isnan(o) else float(o)
    if isinstance(o, (np.bool_,)):
        return bool(o)
    if isinstance(o, (pd.Timestamp, date)):
        return o.isoformat()
    if o is pd.NA or o is pd.NaT:
        return None
    return str(o)


def _dump(obj, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    txt = json.dumps(obj, default=_json_default, indent=1, ensure_ascii=False)
    txt = txt.replace("NaN", "null")
    path.write_text(txt, encoding="utf-8")


def apply_supplement(df: pd.DataFrame, path: str | None) -> tuple[pd.DataFrame, dict]:
    """Optional per-member extras (ID, Assn, paid date, total years), e.g. the NADIIIAA export."""
    if not path:
        return df, {}
    s = load.read_export(path)
    cols = {c.lower(): c for c in s.columns}
    idc = cols.get("id")
    if not idc:
        raise load.SchemaError("Supplement needs an ID column")
    pdc = next((cols[c] for c in cols if c in ("frd", "paid date", "paiddate") or c.startswith("frd")), None)
    tyc = next((cols[c] for c in cols if c.startswith("ttl years") or c in ("total years", "totalyears")), None)
    assn = s["Assn"].iloc[0] if "Assn" in s.columns else None
    if assn is None:
        mt = next((c for c in s.columns if c.lower().startswith("mem_type")), None)
        assn = str(s[mt].dropna().iloc[0]).split()[0] if mt else None
    extra = pd.DataFrame({"ID": s[idc].astype("int64")})
    extra["paid_date_s"] = pd.to_datetime(s[pdc], errors="coerce") if pdc else pd.NaT
    extra["total_years_s"] = pd.to_numeric(s[tyc], errors="coerce") if tyc else np.nan
    extra = extra.drop_duplicates("ID")
    mask = df["Assn"].eq(assn)
    m = df.loc[mask, ["ID"]].merge(extra, on="ID", how="left")
    df.loc[mask, "paid_date"] = m["paid_date_s"].values
    df.loc[mask, "total_years"] = m["total_years_s"].values
    return df, {assn: {"paid_date": bool(m["paid_date_s"].notna().any()),
                       "total_years": bool(m["total_years_s"].notna().any())}}


def run(current: str, out: str, prior: str | None = None, as_of: str | None = None,
        supplement: str | None = None, only: list[str] | None = None, previous_report: str | None = None) -> dict:
    cur, rep = load.load(current)
    pri = load.load(prior)[0] if prior else None
    cur, supp_features = apply_supplement(cur, supplement)
    as_of_d = date.fromisoformat(as_of) if as_of else date.today()
    run_dir = Path(out) / as_of_d.isoformat()

    prev = json.loads(Path(previous_report).read_text()) if previous_report and Path(previous_report).exists() else None
    blocking = load.compare_reports(rep, prev)
    report = {"version": VERSION, "as_of": as_of_d.isoformat(), **asdict(rep),
              "prior_source": Path(prior).name if prior else None, "blocking_problems": blocking,
              "supplement_features": supp_features}
    if blocking:
        _dump({**report, "status": "failed"}, run_dir / "run_report.json")
        return {**report, "status": "failed"}

    assns = only or sorted(cur["Assn"].unique())
    for a in assns:
        feats = {**rep.features, **supp_features.get(a, {})}
        res = analyze.analyze_association(a, cur, feats)
        yoy, lapsed = (compare.compare_association(a, cur, pri) if pri is not None
                       else ({"available": False, "reason": "No prior-year file"}, None))
        res["year_over_year"] = yoy
        res["nacda"] = narrative.build(res, yoy, as_of_d)
        res["meta"] = {"as_of": as_of_d.isoformat(), "source": rep.source, "version": VERSION}
        _dump(res, run_dir / "associations" / f"{a}.json")
        if lapsed is not None and len(lapsed):
            p = run_dir / "restricted" / f"lapsed_{a}.csv"
            p.parent.mkdir(parents=True, exist_ok=True)
            lapsed.to_csv(p, index=False)
    _dump(compare.portfolio(cur, pri), run_dir / "portfolio.json")
    report["status"] = "ok"
    report["associations_written"] = len(assns)
    _dump(report, run_dir / "run_report.json")
    return report


def main(argv=None):
    ap = argparse.ArgumentParser(description="NACDA association membership pipeline")
    ap.add_argument("--current", required=True)
    ap.add_argument("--prior")
    ap.add_argument("--out", default="out")
    ap.add_argument("--as-of")
    ap.add_argument("--supplement", help="Optional per-member file with paid date / total years (e.g. NADIIIAA)")
    ap.add_argument("--assn", action="append", help="Limit to one or more associations")
    ap.add_argument("--previous-report", help="Last week's run_report.json for week-over-week checks")
    a = ap.parse_args(argv)
    try:
        r = run(a.current, a.out, a.prior, a.as_of, a.supplement, a.assn, a.previous_report)
    except (load.SchemaError, FileNotFoundError) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 2
    print(f"{r['status'].upper()}: {r['rows_clean']} members, {len(r['associations'])} associations, "
          f"{r['duplicates_removed']} duplicates removed, {len(r['warnings'])} warnings")
    for w in r["warnings"] + r.get("blocking_problems", []):
        print("  -", w)
    return 0 if r["status"] == "ok" else 1


if __name__ == "__main__":
    sys.exit(main())
