import AgentCi from "@/components/teacher/AgentCi";
import TeacherShell from "@/components/teacher/TeacherShell";

export const dynamic = "force-dynamic";

export default function AgentCiPage() {
  return (
    <TeacherShell>
      <AgentCi />
    </TeacherShell>
  );
}
