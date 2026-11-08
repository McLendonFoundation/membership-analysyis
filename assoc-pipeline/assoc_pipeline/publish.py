"""Load a pipeline run folder into Supabase.

Writes: pipeline_runs (always), associations (new codes), association_snapshots, portfolio_snapshots,
and lapsed_members (replaced per association so only the latest week of contact data is kept).
A failed run is recorded but never overwrites dashboard data.

Usage: python -m assoc_pipeline.publish --run-dir out/2026-11-02
Author: Ishita Tibrewal
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import pandas as pd

from .supa import Supa

LAPSED_MAP = {"ID": "member_id", "First": "first_name", "Last": "last_name", "Title": "title", "Email": "email",
              "Organization": "organization", "City": "city", "state": "state", "Indiv Type": "role",
              "Mem_Type": "member_type", "Division": "division", "Bkb Conf": "conference",
              "is_primary_member": "is_primary_member"}


def _clean(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    return v


def lapsed_rows(csv_path: Path, assn: str, as_of: str) -> list[dict]:
    df = pd.read_csv(csv_path, dtype=str).rename(columns=LAPSED_MAP)
    df = df[[c for c in LAPSED_MAP.values() if c in df.columns]]
    rows = []
    for r in df.to_dict("records"):
        r = {k: _clean(v) for k, v in r.items()}
        r["member_id"] = int(float(r["member_id"]))
        if "is_primary_member" in r and r["is_primary_member"] is not None:
            r["is_primary_member"] = str(r["is_primary_member"]).lower() == "true"
        rows.append({"association_code": assn, "as_of": as_of, **r})
    return rows


def publish(run_dir: str, supa: Supa | None = None) -> dict:
    supa = supa or Supa()
    d = Path(run_dir)
    report = json.loads((d / "run_report.json").read_text())
    as_of = report["as_of"]
    supa.insert("pipeline_runs", {"as_of": as_of, "status": report.get("status", "unknown"), "report": report})
    if report.get("status") != "ok":
        return {"published": False, "reason": "run did not pass validation"}

    snaps = []
    for f in sorted((d / "associations").glob("*.json")):
        payload = json.loads(f.read_text())
        snaps.append({"association_code": payload["association"], "as_of": as_of, "payload": payload})
    supa.upsert("associations", [{"code": s["association_code"]} for s in snaps], on_conflict="code")
    supa.upsert("association_snapshots", snaps, on_conflict="association_code,as_of")
    supa.upsert("portfolio_snapshots", [{"as_of": as_of, "payload": json.loads((d / "portfolio.json").read_text())}],
                on_conflict="as_of")

    lapsed_total = 0
    for s in snaps:
        a = s["association_code"]
        supa.delete("lapsed_members", association_code=a)
        f = d / "restricted" / f"lapsed_{a}.csv"
        if f.exists():
            rows = lapsed_rows(f, a, as_of)
            supa.upsert("lapsed_members", rows, on_conflict="association_code,member_id")
            lapsed_total += len(rows)
    return {"published": True, "associations": len(snaps), "lapsed_rows": lapsed_total, "as_of": as_of}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-dir", required=True, help="e.g. out/2026-11-02 (or out to pick the newest)")
    a = ap.parse_args(argv)
    run_dir = Path(a.run_dir)
    if not (run_dir / "run_report.json").exists():
        dated = sorted(p for p in run_dir.iterdir() if (p / "run_report.json").exists())
        if not dated:
            print("ERROR: no run_report.json found", file=sys.stderr)
            return 2
        run_dir = dated[-1]
    r = publish(str(run_dir))
    print(json.dumps(r))
    return 0 if r["published"] else 1


if __name__ == "__main__":
    sys.exit(main())
