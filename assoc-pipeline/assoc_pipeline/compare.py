"""Year-over-year comparison against the prior-year final paid list.

Author: Ishita Tibrewal
"""
from __future__ import annotations

import pandas as pd

from . import config

LAPSED_COLUMNS = ["ID", "First", "Last", "Title", "Email", "Organization", "City", "state",
                  "Indiv Type", "Mem_Type", "Division", "Bkb Conf", "is_primary_member"]


def _rate_by(prior_a: pd.DataFrame, col: str) -> list[dict]:
    g = prior_a.groupby(col).agg(prior=("ID", "size"), renewed=("renewed", "sum")).reset_index()
    g = g[(g["prior"] >= config.MIN_GROUP) & ~g[col].isin(["Other", "Retired"])].copy()
    g["renewal_rate"] = (g["renewed"] / g["prior"]).round(4)
    g["not_yet_renewed"] = g["prior"] - g["renewed"]
    return g.rename(columns={col: "segment"}).sort_values("renewal_rate").to_dict("records")


def compare_association(a_name: str, current: pd.DataFrame, prior: pd.DataFrame) -> tuple[dict, pd.DataFrame]:
    """Returns (aggregate summary, restricted lapsed-member table)."""
    cur = current[current["Assn"] == a_name]
    pri = prior[prior["Assn"] == a_name].copy()
    if pri.empty:
        return {"available": False, "reason": "No prior-year data for this association"}, pd.DataFrame(columns=LAPSED_COLUMNS)
    cur_ids = set(cur["ID"])
    pri["renewed"] = pri["ID"].isin(cur_ids)
    returning = cur[cur["ID"].isin(set(pri["ID"]))]
    truly_new = cur[~cur["ID"].isin(set(pri["ID"]))]
    coded_new_but_returning = int(cur[cur["is_new"] & cur["ID"].isin(set(pri["ID"]))].shape[0])
    lapsed = pri[~pri["renewed"]]

    summary = {
        "available": True,
        "prior_members": int(len(pri)),
        "renewed_so_far": int(pri["renewed"].sum()),
        "renewal_rate_so_far": round(float(pri["renewed"].mean()), 4),
        "not_yet_renewed": int(len(lapsed)),
        "returning_members": int(len(returning)),
        "not_in_prior_year": int(len(truly_new)),
        "coded_new_but_in_prior_year": coded_new_but_returning,
        "member_change": int(len(cur) - len(pri)),
        "by_role": _rate_by(pri, "Indiv Type"),
        "by_division": _rate_by(pri, "Division"),
        "by_region": _rate_by(pri, "region"),
        "by_member_type": _rate_by(pri, "Mem_Type"),
        "institutions_fully_lapsed": int(
            pri.groupby("Organization")["renewed"].sum().eq(0).sum()),
    }
    org = pri.groupby("Organization").agg(prior=("ID", "size"), renewed=("renewed", "sum"),
                                         state=("state", "first")).reset_index()
    org["not_yet_renewed"] = org["prior"] - org["renewed"]
    summary["top_institutions_to_follow_up"] = (org[org["not_yet_renewed"] > 0]
                                                .sort_values("not_yet_renewed", ascending=False)
                                                .head(25).rename(columns={"Organization": "organization"})
                                                .to_dict("records"))
    lapsed_tbl = lapsed[[c for c in LAPSED_COLUMNS if c in lapsed.columns]].copy()
    lapsed_tbl.insert(0, "association", a_name)
    return summary, lapsed_tbl.sort_values(["Organization", "Last"]).reset_index(drop=True)


def portfolio(current: pd.DataFrame, prior: pd.DataFrame | None) -> list[dict]:
    """One row per association for the admin comparison view."""
    rows = []
    for a, g in current.groupby("Assn"):
        r = {"association": a, "members": int(len(g)), "new_members": int(g["is_new"].sum()),
             "institutions": int(g.loc[g["Org Type"].fillna("").str.startswith("Institution"), "Organization"].nunique())}
        if prior is not None:
            p = prior[prior["Assn"] == a]
            if len(p):
                ren = p["ID"].isin(set(g["ID"]))
                r.update(prior_members=int(len(p)), renewal_rate_so_far=round(float(ren.mean()), 4),
                         not_yet_renewed=int((~ren).sum()))
        rows.append(r)
    return sorted(rows, key=lambda r: -r["members"])
