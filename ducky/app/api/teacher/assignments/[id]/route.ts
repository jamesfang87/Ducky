import { HttpError, requirePermission } from "@/lib/auth";
import { policyToRow, sanitizePolicy } from "@/lib/server/assignments";
import { requireOwnAssignment } from "@/lib/server/classroom";
import { errorStatus, readJson } from "@/lib/server/guard";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * PATCH /api/teacher/assignments/:id  { policy?, published?, title?, dueDate? }
 * Settings apply to students within a few seconds (lib/server/guard.ts re-reads them).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("class:manage");
    const { id } = await params;
    const body = await readJson(req);
    const supabase = await createClient();
    const current = await requireOwnAssignment(supabase, id);

    const update: Record<string, unknown> = {};
    if (body.policy !== undefined) Object.assign(update, policyToRow(sanitizePolicy(body.policy)));
    if (body.published !== undefined) {
      if (typeof body.published !== "boolean") throw new HttpError(400, "published must be true or false.");
      update.published = body.published;
    }
    if (body.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title || title.length > 120) throw new HttpError(400, "Give the problem set a title (up to 120 characters).");
      update.title = title;
    }
    if (body.dueDate !== undefined) {
      if (body.dueDate !== null && !(typeof body.dueDate === "string" && DATE.test(body.dueDate))) throw new HttpError(400, "Due date must be YYYY-MM-DD.");
      update.due_at = body.dueDate ? `${body.dueDate}T23:59:00Z` : null;
    }
    if (!Object.keys(update).length) return Response.json({ id: current.id });

    const { error } = await supabase.from("assignments").update(update).eq("id", id);
    if (error) throw new Error(`update assignment: ${error.message}`);
    return Response.json({ id });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  }
}

/** DELETE /api/teacher/assignments/:id — removes the set and its problems. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("class:manage");
    const { id } = await params;
    const supabase = await createClient();
    await requireOwnAssignment(supabase, id);
    const { error } = await supabase.from("assignments").delete().eq("id", id);
    if (error) throw new Error(`delete assignment: ${error.message}`);
    return Response.json({ ok: true });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  }
}
