import { HttpError, requirePermission } from "@/lib/auth";
import { errorStatus } from "@/lib/server/guard";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/teacher/classes/:id
 * Deletes a class the caller owns. Enrollments and assignments cascade.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("class:manage");
    const { id } = await params;

    const supabase = await createClient();
    const { data, error } = await supabase.from("classes").delete().eq("id", id).select("id").maybeSingle();
    if (error) {
      // Not a UUID, or a malformed id: treat it as gone from this teacher's view.
      if (error.code === "22P02") throw new HttpError(404, "That class doesn't exist.");
      throw new Error(`delete class: ${error.message}`);
    }
    // RLS hides classes owned by someone else, so no row means no permission or no class.
    if (!data) throw new HttpError(404, "That class doesn't exist, or you don't own it.");

    return Response.json({ ok: true });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  }
}
