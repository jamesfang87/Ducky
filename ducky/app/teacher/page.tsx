import TeacherHome from "@/components/teacher/TeacherHome";
import { getSession } from "@/lib/auth";
import { listTeacherClasses } from "@/lib/server/classroom";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TeacherPage() {
  const session = await getSession(); // the layout already required a teacher
  let classes: Awaited<ReturnType<typeof listTeacherClasses>> = [];
  let loadError: string | null = null;
  try {
    classes = session ? await listTeacherClasses(await createClient(), session.userId) : [];
  } catch (e) {
    console.error("[teacher]", e);
    loadError = "Couldn't load your classes. Refresh to try again.";
  }
  return <TeacherHome classes={classes} loadError={loadError} />;
}
