export default function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--tint)" }}>
      <div className="card w-full max-w-md">
        <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--accent)" }}>Membership Dashboard</div>
        <h1 className="text-xl font-bold mt-1 mb-4">{title}</h1>
        {children}
      </div>
    </div>
  );
}
