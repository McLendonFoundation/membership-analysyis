"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import { supabaseBrowser } from "@/lib/supabase/client";

function SignupForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const sb = supabaseBrowser();
  const [valid, setValid] = useState<boolean | null>(null);
  const [fixed, setFixed] = useState<string | null>(null);
  const [assns, setAssns] = useState<{ code: string; name: string | null }[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [picked, setPicked] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) return setValid(false);
      const { data } = await sb.rpc("check_invite", { p_token: token });
      const row = Array.isArray(data) ? data[0] : null;
      setValid(!!row?.valid);
      if (row?.association_code) { setFixed(row.association_code); setPicked([row.association_code]); }
      const { data: a } = await sb.from("associations").select("code,name").order("code");
      setAssns(a ?? []);
    })();
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null);
    if (!picked.length) return setMsg("Choose at least one association.");
    const { data, error } = await sb.auth.signUp({
      email: form.email, password: form.password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
        data: { full_name: form.name, invite_token: token, association_codes: picked },
      },
    });
    if (error) return setMsg(error.message);
    if (data.session) {
      const { error: e2 } = await sb.rpc("redeem_invite_multi", { p_token: token, p_associations: picked, p_full_name: form.name });
      if (e2) return setMsg(e2.message);
      router.push("/pending");
    } else setDone(true);
  };

  if (valid === null) return <AuthCard title="Create your account"><p className="text-sm">Checking your invite...</p></AuthCard>;
  if (!valid) return <AuthCard title="Invite not valid"><p className="text-sm">This invite link is missing, expired or already used up. Ask your NACDA contact for a new one.</p></AuthCard>;
  if (done) return <AuthCard title="Check your email"><p className="text-sm">We sent a confirmation link to {form.email}. After you confirm, an admin will approve your access.</p></AuthCard>;

  return (
    <AuthCard title="Create your account">
      <form onSubmit={submit} className="space-y-3">
        <input className="input" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="input" type="email" placeholder="Work email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className="input" type="password" minLength={8} placeholder="Password (8+ characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <fieldset>
          <legend className="text-sm font-semibold mb-1">{fixed ? "Association" : "Your associations (choose all that apply)"}</legend>
          <div className="grid grid-cols-2 gap-1 max-h-56 overflow-y-auto border rounded p-2" style={{ borderColor: "var(--rule)" }}>
            {assns.filter((a) => !fixed || a.code === fixed).map((a) => (
              <label key={a.code} className="text-sm flex items-center gap-2">
                <input type="checkbox" disabled={!!fixed} checked={picked.includes(a.code)}
                  onChange={(e) => setPicked(e.target.checked ? [...picked, a.code] : picked.filter((c) => c !== a.code))} />
                {a.code}
              </label>
            ))}
          </div>
        </fieldset>
        <button className="btn w-full">Create account</button>
      </form>
      {msg && <p className="text-sm mt-3" style={{ color: "var(--accent)" }}>{msg}</p>}
    </AuthCard>
  );
}

export default function Signup() {
  return <Suspense><SignupForm /></Suspense>;
}
