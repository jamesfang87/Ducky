import { HttpError, requirePermission } from "@/lib/auth";
import { policyToRow, sanitizePolicy, type TutorMaterial } from "@/lib/server/assignments";
import { errorStatus } from "@/lib/server/guard";
import { parseProblemSet, readUpload, type UploadInput } from "@/lib/server/parseProblemSet";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Reading a long problem set with the model can take a while.
export const maxDuration = 120;

/** Vercel rejects request bodies over 4.5 MB. */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Teacher-only route, so the database's reason is shown instead of a generic "Something went wrong". */
function saveError(what: string, detail: string): HttpError {
  console.error(`[/api/teacher/assignments] save ${what}:`, detail);
  return new HttpError(500, `Couldn't save ${what}: ${detail}`);
}

/**
 * POST /api/teacher/assignments  (multipart form)
 *   classId, title, dueDate? (YYYY-MM-DD), policy (JSON), text?, files? (PDF, images, text)
 * Splits the upload into problems with solutions, steps, hints and misconceptions,
 * and saves it as a draft. The policy comes only from the form, never from the document (ASG-5.3).
 */
export async function POST(req: Request) {
  try {
    await requirePermission("class:manage");
    const form = await req.formData().catch(() => {
      throw new HttpError(400, "Send the problem set as a form upload.");
    });
    const classId = String(form.get("classId") ?? "");
    const title = String(form.get("title") ?? "").trim();
    const dueDate = String(form.get("dueDate") ?? "").trim();
    const pasted = String(form.get("text") ?? "");
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    let policyInput: unknown = {};
    try {
      policyInput = JSON.parse(String(form.get("policy") ?? "{}"));
    } catch {
      throw new HttpError(400, "Settings must be JSON.");
    }
    const policy = sanitizePolicy(policyInput);

    if (!title || title.length > 120) throw new HttpError(400, "Give the problem set a title (up to 120 characters).");
    if (dueDate && !DATE.test(dueDate)) throw new HttpError(400, "Due date must be YYYY-MM-DD.");
    if (files.reduce((n, f) => n + f.size, 0) > MAX_UPLOAD_BYTES) throw new HttpError(413, "Uploads are limited to 4 MB in total.");

    const supabase = await createClient();
    // RLS only returns the class to its teacher.
    const { data: cls } = await supabase.from("classes").select("id").eq("id", classId).maybeSingle();
    if (!cls) throw new HttpError(404, "No such class.");

    const input: UploadInput = { text: pasted, images: [] };
    for (const f of files) {
      const part = await readUpload(f);
      if (part.text) input.text += `\n\n${part.text}`;
      input.images.push(...part.images);
    }
    const { problems, flaggedLines } = await parseProblemSet(input);

    // Ids are made here instead of read back with RETURNING: the RLS check on `problems` looks up the
    // row's class through a function that can't see rows inserted by the same statement, so a read-back fails.
    const asgId = crypto.randomUUID();
    const { error } = await supabase.from("assignments").insert({
      id: asgId,
      class_id: classId,
      title,
      ...policyToRow(policy),
      published: false,
      due_at: dueDate ? `${dueDate}T23:59:00Z` : null,
      source_file: files.map((f) => f.name).join(", ").slice(0, 300) || "Pasted text",
    });
    if (error) throw saveError("the problem set", error.message);

    const ids = problems.map(() => crypto.randomUUID());
    try {
      const { error: pErr } = await supabase.from("problems").insert(
        problems.map((p, i) => ({
          id: ids[i],
          assignment_id: asgId,
          position: i + 1,
          prompt: p.prompt,
          predicted_misconceptions: p.misconceptions,
          flagged_lines: i === 0 ? flaggedLines : [],
        })),
      );
      if (pErr) throw saveError("the problems", pErr.message);
      const { error: sErr } = await supabase.from("problem_solutions").insert(
        problems.map((p, i) => ({
          problem_id: ids[i],
          solution: p.solution,
          rubric: { steps: p.steps, hints: p.hints, opening: p.opening, finalAnswers: p.finalAnswers } satisfies TutorMaterial,
        })),
      );
      if (sErr) throw saveError("the solutions", sErr.message);
    } catch (e) {
      await supabase.from("assignments").delete().eq("id", asgId); // cascades to problems
      throw e;
    }

    return Response.json({ id: asgId, problems: problems.length, flaggedLines });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  }
}
