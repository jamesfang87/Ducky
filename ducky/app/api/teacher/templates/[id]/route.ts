import { HttpError, requirePermission } from "@/lib/auth";
import { sanitizePolicy } from "@/lib/server/assignments";
import { errorStatus, readJson } from "@/lib/server/guard";
import { readTemplateText } from "@/lib/server/insights";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/teacher/templates/:id  { name?, description?, policy? } — RLS limits it to the owner. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("policy:edit");
    const { id } = await params;
    const body = await readJson(req);
    const update: Record<string, unknown> = { ...readTemplateText(body, true), updated_at: new Date().toISOString() };
    if (body.policy !== undefined) update.policy = sanitizePolicy(body.policy);

    const supabase = await createClient();
    const { data, error } = await supabase.from("agent_templates").update(update).eq("id", id).select("id, updated_at").maybeSingle();
    if (error && error.code !== "22P02") throw new Error(`update template: ${error.message}`);
    if (!data) throw new HttpError(404, "No such agent.");
    return Response.json({ id: data.id, updatedAt: data.updated_at });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  }
}

/** DELETE /api/teacher/templates/:id */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("policy:edit");
    const { id } = await params;
    const supabase = await createClient();
    const { data, error } = await supabase.from("agent_templates").delete().eq("id", id).select("id");
    if (error && error.code !== "22P02") throw new Error(`delete template: ${error.message}`);
    if (!data?.length) throw new HttpError(404, "No such agent.");
    return Response.json({ ok: true });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  }
}
