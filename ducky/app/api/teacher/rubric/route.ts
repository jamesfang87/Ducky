import { HttpError, requirePermission } from "@/lib/auth";
import { errorStatus, readJson } from "@/lib/server/guard";
import { clearOverride, listOverrides, saveOverride } from "@/lib/server/overrides";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePermission("class:manage");
    return Response.json({ overrides: listOverrides() });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  }
}

/** POST { id, ai, score, reason } saves an override; score null removes it. A reason is required. */
export async function POST(req: Request) {
  try {
    const session = await requirePermission("class:manage");
    const b = await readJson(req);
    if (typeof b.id !== "string" || !b.id) throw new HttpError(400, "id is required.");
    if (b.score === null) {
      clearOverride(b.id);
      return Response.json({ ok: true });
    }
    const score = Number(b.score);
    const ai = Number(b.ai);
    const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 400) : "";
    if (!Number.isFinite(score) || score < 0 || score > 100 || !Number.isFinite(ai)) throw new HttpError(400, "Scores must be numbers from 0 to 100.");
    if (!reason) throw new HttpError(400, "Add a short reason so the student and the next teacher can see why.");
    const by = (session as { user?: { email?: string } }).user?.email ?? "teacher";
    saveOverride({ id: b.id, ai, teacher: Math.round(score), reason, by, at: Date.now() });
    return Response.json({ ok: true });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  }
}
