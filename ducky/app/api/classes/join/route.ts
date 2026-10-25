import { HttpError, requirePermission } from "@/lib/auth";
import { normalizeJoinCode } from "@/lib/classes";
import { errorStatus, readJson } from "@/lib/server/guard";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/classes/join  { code } — enrolls the student through the `join_class` RPC. */
export async function POST(req: Request) {
  try {
    await requirePermission("class:join");
    const code = normalizeJoinCode(String((await readJson(req)).code ?? ""));
    if (code.length !== 6) throw new HttpError(400, "Class codes are 6 characters.");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("join_class", { code });
    if (error) {
      if (/invalid join code/i.test(error.message)) throw new HttpError(404, "No class matches that code. Ask your teacher for the current one.");
      throw new Error(`join_class: ${error.message}`);
    }
    return Response.json({ classId: data as string });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  }
}
