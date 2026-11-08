"use client";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  return (
    <button className="btn-ghost" onClick={async () => { await supabaseBrowser().auth.signOut(); router.push("/login"); }}>
      Sign out
    </button>
  );
}
