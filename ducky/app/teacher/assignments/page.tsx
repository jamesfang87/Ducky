import Link from "next/link";
import AssignmentsView from "@/components/teacher/AssignmentsView";
import TeacherShell, { EmptyState } from "@/components/teacher/TeacherShell";
import { loadClassPage } from "@/lib/server/insights";

export const dynamic = "force-dynamic";

export default async function TeacherAssignmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const data = await loadClassPage(params.class);
  return (
    <TeacherShell>
      {data.status === "ok" ? (
        <AssignmentsView
          key={data.insights.classId}
          classes={data.classes}
          insights={data.insights}
          recording={data.recording}
          leakChecks={!!process.env.SERPAPI_KEY}
          initialSetId={typeof params.set === "string" ? params.set : undefined}
        />
      ) : data.status === "no_classes" ? (
        <EmptyState title="No classes yet">
          Create a class and upload a problem set on <Link href="/teacher">My classes</Link>. Assignments show up here once students start working.
        </EmptyState>
      ) : (
        <EmptyState title="Assignments need a database update">{data.message}</EmptyState>
      )}
    </TeacherShell>
  );
}
