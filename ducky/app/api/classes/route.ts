import { requirePermission } from "@/lib/auth";
import { listStudentClasses } from "@/lib/server/classroom";
import { errorStatus } from "@/lib/server/guard";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/classes — the student's real classes and their published problem sets. */
export async function GET() {
  try {
    const student = await requirePermission("class:join");
    return Response.json({ classes: await listStudentClasses(await createClient(), student.userId) });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  }
}
