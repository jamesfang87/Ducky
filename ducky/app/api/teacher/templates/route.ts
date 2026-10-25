import { HttpError, requirePermission } from "@/lib/auth";
import { sanitizePolicy } from "@/lib/server/assignments";
import { errorStatus, readJson } from "@/lib/server/guard";
import { readTemplateText } from "@/lib/server/insights";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/teacher/templates  { name, description?, policy } — saves a tutor agent template. */
export async function POST(req: Request) {
  try {
    const teacher = await requirePermission("policy:edit");
    const body = await readJson(req);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("agent_templates")
      .insert({ teacher_id: teacher.userId, ...readTemplateText(body, false), policy: sanitizePolicy(body.policy) })
      .select("id, updated_at")
      .single();
    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        throw new HttpError(503, "The database is missing agent templates. Run ducky-backend/supabase/migrations/0005_teacher_insights.sql in Supabase.");
      }
      throw new Error(`create template: ${error.message}`);
    }
    return Response.json({ id: data.id, updatedAt: data.updated_at });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  }
}
