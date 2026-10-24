import { requireRole } from "@/lib/auth";
import { SessionProvider } from "@/lib/session";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("teacher");
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
