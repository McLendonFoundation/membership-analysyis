"""Tests on small synthetic exports. Author: Ishita Tibrewal"""
import json

import pandas as pd
import pytest

from assoc_pipeline import analyze, compare, load, run

COLS = ["ID", "Assn", "Assn PM", "PayYear", "RenewStatus", "Mem_Type", "Indiv Type", "First", "Last", "Title",
        "Organization", "City", "State", "Zip", "Email", "Org Type", "Division", "Bkb Conf", "FB Conf",
        "Gender", "Ethnicity", "Region"]


def row(i, assn, status="26-27 Renewal", org="Alpha College", state="MA", zip_="2325", role="Coach",
        gender="Female", pm=None, year="26-27"):
    return [i, assn, pm, year, status, f"{assn} Group", role, "F", "L", "T", org, "City", state, zip_,
            f"p{i}@x.edu", "Institution", "NCAA Div III", "Conf", None, gender, "White", None]


def frame(rows):
    return pd.DataFrame(rows, columns=COLS)


@pytest.fixture
def files(tmp_path):
    cur = [row(i, "AAA", org=f"Org{i % 5}", status="26-27 New Member" if i % 4 == 0 else "26-27 Renewal")
           for i in range(1, 41)]
    cur += [row(1, "AAA")]                                   # exact duplicate
    cur += [row(100 + i, "N4A", status="9/21/2026", org="Beta U") for i in range(15)]
    cur += [row(1, "BBB", org="Org1"), row(500, "BBB", org="Gamma College", state="TX", zip_="75001")]
    prior = [row(i, "AAA", org=f"Org{i % 5}", year="25-26") for i in range(10, 61)]
    c, p = tmp_path / "cur.xlsx", tmp_path / "prior.xlsx"
    frame(cur).to_excel(c, index=False)
    frame(prior).to_excel(p, index=False)
    return c, p, tmp_path


def test_normalize_dedupes_pads_zip_and_drops_ethnicity(files):
    df, rep = load.load(files[0])
    assert rep.duplicates_removed == 1
    assert not df.duplicated(["ID", "Assn"]).any()
    assert "Ethnicity" not in df.columns
    assert df.loc[df["state"] == "MA", "zip5"].eq("02325").all()
    assert df.loc[df["state"] == "MA", "region"].eq("New England").all()


def test_n4a_dates_are_renewals(files):
    df, _ = load.load(files[0])
    n = df[df["Assn"] == "N4A"]
    assert n["status"].eq("Renewal").all() and n["renewal_date"].notna().all()
    k = analyze.kpis(n)
    assert k["new_rate"] is None


def test_missing_column_raises(tmp_path):
    p = tmp_path / "bad.xlsx"
    frame([row(1, "AAA")]).drop(columns=["Assn"]).to_excel(p, index=False)
    with pytest.raises(load.SchemaError):
        load.load(p)


def test_lapsed_and_renewal_rate(files):
    cur, _ = load.load(files[0])
    pri, _ = load.load(files[1])
    summary, lapsed = compare.compare_association("AAA", cur, pri)
    assert summary["prior_members"] == 51
    assert summary["renewed_so_far"] == 31          # IDs 10..40
    assert summary["not_yet_renewed"] == 20 == len(lapsed)
    assert set(lapsed["ID"]) == set(range(41, 61))
    assert summary["not_in_prior_year"] == 9         # IDs 1..9


def test_cross_association_prospects(files):
    cur, _ = load.load(files[0])
    xa = analyze.cross_association("AAA", cur)
    assert any(p["organization"] == "Gamma College" for p in xa["prospect_institutions"])
    assert xa["member_overlap"][0]["association"] == "BBB"


def test_coming_soon_without_feature_columns(files):
    cur, rep = load.load(files[0])
    res = analyze.analyze_association("AAA", cur, rep.features)
    assert res["payment_pace"]["available"] is False
    assert "Coming soon" in res["tenure"]["reason"]


def test_end_to_end_outputs_and_no_pii_in_aggregates(files):
    c, p, out = files
    r = run.run(str(c), str(out / "out"), str(p), as_of="2026-11-02")
    assert r["status"] == "ok"
    d = out / "out" / "2026-11-02"
    agg = (d / "associations" / "AAA.json").read_text()
    assert "@x.edu" not in agg and "—" not in agg and "–" not in agg
    assert json.loads(agg)["nacda"]["narrative"].startswith("AAA has 40 paid members")
    assert (d / "restricted" / "lapsed_AAA.csv").exists()


def test_week_over_week_guard(files):
    _, rep = load.load(files[0])
    prev = {"rows_clean": rep.rows_clean * 2, "associations": {**rep.associations, "ZZZ": 100}}
    problems = load.compare_reports(rep, prev)
    assert any("fell" in x for x in problems) and any("ZZZ" in x for x in problems)
