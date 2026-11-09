"use client";
import { useEffect } from "react";

export default function PrintOnLoad() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 1500);   // let charts finish drawing
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="no-print mb-4 flex gap-2">
      <button className="btn" onClick={() => window.print()}>Save as PDF</button>
      <span className="text-sm self-center" style={{ color: "var(--muted)" }}>In the print dialog, choose "Save as PDF" as the destination.</span>
    </div>
  );
}
