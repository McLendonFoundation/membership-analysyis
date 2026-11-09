"use client";
import { useRouter } from "next/navigation";

export default function AssociationPicker({ codes, current, isAdmin }: { codes: string[]; current?: string | null; isAdmin?: boolean }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2 mb-4 text-sm no-print">
      <span style={{ color: "var(--muted)" }}>{isAdmin ? "Viewing as admin:" : "Association:"}</span>
      <select className="input" style={{ width: 220 }} value={current ?? ""} onChange={(e) => router.push(`/dashboard?a=${encodeURIComponent(e.target.value)}`)}>
        {codes.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}
