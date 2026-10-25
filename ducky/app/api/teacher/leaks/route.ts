import { HttpError, requirePermission } from "@/lib/auth";
import { requireOwnAssignment } from "@/lib/server/classroom";
import { errorStatus, readJson } from "@/lib/server/guard";
import { searchLeaks } from "@/lib/server/serp";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A result repeating this much of the problem's wording counts as a leak. */
const LEAK_AT = 60;

/**
 * POST /api/teacher/leaks  { assignmentId } | { prompt }
 * Searches the web (SerpApi) for each problem in the set and saves what it finds on the problem.
 * With { prompt } (the demo dashboard), checks that one problem text and saves nothing.
 */
export async function POST(req: Request) {
  try {
    await requirePermission("class:manage");
    if (!process.env.SERPAPI_KEY) throw new HttpError(503, "Answer-leak checks need SERPAPI_KEY on the server.");
    const body = await readJson(req);
    if (typeof body.prompt === "string" && body.prompt.trim()) {
      const hits = await searchLeaks(body.prompt.slice(0, 2_000));
      return Response.json({ status: hits.some((h) => h.match >= LEAK_AT) ? "leaked" : "clean", hits, checkedAt: new Date().toISOString() });
    }
    if (typeof body.assignmentId !== "string") throw new HttpError(400, "assignmentId is required.");
    const supabase = await createClient();
    await requireOwnAssignment(supabase, body.assignmentId);

    const { data: problems, error } = await supabase.from("problems").select("id, prompt").eq("assignment_id", body.assignmentId);
    if (error) throw new Error(`load problems: ${error.message}`);

    const checkedAt = new Date().toISOString();
    const results = await Promise.all(
      (problems ?? []).map(async (p) => {
        const hits = await searchLeaks(p.prompt);
        const status = hits.some((h) => h.match >= LEAK_AT) ? "leaked" : "clean";
        const { error: upErr } = await supabase.from("problems").update({ leak_status: status, leak_hits: hits, leak_checked_at: checkedAt }).eq("id", p.id);
        if (upErr) throw new Error(`save leak check: ${upErr.message}`);
        return { problemId: p.id, status, hits, checkedAt };
      }),
    );
    return Response.json({ results });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  }
}
