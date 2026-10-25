import Link from "next/link";
import TranscriptsView from "@/components/teacher/TranscriptsView";
import TeacherShell, { EmptyState } from "@/components/teacher/TeacherShell";
import { loadClassPage } from "@/lib/server/insights";

export const dynamic = "force-dynamic";

export default async function TeacherTranscriptsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const data = await loadClassPage(params.class);
  return (
    <TeacherShell>
      {data.status === "ok" ? (
        <TranscriptsView
          key={data.insights.classId}
          classes={data.classes}
          insights={data.insights}
          recording={data.recording}
        />
      ) : data.status === "no_classes" ? (
        <EmptyState title="No classes yet">
          Create a class and upload a problem set on <Link href="/teacher">My classes</Link>. Grades show up here once students start working.
        </EmptyState>
      ) : (
        <EmptyState title="Transcripts need a database update">{data.message}</EmptyState>
      )}
    </TeacherShell>
  );
}
