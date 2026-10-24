import { requireRole } from "@/lib/auth";
import { SessionProvider } from "@/lib/session";

export default async function SessionLayout({ children }: { children: React.ReactNode }) {
  // Teachers can preview a student session; students cannot open the teacher view.
  const session = await requireRole("student", "teacher");
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
