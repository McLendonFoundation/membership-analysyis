import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Starts the weekly GitHub workflow on demand. Admins only. Token stays on the server.
export async function POST() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role,status").eq("user_id", user.id).maybeSingle();
  if (me?.role !== "admin" || me.status !== "approved") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) return NextResponse.json({ error: "GitHub dispatch is not configured" }, { status: 500 });
  const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/weekly.yml/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ ref: "main" }),
  });
  if (!r.ok) return NextResponse.json({ error: `GitHub returned ${r.status}: ${await r.text()}` }, { status: 502 });
  return NextResponse.json({ ok: true });
}
