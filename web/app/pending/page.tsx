import { redirect } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import SignOutButton from "@/components/SignOutButton";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Pending() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await supabase.from("profiles").select("status,association_code").eq("user_id", user.id).maybeSingle();
  if (p?.status === "approved") redirect("/");
  const text = !p
    ? "Your account isn't linked to an association yet. Please use your invite link again, or contact your NACDA admin."
    : p.status === "revoked"
      ? "Your access has been turned off. Contact your NACDA admin if you think this is a mistake."
      : `Thanks for signing up for ${p.association_code}. An admin will approve your access shortly; you'll be able to sign in to see your dashboard once approved.`;
  return (
    <AuthCard title={p?.status === "revoked" ? "Access turned off" : "Awaiting approval"}>
      <p className="text-sm">{text}</p>
      <div className="mt-4"><SignOutButton /></div>
    </AuthCard>
  );
}
