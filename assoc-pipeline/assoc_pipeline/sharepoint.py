"""Copy the newest weekly file from a SharePoint folder into Supabase uploads/current.

Power Automate (standard connectors only) saves the Monday "All Paids" attachment to a SharePoint
folder. This step reads that folder with Microsoft Graph (app-only, Sites.Selected) and copies any
file not yet in Supabase, so the rest of the pipeline is unchanged.

Env: MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET,
     SP_SITE   e.g. mclendonfoundation.sharepoint.com:/sites/Membership
     SP_FOLDER e.g. Weekly Files/current   (path inside the site's default document library)
Usage: python -m assoc_pipeline.sharepoint
Author: Ishita Tibrewal
"""
from __future__ import annotations

import os
import sys
import urllib.parse

import requests

from .supa import Supa

GRAPH = "https://graph.microsoft.com/v1.0"
EXTS = (".xlsx", ".xls", ".csv")
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def token(tenant: str, client: str, secret: str) -> str:
    r = requests.post(f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token", timeout=30,
                      data={"client_id": client, "client_secret": secret, "grant_type": "client_credentials",
                            "scope": "https://graph.microsoft.com/.default"})
    r.raise_for_status()
    return r.json()["access_token"]


def newest_file(s: requests.Session, site: str, folder: str) -> dict | None:
    r = s.get(f"{GRAPH}/sites/{site}", timeout=30)
    r.raise_for_status()
    site_id = r.json()["id"]
    path = urllib.parse.quote(folder.strip("/"))
    r = s.get(f"{GRAPH}/sites/{site_id}/drive/root:/{path}:/children", timeout=30,
              params={"$select": "name,lastModifiedDateTime,@microsoft.graph.downloadUrl,file", "$top": "200"})
    r.raise_for_status()
    files = [f for f in r.json().get("value", []) if "file" in f and f["name"].lower().endswith(EXTS)]
    return max(files, key=lambda f: f["lastModifiedDateTime"]) if files else None


def sync(supa: Supa | None = None, session: requests.Session | None = None, env=os.environ) -> str:
    """Returns 'copied', 'up-to-date', 'empty' or 'not-configured'."""
    need = ["MS_TENANT_ID", "MS_CLIENT_ID", "MS_CLIENT_SECRET", "SP_SITE", "SP_FOLDER"]
    if not all(env.get(k) for k in need):
        print("SharePoint not configured; using files already in Supabase.")
        return "not-configured"
    s = session or requests.Session()
    if session is None:
        s.headers["Authorization"] = "Bearer " + token(env["MS_TENANT_ID"], env["MS_CLIENT_ID"], env["MS_CLIENT_SECRET"])
    f = newest_file(s, env["SP_SITE"], env["SP_FOLDER"])
    if not f:
        print("No file in the SharePoint folder.")
        return "empty"
    supa = supa or Supa()
    stamp = f["lastModifiedDateTime"][:10]
    name = f["name"] if f["name"].startswith(stamp) else f"{stamp}_{f['name']}"
    if any(x["name"] == name for x in supa.list_files("uploads", "current")):
        print(f"Already in Supabase: {name}")
        return "up-to-date"
    data = s.get(f["@microsoft.graph.downloadUrl"], timeout=120)
    data.raise_for_status()
    supa.upload("uploads", f"current/{name}", data.content, XLSX if name.lower().endswith(".xlsx") else "text/csv")
    print(f"Copied {f['name']} to uploads/current/{name}")
    return "copied"


def main() -> int:
    try:
        sync()
    except Exception as e:  # noqa: BLE001
        print(f"ERROR: SharePoint sync failed: {e}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
