"use client";
import { useRouter } from "next/navigation";

export default function AssociationPicker({ codes, current }: { codes: string[]; current?: string | null }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2 mb-4 text-sm">
      <span style={{ color: "var(--muted)" }}>Viewing as admin:</span>
      <select className="input" style={{ width: 220 }} value={current ?? ""} onChange={(e) => router.push(`/dashboard?a=${encodeURIComponent(e.target.value)}`)}>
        {codes.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}
