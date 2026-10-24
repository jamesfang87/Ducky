import { getProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function chooseRole(formData: FormData) {
  "use server";
  const { supabase } = await getProfile();
  const role = formData.get("role");
  const next = String(formData.get("next") || "");
  const { error } = await supabase.rpc("set_my_role", { new_role: role });
  if (error) throw new Error(error.message);
  redirect(role === "student" && next.startsWith("/join") ? next : "/");
}

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { profile } = await getProfile();
  if (profile?.role) redirect("/");
  const { next = "" } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}! Are you a…</h1>
      <form action={chooseRole} className="grid grid-cols-2 gap-4">
        <input type="hidden" name="next" value={next} />
        <button name="role" value="student" className="rounded-xl border p-6 text-lg hover:bg-yellow-50">🎒 Student</button>
        <button name="role" value="teacher" className="rounded-xl border p-6 text-lg hover:bg-yellow-50">🍎 Teacher</button>
      </form>
      <p className="text-sm text-gray-500">You can only choose once.</p>
    </main>
  );
}
