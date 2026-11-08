"""Download the newest weekly files from the private 'uploads' bucket.

Bucket layout (uploaded from the admin page or by Power Automate):
  uploads/current/<this week's All Paids file>.xlsx      required
  uploads/prior/<last year's FINAL file>.xlsx            optional (lapsed lists)
  uploads/supplement/<NADIIIAA file with FRD/TTL>.xlsx   optional (pace and tenure)
Also writes data/previous_run_report.json from the last successful run for week-over-week checks.

Usage: python -m assoc_pipeline.fetch --dest data
Author: Ishita Tibrewal
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .supa import Supa

BUCKET = "uploads"
SLOTS = {"current": True, "prior": False, "supplement": False}


def fetch(dest: str, supa: Supa | None = None) -> dict:
    supa = supa or Supa()
    d = Path(dest)
    d.mkdir(parents=True, exist_ok=True)
    got = {}
    for slot, required in SLOTS.items():
        files = [f for f in supa.list_files(BUCKET, slot) if f["name"].lower().endswith((".xlsx", ".xls", ".csv"))]
        if not files:
            if required:
                raise FileNotFoundError(f"No file in {BUCKET}/{slot}/")
            continue
        newest = files[0]
        ext = Path(newest["name"]).suffix.lower()
        got[slot] = supa.download(BUCKET, f"{slot}/{newest['name']}", str(d / f"{slot}{ext}"))
        print(f"{slot}: {newest['name']} (updated {newest.get('updated_at')})")
    prev = supa.select("pipeline_runs", {"status": "eq.ok", "order": "as_of.desc", "limit": "1", "select": "report"})
    if prev:
        (d / "previous_run_report.json").write_text(json.dumps(prev[0]["report"]))
        got["previous_report"] = str(d / "previous_run_report.json")
    return got


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--dest", default="data")
    a = ap.parse_args(argv)
    try:
        fetch(a.dest)
    except Exception as e:  # noqa: BLE001
        print(f"ERROR: {e}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
