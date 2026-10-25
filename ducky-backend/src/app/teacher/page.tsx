import { isValidCourseNumber, normalizeCourseNumber } from "@/lib/courseNumber";
import { getProfile } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

async function createClass(formData: FormData) {
  "use server";
  const { supabase, user } = await getProfile();
  const name = String(formData.get("name") ?? "").trim();
  const course_number = normalizeCourseNumber(String(formData.get("course_number") ?? ""));
  if (!user || !name) return;
  if (!isValidCourseNumber(course_number)) throw new Error("Enter a course number like PHYS 1401.");
  const { data, error } = await supabase
    .from("classes")
    .insert({ teacher_id: user.id, name, course_number })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/teacher/classes/${data.id}`);
}

export default async function TeacherHome() {
  const { supabase, profile } = await getProfile();
  if (profile?.role !== "teacher") redirect("/");
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, course_number, join_code, enrollments(count)")
    .eq("teacher_id", profile.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <h1 className="text-2xl font-bold">Your classes</h1>
      <form action={createClass} className="flex flex-wrap gap-2">
        <input
          name="course_number"
          required
          maxLength={20}
          pattern="\s*[A-Za-z0-9][A-Za-z0-9 .\-]{0,18}[A-Za-z0-9]\s*"
          title="Letters, numbers, spaces, dots or dashes, e.g. PHYS 1401"
          placeholder="Course number, e.g. PHYS 1401"
          aria-label="Course number"
          className="w-56 rounded-lg border px-3 py-2 uppercase"
        />
        <input name="name" required maxLength={120} placeholder="Class name, e.g. Mechanics & Waves" aria-label="Class name" className="min-w-48 flex-1 rounded-lg border px-3 py-2" />
        <button className="rounded-lg bg-yellow-400 px-4 py-2 font-semibold text-black">Create class</button>
      </form>
      <ul className="divide-y rounded-lg border">
        {classes?.map((c) => (
          <li key={c.id}>
            <Link href={`/teacher/classes/${c.id}`} className="flex justify-between p-4 hover:bg-gray-50">
              <span>
                {c.course_number && <span className="mr-2 font-mono font-semibold">{c.course_number}</span>}
                {c.name}
              </span>
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
