"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sb = supabaseBrowser();

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setMsg(error.message);
    router.push("/"); router.refresh();
  };
  const reset = async () => {
    if (!email) return setMsg("Enter your email first.");
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/callback` });
    setMsg(error ? error.message : "Check your email for a reset link.");
  };

  return (
    <AuthCard title="Sign in">
      <form onSubmit={signIn} className="space-y-3">
        <input className="input" type="email" placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className="btn w-full" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
      </form>
      <button onClick={reset} className="text-sm mt-3 underline" style={{ color: "var(--muted)" }}>Forgot password?</button>
      {msg && <p className="text-sm mt-3" style={{ color: "var(--accent)" }}>{msg}</p>}
      <p className="text-xs mt-4" style={{ color: "var(--muted)" }}>New here? Use the invite link from your NACDA contact.</p>
    </AuthCard>
  );
}
