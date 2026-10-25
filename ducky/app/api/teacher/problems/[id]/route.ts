import { HttpError, requirePermission } from "@/lib/auth";
import { errorStatus, readJson } from "@/lib/server/guard";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CONCEPTS = 8;

/**
 * PATCH /api/teacher/problems/:id  { concepts: string[] }
 * Teacher-tagged concepts for one problem (the Transcripts page groups mastery by them).
 * RLS lets only the class's teacher update the problem.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("class:manage");
    const { id } = await params;
    const body = await readJson(req);
    if (!Array.isArray(body.concepts)) throw new HttpError(400, "concepts must be a list.");
    const seen = new Set<string>();
    const concepts = body.concepts
      .filter((c): c is string => typeof c === "string")
      .map((c) => c.replace(/\s+/g, " ").trim().slice(0, 40))
      .filter((c) => c && !seen.has(c.toLowerCase()) && seen.add(c.toLowerCase()));
    if (concepts.length > MAX_CONCEPTS) throw new HttpError(400, `Up to ${MAX_CONCEPTS} concepts per problem.`);

    const supabase = await createClient();
    const { data, error } = await supabase.from("problems").update({ concepts }).eq("id", id).select("id").maybeSingle();
    if (error && error.code !== "22P02") throw new Error(`update concepts: ${error.message}`);
    if (!data) throw new HttpError(404, "No such problem.");
    return Response.json({ concepts });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  }
}
