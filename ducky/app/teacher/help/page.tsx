import HelpQueue from "@/components/teacher/HelpQueue";
import TeacherShell from "@/components/teacher/TeacherShell";

export const dynamic = "force-dynamic";

export default function TeacherHelpPage() {
  return (
    <TeacherShell>
      <HelpQueue />
    </TeacherShell>
  );
}
