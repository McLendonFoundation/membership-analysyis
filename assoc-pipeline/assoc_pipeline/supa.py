"""Minimal Supabase REST client (PostgREST + Storage) using the service key.

Reads SUPABASE_URL and SUPABASE_SERVICE_KEY from the environment. Never commit the key.
Author: Ishita Tibrewal
"""
from __future__ import annotations

import os
import urllib.parse

import requests


class Supa:
    def __init__(self, url: str | None = None, key: str | None = None, timeout: int = 60):
        raw = (url or os.environ.get("SUPABASE_URL", "")).strip()
        # Accept https://xyz.supabase.co, .../ or .../rest/v1/ : keep only scheme + host.
        u = urllib.parse.urlparse(raw)
        self.url = f"{u.scheme}://{u.netloc}" if u.scheme and u.netloc else raw.rstrip("/")
        self.key = key or os.environ.get("SUPABASE_SERVICE_KEY", "")
        if not self.url or not self.key:
            raise RuntimeError("Set SUPABASE_URL and SUPABASE_SERVICE_KEY")
        self.timeout = timeout
        self.s = requests.Session()
        self.s.headers.update({"apikey": self.key, "Authorization": f"Bearer {self.key}"})

    # ---- tables ----
    def upsert(self, table: str, rows: list[dict], on_conflict: str | None = None, chunk: int = 500):
        if not rows:
            return
        params = {"on_conflict": on_conflict} if on_conflict else {}
        for i in range(0, len(rows), chunk):
            r = self.s.post(f"{self.url}/rest/v1/{table}", params=params, json=rows[i:i + chunk],
                            headers={"Prefer": "resolution=merge-duplicates,return=minimal"}, timeout=self.timeout)
            r.raise_for_status()

    def insert(self, table: str, row: dict) -> None:
        r = self.s.post(f"{self.url}/rest/v1/{table}", json=row, headers={"Prefer": "return=minimal"},
                        timeout=self.timeout)
        r.raise_for_status()

    def delete(self, table: str, **eq):
        params = {k: f"eq.{v}" for k, v in eq.items()}
        r = self.s.delete(f"{self.url}/rest/v1/{table}", params=params, timeout=self.timeout)
        r.raise_for_status()

    def select(self, table: str, params: dict) -> list[dict]:
        r = self.s.get(f"{self.url}/rest/v1/{table}", params=params, timeout=self.timeout)
        r.raise_for_status()
        return r.json()

    # ---- storage ----
    def list_files(self, bucket: str, prefix: str) -> list[dict]:
        r = self.s.post(f"{self.url}/storage/v1/object/list/{bucket}",
                        json={"prefix": prefix, "limit": 100, "sortBy": {"column": "updated_at", "order": "desc"}},
                        timeout=self.timeout)
        if r.status_code == 404:
            raise RuntimeError(f"Storage returned 404 for bucket '{bucket}': {r.text[:200]}. "
                               "Check the bucket name and that SUPABASE_URL is this project's Project URL.")
        r.raise_for_status()
        return [f for f in r.json() if f.get("id")]          # folders have no id

    def download(self, bucket: str, path: str, dest: str) -> str:
        r = self.s.get(f"{self.url}/storage/v1/object/{bucket}/{urllib.parse.quote(path)}", timeout=self.timeout)
        r.raise_for_status()
        with open(dest, "wb") as fh:
            fh.write(r.content)
        return dest

    def upload(self, bucket: str, path: str, data: bytes, content_type: str = "application/octet-stream") -> None:
        r = self.s.post(f"{self.url}/storage/v1/object/{bucket}/{urllib.parse.quote(path)}", data=data,
                        headers={"Content-Type": content_type, "x-upsert": "true"}, timeout=self.timeout)
        r.raise_for_status()
