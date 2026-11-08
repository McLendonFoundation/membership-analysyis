"""Publish/fetch tests against an in-memory fake Supabase. Author: Ishita Tibrewal"""
import json

from assoc_pipeline import fetch, publish, run
from tests.test_pipeline import files  # noqa: F401  (fixture)


class FakeSupa:
    def __init__(self, storage=None):
        self.tables, self.storage, self.deleted = {}, storage or {}, []

    def insert(self, t, row):
        self.tables.setdefault(t, []).append(row)

    def upsert(self, t, rows, on_conflict=None):
        self.tables.setdefault(t, []).extend(rows)

    def delete(self, t, **eq):
        self.deleted.append((t, eq))

    def select(self, t, params):
        return [{"report": {"rows_clean": 1, "associations": {}}}]

    def list_files(self, bucket, prefix):
        return [{"id": "1", "name": n} for n in self.storage.get(prefix, [])]

    def download(self, bucket, path, dest):
        open(dest, "wb").write(b"x")
        return dest


def test_publish_writes_snapshots_and_lapsed_without_pii_in_snapshots(files):  # noqa: F811
    c, p, out = files
    run.run(str(c), str(out / "o"), str(p), as_of="2026-11-02")
    fake = FakeSupa()
    r = publish.publish(str(out / "o" / "2026-11-02"), fake)
    assert r["published"] and r["lapsed_rows"] == 20
    assert all("@" not in json.dumps(s["payload"]) for s in fake.tables["association_snapshots"])
    assert any(row["email"] for row in fake.tables["lapsed_members"])
    assert ("lapsed_members", {"association_code": "AAA"}) in fake.deleted


def test_failed_run_is_logged_but_not_published(tmp_path):
    d = tmp_path / "2026-11-09"
    d.mkdir()
    (d / "run_report.json").write_text(json.dumps({"as_of": "2026-11-09", "status": "failed"}))
    fake = FakeSupa()
    assert publish.publish(str(d), fake)["published"] is False
    assert "association_snapshots" not in fake.tables and len(fake.tables["pipeline_runs"]) == 1


def test_fetch_requires_current_file(tmp_path):
    fake = FakeSupa({"current": ["All Paids 11.02.26.xlsx"], "prior": ["FINAL.xlsx"]})
    got = fetch.fetch(str(tmp_path), fake)
    assert got["current"].endswith("current.xlsx") and "supplement" not in got
    try:
        fetch.fetch(str(tmp_path), FakeSupa({}))
        assert False
    except FileNotFoundError:
        pass
