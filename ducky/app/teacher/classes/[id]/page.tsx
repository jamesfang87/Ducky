import { notFound } from "next/navigation";
import TeacherClassView from "@/components/teacher/TeacherClassView";
import { getTeacherClass } from "@/lib/server/classroom";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TeacherClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // RLS returns the class only to its own teacher.
  const detail = await getTeacherClass(await createClient(), id);
  if (!detail) notFound();
  return <TeacherClassView detail={detail} />;
}
