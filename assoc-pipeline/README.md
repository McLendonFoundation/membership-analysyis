# assoc-pipeline

Weekly membership analysis for every NACDA-managed association, structured with the NACDA Framework
(Narrative, Analysis, Causes, Direction, Agenda). Created by Ishita Tibrewal.

## Run
```bash
pip install -r requirements.txt
python -m assoc_pipeline.run \
  --current "All Paids 11.02.26.xlsx" \
  --prior "All Paids FINAL 6.22.26.xlsx" \
  --supplement "NADIIIAA Paid.xlsx" \
  --out out --as-of 2026-11-02 \
  [--assn NADIIIAA] [--previous-report out/2026-10-26/run_report.json]
pytest -q
```

## What it does
1. **Load and validate** (`load.py`): checks the 21 required columns, drops Ethnicity, removes duplicate ID + Assn
   rows (keeping the Primary Member row), pads zip codes, fills region from state, treats N4A RenewStatus dates as
   renewal dates. With `--previous-report` it blocks the run if rows or an association drop more than 10% week over week.
2. **Analyze each association** (`analyze.py`): KPIs, geography, institution depth, new vs renewal by role,
   division, org type and region, role mix and gender by role, payment pace and tenure (only where the data exists,
   otherwise "Coming soon"), data quality, and cross-association prospects and overlap.
3. **Compare with last year** (`compare.py`): renewal rate so far, renewal gaps by role, division, region and member
   type, institutions to follow up, and the lapsed-member list.
4. **Write NACDA text** (`narrative.py`): filled from the numbers only. No long dashes.

## Outputs (`out/<as_of>/`)
| File | Contains | Who can see it |
|---|---|---|
| `associations/<ASSN>.json` | Aggregates and NACDA text | Approved users of that association |
| `restricted/lapsed_<ASSN>.csv` | Lapsed members with contact details | Approved users of that association |
| `portfolio.json` | One row per association | Admin |
| `run_report.json` | Load summary, warnings, blocking problems | Admin |

## Decisions baked in
- N4A dates in RenewStatus are renewal dates.
- PM = Primary Member (an organization's primary contact for a team). A flag, not a separate member.
- Payment pace and tenure come from an optional `--supplement` file (currently NADIIIAA only).
- Ethnicity is never used.
