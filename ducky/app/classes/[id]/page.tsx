import ClassView from "@/components/student/ClassView";

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Demo and real (Supabase) classes both resolve client-side; ClassView shows "not found" if it's neither.
  return <ClassView key={id} classId={id} />;
}
