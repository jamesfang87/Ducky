import { getProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function join(formData: FormData) {
  "use server";
  const code = String(formData.get("code") ?? "");
  const { supabase } = await getProfile();
  const { error } = await supabase.rpc("join_class", { code });
  if (error) redirect(`/join?code=${encodeURIComponent(code)}&error=${encodeURIComponent(error.message)}`);
  redirect("/student");
}

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string; error?: string }> }) {
  const { code = "", error } = await searchParams;
  const { profile } = await getProfile();
  if (!profile?.role) redirect(`/onboarding?next=${encodeURIComponent(`/join?code=${code}`)}`);
  if (profile.role !== "student") redirect("/");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Join a class</h1>
      <form action={join} className="flex flex-col gap-3">
        <input
          name="code" defaultValue={code} required minLength={6} maxLength={6} autoComplete="off"
          placeholder="ABC234" className="rounded-lg border px-3 py-3 text-center font-mono text-3xl uppercase tracking-widest"
        />
        <button className="rounded-lg bg-yellow-400 py-3 font-semibold text-black">Join</button>
      </form>
      {error && <p className="text-red-600">{error}</p>}
    </main>
  );
}
