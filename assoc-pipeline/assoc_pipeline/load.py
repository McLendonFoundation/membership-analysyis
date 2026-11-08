"""Load, validate and normalize a NetForum "All Paids" export.

Author: Ishita Tibrewal
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

from . import config


class SchemaError(ValueError):
    """Raised when the export is missing required columns or is empty."""


@dataclass
class LoadReport:
    source: str
    rows_raw: int
    rows_clean: int
    duplicates_removed: int
    pay_years: list[str]
    associations: dict[str, int]
    warnings: list[str] = field(default_factory=list)
    features: dict[str, bool] = field(default_factory=dict)


def read_export(path: str | Path) -> pd.DataFrame:
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(path)
    if path.suffix.lower() in {".xlsx", ".xlsm", ".xls"}:
        df = pd.read_excel(path, dtype={"Zip": str})
    else:
        df = pd.read_csv(path, dtype={"Zip": str})
    df.columns = [str(c).strip() for c in df.columns]
    return df


def validate(df: pd.DataFrame) -> list[str]:
    missing = [c for c in config.REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise SchemaError(f"Missing required columns: {missing}")
    if df.empty:
        raise SchemaError("File has no rows")
    warnings = []
    if df["ID"].isna().any():
        warnings.append(f"{int(df['ID'].isna().sum())} rows without ID were dropped")
    if df["Assn"].isna().any():
        warnings.append(f"{int(df['Assn'].isna().sum())} rows without Assn were dropped")
    return warnings


def _zip5(z) -> str | None:
    if pd.isna(z):
        return None
    s = str(z).strip().split("-")[0].split(".")[0]
    return s.zfill(5) if s.isdigit() and len(s) <= 5 else s


def _find(df: pd.DataFrame, names: list[str]) -> str | None:
    return next((n for n in names if n in df.columns), None)


def normalize(df: pd.DataFrame) -> tuple[pd.DataFrame, int, dict[str, bool]]:
    """Return a clean one-row-per-(ID, Assn) frame, duplicates removed, and feature flags."""
    df = df.drop(columns=[c for c in config.EXCLUDED_COLUMNS if c in df.columns]).copy()
    df = df.dropna(subset=["ID", "Assn"])
    df["ID"] = df["ID"].astype("int64")
    df["Assn"] = df["Assn"].astype(str).str.strip()

    # Primary Member: the org's primary contact for a team or department. A flag, not a member.
    df["is_primary_member"] = df["Assn PM"].notna()

    raw_status = df["RenewStatus"].astype(str).str.strip()
    code = raw_status.str.extract(r"(Renewal|New Member)", expand=False)
    status_date = pd.to_datetime(raw_status.where(code.isna()), errors="coerce", format="mixed")
    df["status"] = code.fillna(
        pd.Series(["Renewal" if a in config.DATE_STATUS_ASSNS else "Unknown" for a in df["Assn"]], index=df.index)
    )
    df["renewal_date"] = status_date
    df["is_new"] = df["status"].eq("New Member")

    df["zip5"] = df["Zip"].map(_zip5)
    df["state"] = df["State"].astype(str).str.strip().str.upper().where(df["State"].notna())
    df["region"] = df["state"].map(config.STATE_TO_REGION).fillna(config.OTHER_REGION)

    for col in ["Indiv Type", "Org Type", "Division", "Bkb Conf", "FB Conf", "Gender", "Organization", "Mem_Type"]:
        df[col] = df[col].astype("string").str.strip()

    features = {}
    pd_col = _find(df, config.OPTIONAL_FEATURE_COLUMNS["paid_date"])
    ty_col = _find(df, config.OPTIONAL_FEATURE_COLUMNS["total_years"])
    df["paid_date"] = pd.to_datetime(df[pd_col], errors="coerce") if pd_col else pd.NaT
    df["total_years"] = pd.to_numeric(df[ty_col], errors="coerce") if ty_col else float("nan")
    features["paid_date"] = bool(df["paid_date"].notna().any())
    features["total_years"] = bool(df["total_years"].notna().any())

    before = len(df)
    # Keep the row flagged as Primary Member if a person appears twice in one association.
    df = df.sort_values(["ID", "Assn", "is_primary_member"], ascending=[True, True, False])
    df = df.drop_duplicates(["ID", "Assn"], keep="first").reset_index(drop=True)
    return df, before - len(df), features


def load(path: str | Path) -> tuple[pd.DataFrame, LoadReport]:
    raw = read_export(path)
    warnings = validate(raw)
    clean, dups, features = normalize(raw)
    unknown = clean[clean["status"].eq("Unknown")]
    if len(unknown):
        warnings.append(f"{len(unknown)} rows have an unrecognized RenewStatus "
                        f"({', '.join(sorted(unknown['Assn'].unique()))})")
    report = LoadReport(
        source=Path(path).name,
        rows_raw=len(raw),
        rows_clean=len(clean),
        duplicates_removed=dups,
        pay_years=sorted(clean["PayYear"].dropna().astype(str).unique().tolist()),
        associations=clean["Assn"].value_counts().to_dict(),
        warnings=warnings,
        features=features,
    )
    return clean, report


def compare_reports(current: LoadReport, previous: dict | None, max_drop: float = 0.10) -> list[str]:
    """Week-over-week sanity checks. Returns blocking problems (empty list = OK)."""
    if not previous:
        return []
    problems = []
    if current.rows_clean < previous["rows_clean"] * (1 - max_drop):
        problems.append(f"Rows fell from {previous['rows_clean']} to {current.rows_clean} (more than {max_drop:.0%})")
    missing = set(previous["associations"]) - set(current.associations)
    if missing:
        problems.append(f"Associations missing this week: {sorted(missing)}")
    for a, n in previous["associations"].items():
        if a in current.associations and current.associations[a] < n * (1 - max_drop) and n >= 50:
            problems.append(f"{a} fell from {n} to {current.associations[a]}")
    return problems
