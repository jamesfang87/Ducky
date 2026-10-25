import AgentTemplates from "@/components/teacher/AgentTemplates";
import TeacherShell, { EmptyState } from "@/components/teacher/TeacherShell";
import { listTeacherSets, listTemplates, MissingMigrationError } from "@/lib/server/insights";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TeacherAgentsPage() {
  const supabase = await createClient();
  try {
    const [templates, sets] = await Promise.all([listTemplates(supabase), listTeacherSets(supabase)]);
    return (
      <TeacherShell>
        <AgentTemplates initialTemplates={templates} sets={sets} />
      </TeacherShell>
    );
  } catch (e) {
    if (!(e instanceof MissingMigrationError)) throw e;
    return (
      <TeacherShell>
        <EmptyState title="Tutor agents need a database update">{e.message}</EmptyState>
      </TeacherShell>
    );
  }
}
