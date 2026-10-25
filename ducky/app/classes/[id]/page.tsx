import { notFound } from "next/navigation";
import { CLASS_BY_ID } from "@/lib/classes";
import ClassView from "@/components/student/ClassView";

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!CLASS_BY_ID[id]) notFound();
  return <ClassView key={id} classId={id} />;
}
