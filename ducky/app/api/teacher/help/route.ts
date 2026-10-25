import { HttpError, requirePermission } from "@/lib/auth";
import { errorStatus, readJson } from "@/lib/server/guard";
import { listEscalations, listGuardEvents, resolveEscalation } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/teacher/help: raised hands (with peer suggestions) and moments the guard stepped in. */
export async function GET() {
  try {
    await requirePermission("class:manage");
    return Response.json({ escalations: listEscalations(), guardEvents: listGuardEvents() });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  }
}

/** POST /api/teacher/help  { id, note? } marks a raised hand as handled. */
export async function POST(req: Request) {
  try {
    await requirePermission("class:manage");
    const body = await readJson(req);
    if (typeof body.id !== "string") throw new HttpError(400, "id is required.");
    if (!resolveEscalation(body.id, typeof body.note === "string" ? body.note : "")) throw new HttpError(404, "No such request.");
    return Response.json({ ok: true });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  }
}
