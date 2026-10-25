import { requireRole } from "@/lib/auth";
import { SessionProvider } from "@/lib/session";

export default async function ClassesLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("student", "teacher");
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
