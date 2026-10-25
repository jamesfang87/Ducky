import { HttpError, requirePermission } from "@/lib/auth";
import { loadUploadedTemplate, isProblemId } from "@/lib/server/assignments";
import { errorStatus, readJson } from "@/lib/server/guard";
import { noteError } from "@/lib/server/noteError";
import { listDemoProblems, stuckSpots, templateFor, type Template } from "@/lib/server/store";
import { MAX_BYTES } from "@/lib/server/transcribe";
import { createNote, deleteNote, listNotes, TEACHER_MAX_SECONDS, updateNote } from "@/lib/server/voiceNotes";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Transcribing ~8 clips, one Muse pass and one SerpApi + Muse match: usually 15-30 s.
export const maxDuration = 60;

const MAX_NOTE_BYTES = MAX_BYTES * 2 + 1024;

/** Classes this teacher owns (not ones they joined as a student). */
async function taught(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("classes").select("id, name, course_number").eq("teacher_id", userId);
  return { supabase, classes: (data ?? []) as { id: string; name: string; course_number?: string | null }[] };
}

/** The problem a note is for, and the scope it lives in, after checking this teacher may record for it. */
async function problemFor(problemId: unknown, userId: string): Promise<{ template: Template; scope: string }> {
  if (typeof problemId !== "string" || !problemId) throw new HttpError(400, "Pick a problem for this note.");
  const demo = templateFor(problemId);
  if (demo && !isProblemId(problemId)) return { template: demo, scope: "demo" };
  const { supabase, classes } = await taught(userId);
  const template = await loadUploadedTemplate(supabase, problemId);
  if (!template?.classId || !classes.some((c) => c.id === template.classId)) throw new HttpError(404, "That problem isn't in one of your classes.");
  return { template, scope: template.classId };
}

/**
 * GET /api/teacher/voice-notes
 *   { notes, stuck, problems }: this teacher's notes and students' pending tips (demo sets and
 *   their own classes), where students are stuck right now, and the problems they can record for.
 */
export async function GET() {
  try {
    const teacher = await requirePermission("class:manage");
    const { supabase, classes } = await taught(teacher.userId);
    const scopes = new Set(["demo", ...classes.map((c) => c.id)]);
    const notes = (await listNotes()).filter((n) => scopes.has(n.scope));

    const { data: uploaded } = classes.length
      ? await supabase
          .from("problems")
          .select("id, position, prompt, assignments!inner(title, class_id)")
          .in("assignments.class_id", classes.map((c) => c.id))
          .order("position")
      : { data: [] };
    const className = (id: string) => {
      const c = classes.find((x) => x.id === id);
      return c?.course_number || c?.name || "Class";
    };
    const problems = [
      ...((uploaded ?? []) as unknown as { id: string; position: number; prompt: string; assignments: { title: string; class_id: string } }[]).map((p) => ({
        id: p.id,
        group: `${className(p.assignments.class_id)} · ${p.assignments.title}`,
        label: `Problem ${p.position + 1}: ${p.prompt.slice(0, 90)}`,
      })),
      ...listDemoProblems().map((p) => ({ id: p.id, group: `Demo · ${p.course} · ${p.set}`, label: `Problem ${p.index}: ${p.prompt.slice(0, 90)}` })),
    ];
    const stuck = stuckSpots().filter((s) => scopes.has(templateFor(s.sessionId)?.classId ?? "demo"));
    return Response.json({ notes, stuck, problems, maxSeconds: TEACHER_MAX_SECONDS, matching: !!process.env.SERPAPI_KEY });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  }
}

/**
 * POST /api/teacher/voice-notes?problemId=…   body: audio/wav (16 kHz mono 16-bit, ≤ 2 min)
 * Transcribes, maps and matches the note, then returns it (live right away unless Muse found
 * something inaccurate, in which case it waits for the teacher to confirm).
 */
export async function POST(req: Request) {
  try {
    const teacher = await requirePermission("class:manage");
    const problemId = new URL(req.url).searchParams.get("problemId");
    const { template, scope } = await problemFor(problemId, teacher.userId);
    if (Number(req.headers.get("content-length") ?? 0) > MAX_NOTE_BYTES) throw new HttpError(413, "Keep voice notes under 2 minutes.");
    const wav = Buffer.from(await req.arrayBuffer());
    if (wav.length > MAX_NOTE_BYTES) throw new HttpError(413, "Keep voice notes under 2 minutes.");
    const note = await createNote({ wav, template, problemId: problemId!, scope, author: { userId: teacher.userId, name: teacher.name, role: "teacher" } });
    return Response.json({ note });
  } catch (e) {
    return noteError(e);
  }
}

/**
 * PATCH /api/teacher/voice-notes  { id, action: "live" | "hide" | "delete" | "resource", link?, on? }
 * Approve a student's tip (or a flagged note), hide or delete a note, or switch one matched resource.
 */
export async function PATCH(req: Request) {
  try {
    const teacher = await requirePermission("class:manage");
    const body = await readJson(req);
    if (typeof body.id !== "string") throw new HttpError(400, "id is required.");
    const { classes } = await taught(teacher.userId);
    const scopes = new Set(["demo", ...classes.map((c) => c.id)]);
    const existing = (await listNotes()).find((n) => n.id === body.id);
    if (!existing || !scopes.has(existing.scope)) throw new HttpError(404, "No such note.");

    if (body.action === "delete") {
      await deleteNote(existing.id);
      return Response.json({ ok: true });
    }
    const note = await updateNote(existing.id, (n) => {
      if (body.action === "live") n.status = "live";
      else if (body.action === "hide") n.status = "hidden";
      else if (body.action === "resource" && typeof body.link === "string") {
        const r = n.resources.find((x) => x.link === body.link);
        if (r) r.on = body.on === true;
      }
    });
    return Response.json({ note });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  }
}
