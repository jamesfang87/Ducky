import TeacherShell from "@/components/teacher/TeacherShell";
import VoiceNotes from "@/components/teacher/VoiceNotes";

export const dynamic = "force-dynamic";

export default function TeacherVoicePage() {
  return (
    <TeacherShell>
      <VoiceNotes />
    </TeacherShell>
  );
}
