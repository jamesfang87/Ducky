import { getProfile } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function StudentHome() {
  const { supabase, profile } = await getProfile();
  if (profile?.role !== "student") redirect("/");
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("joined_at, classes(id, name, course_number)")
    .eq("student_id", profile.id)
    .order("joined_at", { ascending: false });

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My classes</h1>
        <Link href="/join" className="rounded-lg bg-yellow-400 px-4 py-2 font-semibold text-black">Join a class</Link>
      </div>
      <ul className="divide-y rounded-lg border">
        {enrollments?.map((e) => {
          const c = e.classes as unknown as { id: string; name: string; course_number: string | null };
          return (
            <li key={c.id} className="p-4">
              {c.course_number && <span className="mr-2 font-mono font-semibold">{c.course_number}</span>}
              {c.name}
            </li>
          );
        })}
        {!enrollments?.length && <li className="p-4 text-gray-500">Not enrolled in any classes yet.</li>}
      </ul>
    </main>
  );
}
