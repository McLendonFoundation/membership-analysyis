"""Per-association analysis on the current year. Pure functions, aggregate outputs only.

Author: Ishita Tibrewal
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats

from . import config


def _rate(s: pd.Series) -> float:
    return round(float(s.mean()), 4) if len(s) else 0.0


def kpis(a: pd.DataFrame) -> dict:
    inst = a[a["Org Type"].fillna("").str.startswith("Institution")]
    per_org = inst.groupby("Organization").size()
    gender = a["Gender"].dropna()
    gender = gender[gender.isin(["Male", "Female"])]
    return {
        "members": int(len(a)),
        "renewals": int(a["status"].eq("Renewal").sum()),
        "new_members": int(a["is_new"].sum()),
        "new_rate": (_rate(a["is_new"]) if a["status"].ne("Unknown").all()
                     and not set(a["Assn"]) & config.DATE_STATUS_ASSNS else None),
        "organizations": int(a["Organization"].nunique()),
        "institutions": int(inst["Organization"].nunique()),
        "single_member_institutions": int((per_org == 1).sum()),
        "median_members_per_institution": float(per_org.median()) if len(per_org) else 0.0,
        "primary_members": int(a["is_primary_member"].sum()),
        "states": int(a["state"].nunique()),
        "female_share": _rate(gender.eq("Female")) if len(gender) >= config.MIN_GROUP else None,
    }


def geography(a: pd.DataFrame) -> dict:
    st = a.groupby("state").agg(members=("ID", "size"), organizations=("Organization", "nunique"),
                                new=("is_new", "sum")).reset_index()
    st["region"] = st["state"].map(config.STATE_TO_REGION).fillna(config.OTHER_REGION)
    st["new_rate"] = (st["new"] / st["members"]).round(4)
    st["members_per_org"] = (st["members"] / st["organizations"]).round(2)
    rg = a.groupby("region").agg(members=("ID", "size"), organizations=("Organization", "nunique"),
                                 new=("is_new", "sum")).reset_index()
    rg["new_rate"] = (rg["new"] / rg["members"]).round(4)
    return {"states": st.sort_values("members", ascending=False).to_dict("records"),
            "regions": rg.sort_values("members", ascending=False).to_dict("records")}


def institution_depth(a: pd.DataFrame) -> dict:
    inst = a[a["Org Type"].fillna("").str.startswith("Institution")]
    g = inst.groupby("Organization").agg(
        members=("ID", "size"), new=("is_new", "sum"), state=("state", "first"),
        city=("City", "first"), division=("Division", "first"), conference=("Bkb Conf", "first"),
        primary_members=("is_primary_member", "sum"),
    ).reset_index().rename(columns={"Organization": "organization"})
    buckets = pd.cut(g["members"], [0, 1, 2, 4, 9, 10**6], labels=["1", "2", "3-4", "5-9", "10+"])
    dist = buckets.value_counts().reindex(["1", "2", "3-4", "5-9", "10+"]).fillna(0).astype(int)
    return {"institutions": g.sort_values("members", ascending=False).to_dict("records"),
            "members_per_institution": [{"bucket": k, "institutions": int(v)} for k, v in dist.items()]}


def _segment(a: pd.DataFrame, col: str, min_n: int) -> list[dict]:
    g = a.groupby(col).agg(members=("ID", "size"), new=("is_new", "sum")).reset_index()
    g = g[g["members"] >= min_n].copy()
    g["new_rate"] = (g["new"] / g["members"]).round(4)
    return g.rename(columns={col: "segment"}).sort_values("new_rate", ascending=False).to_dict("records")


def new_vs_renewal(a: pd.DataFrame) -> dict:
    if (a["status"].eq("Unknown").any() or a["is_new"].sum() == 0
            or set(a["Assn"]) & config.DATE_STATUS_ASSNS):
        return {"available": False, "reason": "No New Member coding for this association"}
    out = {"available": True}
    for key, col in [("by_role", "Indiv Type"), ("by_division", "Division"),
                     ("by_org_type", "Org Type"), ("by_region", "region")]:
        out[key] = _segment(a, col, config.MIN_ROLE_GROUP if key == "by_role" else config.MIN_GROUP)
    sub = a.dropna(subset=["Indiv Type"])
    ct = pd.crosstab(sub["Indiv Type"], sub["is_new"])
    out["role_test_p"] = float(stats.chi2_contingency(ct).pvalue) if ct.shape == (ct.shape[0], 2) and ct.shape[0] > 1 else None
    return out


def role_mix(a: pd.DataFrame) -> dict:
    gender = a[a["Gender"].isin(["Male", "Female"])]
    roles = a.groupby("Indiv Type").size().rename("members")
    fem = gender.groupby("Indiv Type")["Gender"].apply(lambda s: s.eq("Female").mean()).rename("female_share")
    n_g = gender.groupby("Indiv Type").size().rename("gender_reported")
    t = pd.concat([roles, n_g, fem], axis=1).reset_index().rename(columns={"Indiv Type": "role"})
    t["female_share"] = t["female_share"].where(t["gender_reported"] >= config.MIN_GROUP).round(4)
    return {"roles": t.sort_values("members", ascending=False).fillna({"gender_reported": 0}).to_dict("records")}


def payment_pace(a: pd.DataFrame, feature_on: bool) -> dict:
    if not feature_on or a["paid_date"].notna().sum() == 0:
        return {"available": False, "reason": "Coming soon: needs paid date from NetForum"}
    m = a.dropna(subset=["paid_date"]).groupby(a["paid_date"].dt.to_period("M").astype(str)).agg(
        total=("ID", "size"), new=("is_new", "sum")).reset_index().rename(columns={"paid_date": "month"})
    return {"available": True, "months": m.to_dict("records")}


def tenure(a: pd.DataFrame, feature_on: bool) -> dict:
    if not feature_on or a["total_years"].notna().sum() == 0:
        return {"available": False, "reason": "Coming soon: needs total years from NetForum"}
    t = a["total_years"].dropna().astype(int).value_counts().sort_index()
    return {"available": True, "years": [{"years": int(k), "members": int(v)} for k, v in t.items()],
            "median": float(a["total_years"].median())}


def data_quality(a: pd.DataFrame) -> list[dict]:
    fields = {"Gender": "Gender", "Title": "Title", "Organization": "Organization", "Org Type": "Org Type",
              "Division": "Division", "Basketball conference": "Bkb Conf", "Zip": "zip5", "Email": "Email"}
    return [{"field": k, "missing": int(a[v].isna().sum()), "pct_missing": round(float(a[v].isna().mean()), 4)}
            for k, v in fields.items()]


def cross_association(a_name: str, df: pd.DataFrame) -> dict:
    """Use other associations as the 'possible members' universe."""
    a = df[df["Assn"] == a_name]
    mine_orgs = set(a["Organization"].dropna())
    inst = df[df["Org Type"].fillna("").str.startswith("Institution") & df["Assn"].ne(a_name)]
    # Restrict to the same divisions this association already serves, so targets are relevant.
    divs = set(a["Division"].dropna())
    if divs:
        inst = inst[inst["Division"].isin(divs)]
    prospects = (inst[~inst["Organization"].isin(mine_orgs)]
                 .groupby("Organization").agg(state=("state", "first"), city=("City", "first"),
                                              division=("Division", "first"), conference=("Bkb Conf", "first"),
                                              members_elsewhere=("ID", "nunique"),
                                              associations=("Assn", lambda s: sorted(set(s))))
                 .reset_index().rename(columns={"Organization": "organization"})
                 .sort_values("members_elsewhere", ascending=False))
    ids = set(a["ID"])
    other = df[df["ID"].isin(ids) & df["Assn"].ne(a_name)]
    overlap = (other.groupby("Assn")["ID"].nunique().sort_values(ascending=False)
               .rename("shared_members").reset_index().rename(columns={"Assn": "association"}))
    return {"prospect_institutions": prospects.head(500).to_dict("records"),
            "prospect_count": int(len(prospects)),
            "member_overlap": overlap.to_dict("records"),
            "members_in_other_associations": int(other["ID"].nunique())}


def analyze_association(a_name: str, df: pd.DataFrame, features: dict) -> dict:
    a = df[df["Assn"] == a_name]
    return {
        "association": a_name,
        "kpis": kpis(a),
        "geography": geography(a),
        "institution_depth": institution_depth(a),
        "new_vs_renewal": new_vs_renewal(a),
        "role_mix": role_mix(a),
        "payment_pace": payment_pace(a, features.get("paid_date", False)),
        "tenure": tenure(a, features.get("total_years", False)),
        "data_quality": data_quality(a),
        "cross_association": cross_association(a_name, df),
    }
