"""SharePoint sync with fakes, no network. Author: Ishita Tibrewal"""
from assoc_pipeline import sharepoint

ENV = {"MS_TENANT_ID": "t", "MS_CLIENT_ID": "c", "MS_CLIENT_SECRET": "s", "SP_SITE": "x.sharepoint.com:/sites/M",
       "SP_FOLDER": "Weekly Files/current"}


class Resp:
    def __init__(self, j=None, content=b""):
        self._j, self.content = j, content
    def raise_for_status(self): pass
    def json(self): return self._j


class FakeGraph:
    def get(self, url, **kw):
        if url.endswith("/sites/x.sharepoint.com:/sites/M"):
            return Resp({"id": "SITE"})
        if "children" in url:
            return Resp({"value": [
                {"name": "old.xlsx", "lastModifiedDateTime": "2026-11-02T14:00:00Z", "file": {}, "@microsoft.graph.downloadUrl": "u1"},
                {"name": "All Paids.xlsx", "lastModifiedDateTime": "2026-11-09T14:00:00Z", "file": {}, "@microsoft.graph.downloadUrl": "u2"},
                {"name": "notes.txt", "lastModifiedDateTime": "2026-11-10T14:00:00Z", "file": {}, "@microsoft.graph.downloadUrl": "u3"},
                {"name": "folder", "lastModifiedDateTime": "2026-11-11T14:00:00Z"}]})
        assert url == "u2"
        return Resp(content=b"XLSX")


class FakeSupa:
    def __init__(self, existing=()):
        self.existing, self.uploaded = list(existing), []
    def list_files(self, bucket, prefix): return [{"name": n} for n in self.existing]
    def upload(self, bucket, path, data, ct): self.uploaded.append((bucket, path, data))


def test_copies_newest_spreadsheet():
    s = FakeSupa()
    assert sharepoint.sync(s, FakeGraph(), ENV) == "copied"
    assert s.uploaded == [("uploads", "current/2026-11-09_All Paids.xlsx", b"XLSX")]


def test_skips_when_already_copied():
    s = FakeSupa(["2026-11-09_All Paids.xlsx"])
    assert sharepoint.sync(s, FakeGraph(), ENV) == "up-to-date" and not s.uploaded


def test_not_configured():
    assert sharepoint.sync(FakeSupa(), FakeGraph(), {}) == "not-configured"
