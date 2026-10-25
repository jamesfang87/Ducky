import { errorStatus, loadOwnSession, readJson } from "@/lib/server/guard";
import { resetSession } from "@/lib/server/store";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/session/reset  { sessionId }
 * Clears this student's progress and saved chat for one question only.
 */
export async function POST(req: Request) {
  try {
    const s = await loadOwnSession((await readJson(req)).sessionId);

    // Delete the transcript first. If this fails, leave the progress alone so
    // the reload doesn't bring the old chat back.
    const supabase = await createClient();
    const { error } = await supabase
      .from("chat_histories")
      .delete()
      .eq("user_id", s.userId)
      .eq("session_id", s.id);
    // 42P01 / PGRST205: the migration hasn't been applied; chat is in localStorage.
    if (error && error.code !== "42P01" && error.code !== "PGRST205") {
      throw new Error(`Couldn't clear the saved chat: ${error.message}`);
    }

    resetSession(s);
    return Response.json({ ok: true });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  }
}
