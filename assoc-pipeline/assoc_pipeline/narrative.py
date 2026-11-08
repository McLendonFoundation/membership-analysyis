"""Deterministic NACDA Framework text (Narrative, Analysis, Causes, Direction, Agenda).

Every sentence is filled from computed numbers, so nothing is invented. House style: no long dashes.

Author: Ishita Tibrewal
"""
from __future__ import annotations

from datetime import date, timedelta


def _pct(x) -> str:
    return "n/a" if x is None else f"{x * 100:.0f}%"


def _next_weekday(d: date, weekday: int, weeks: int = 0) -> date:
    return d + timedelta(days=(weekday - d.weekday()) % 7 + 7 * weeks)


def build(result: dict, yoy: dict | None, as_of: date) -> dict:
    k = result["kpis"]
    a = result["association"]
    nvr = result["new_vs_renewal"]
    xa = result["cross_association"]
    depth = result["institution_depth"]
    regions = result["geography"]["regions"]
    top_region = regions[0] if regions else None

    narrative = [f"{a} has {k['members']:,} paid members across {k['institutions']:,} institutions "
                 f"in {k['states']} states."]
    if k["new_rate"] is not None:
        narrative.append(f"{k['renewals']:,} are renewals and {k['new_members']:,} are new ({_pct(k['new_rate'])}).")
    if yoy and yoy.get("available"):
        narrative.append(f"{yoy['renewed_so_far']:,} of last year's {yoy['prior_members']:,} members have renewed so far "
                         f"({_pct(yoy['renewal_rate_so_far'])}), leaving {yoy['not_yet_renewed']:,} to follow up.")
    if top_region:
        narrative.append(f"{top_region['region']} is the largest region with {top_region['members']:,} members.")

    causes, direction = [], []
    single = k["single_member_institutions"]
    if single:
        causes.append(f"{single} institutions have only one member, so membership depends on one contact there.")
        direction.append({"action": f"Group-upgrade outreach to the {single} single-member institutions",
                          "owner": f"{a} membership lead", "impact": "More members per institution, less risk when one contact leaves"})
    if nvr.get("available") and nvr["by_role"]:
        top = nvr["by_role"][0]
        low = nvr["by_role"][-1]
        causes.append(f"New members come most from {top['segment']} ({_pct(top['new_rate'])} new) and least from "
                      f"{low['segment']} ({_pct(low['new_rate'])} new).")
        direction.append({"action": f"Aim new-member messaging at {top['segment']} and similar roles",
                          "owner": "Marketing", "impact": "Higher new-member share"})
    if yoy and yoy.get("available") and yoy["by_role"]:
        lag = yoy["by_role"][0]
        causes.append(f"Renewals lag most among {lag['segment']}: {_pct(lag['renewal_rate'])} renewed so far "
                      f"({lag['not_yet_renewed']} not yet).")
        direction.append({"action": f"Work the lapsed list, starting with {lag['segment']} and the top follow-up institutions",
                          "owner": f"{a} membership lead", "impact": f"Recover part of the {yoy['not_yet_renewed']:,} not yet renewed"})
    if xa["prospect_count"]:
        causes.append(f"{xa['prospect_count']:,} institutions in the same divisions are active in other NACDA associations "
                      f"but not in {a}.")
        direction.append({"action": f"Invite the top prospect institutions from the cross-association list",
                          "owner": f"{a} membership lead", "impact": "New institutions, warm because they already know NACDA"})

    monday = _next_weekday(as_of, 0)
    agenda = [
        {"when": (as_of + timedelta(days=14)).isoformat(), "decision": "Agree on the follow-up list and owners"},
        {"when": (as_of + timedelta(days=30)).isoformat(), "decision": "Review renewals recovered from the lapsed list"},
        {"when": monday.isoformat(), "decision": "Dashboard refresh with the new weekly file"},
    ]
    return {"narrative": " ".join(narrative), "causes": causes, "direction": direction, "agenda": agenda,
            "caveats": ["Paid members only; renewal rates are 'so far' until the membership year closes.",
                        "Payment pace and tenure are coming soon for associations without that data in the export."]}
