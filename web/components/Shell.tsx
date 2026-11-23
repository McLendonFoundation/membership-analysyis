"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { brandVars, type Brand } from "@/lib/brand";

export default function Shell({ title, subtitle, isAdmin, brand, children }:
  { title: string; subtitle?: string; isAdmin?: boolean; brand?: Brand; children: React.ReactNode }) {
  const router = useRouter();
  const logo = brand ? brand.logo : "/logos/nacda-white.png";
  const signOut = async () => { await supabaseBrowser().auth.signOut(); router.push("/login"); };
  return (
    <div style={brand ? brandVars(brand) : undefined}>
      <header style={{ background: "var(--navy)" }} className="text-white">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
          {logo && (
            <span className={brand && !brand.logoOnDark ? "bg-white rounded-md px-2 py-1" : ""}>
              <img src={logo} alt="" className="h-9 w-auto block" />
            </span>
          )}
          <div className="font-bold tracking-wide uppercase">Membership Dashboard</div>
          <nav className="flex gap-3 text-sm">
            <Link href="/dashboard" className="hover:underline">Dashboard</Link>
            <Link href="/schools" className="hover:underline">Schools</Link>
            {isAdmin && <Link href="/admin" className="hover:underline">Admin</Link>}
          </nav>
          <button onClick={signOut} className="ml-auto text-sm hover:underline">Sign out</button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>{subtitle}</p>}
        <div className="mt-5">{children}</div>
        <footer className="mt-12 pt-4 text-xs border-t" style={{ color: "var(--muted)", borderColor: "var(--rule)" }}>
          Structured with the NACDA Framework (Narrative, Analysis, Causes, Direction, Agenda), adapted from the Trust Insights SAINT framework. Created by Ishita Tibrewal.
        </footer>
      </main>
    </div>
  );
}
