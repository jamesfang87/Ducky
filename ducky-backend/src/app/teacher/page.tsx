import { getProfile } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

async function createClass(formData: FormData) {
  "use server";
  const { supabase, user } = await getProfile();
  const name = String(formData.get("name") ?? "").trim();
  if (!user || !name) return;
  const { data, error } = await supabase.from("classes").insert({ teacher_id: user.id, name }).select("id").single();
  if (error) throw new Error(error.message);
  redirect(`/teacher/classes/${data.id}`);
}

export default async function TeacherHome() {
  const { supabase, profile } = await getProfile();
  if (profile?.role !== "teacher") redirect("/");
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, join_code, enrollments(count)")
    .eq("teacher_id", profile.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <h1 className="text-2xl font-bold">Your classes</h1>
      <form action={createClass} className="flex gap-2">
        <input name="name" required maxLength={120} placeholder="e.g. Physics 101" className="flex-1 rounded-lg border px-3 py-2" />
        <button className="rounded-lg bg-yellow-400 px-4 py-2 font-semibold text-black">Create class</button>
      </form>
      <ul className="divide-y rounded-lg border">
        {classes?.map((c) => (
          <li key={c.id}>
            <Link href={`/teacher/classes/${c.id}`} className="flex justify-between p-4 hover:bg-gray-50">
              <span>{c.name}</span>
              <span className="font-mono text-gray-500">
                {c.join_code} · {(c.enrollments as unknown as { count: number }[])[0]?.count ?? 0} students
              </span>
            </Link>
          </li>
        ))}
        {!classes?.length && <li className="p-4 text-gray-500">No classes yet.</li>}
      </ul>
    </main>
  );
}
