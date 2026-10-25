import "server-only";

/** The JSON the model writes after <<<META>>>, validated field by field. */
export interface TurnMeta {
  step_assessment: "correct" | "partial" | "incorrect" | "off_task" | null;
  misconception: { id: string; evidence: string; confidence: number } | null;
  visual_request: { primitive: string; params: Record<string, unknown>; intent: string } | null;
  hint_used: boolean;
  wants_web_example: string | null;
  current_step: number | null;
  /** Steps the student explained correctly in this message (0-based). */
  steps_completed: number[];
  /** The student has explained the whole chain of reasoning to the answer; the tutor stops asking. */
  reasoning_complete: boolean;
}

export const EMPTY_META: TurnMeta = {
  step_assessment: null,
  misconception: null,
  visual_request: null,
  hint_used: false,
  wants_web_example: null,
  current_step: null,
  steps_completed: [],
  reasoning_complete: false,
};

const ASSESSMENTS = new Set(["correct", "partial", "incorrect", "off_task"]);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Never throws: anything missing or malformed becomes null/false. */
export function parseMeta(raw: string, knownMisconceptions: ReadonlySet<string>, stepCount: number): TurnMeta {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return { ...EMPTY_META };
  let j: unknown;
  try {
    j = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return { ...EMPTY_META };
  }
  if (!isObj(j)) return { ...EMPTY_META };

  const m = j.misconception;
  const misconception =
    isObj(m) && typeof m.id === "string" && knownMisconceptions.has(m.id)
      ? {
          id: m.id,
          evidence: str(m.evidence, 300) ?? "",
          confidence: typeof m.confidence === "number" ? Math.min(1, Math.max(0, m.confidence)) : 0.5,
        }
      : null;

  const v = j.visual_request;
  const visual_request =
    isObj(v) && str(v.primitive, 60)
      ? { primitive: str(v.primitive, 60)!, params: isObj(v.params) ? v.params : {}, intent: str(v.intent, 300) ?? "" }
      : null;

  const step = j.current_step;
  return {
    step_assessment: typeof j.step_assessment === "string" && ASSESSMENTS.has(j.step_assessment) ? (j.step_assessment as TurnMeta["step_assessment"]) : null,
    misconception,
    visual_request,
    hint_used: j.hint_used === true,
    wants_web_example: str(j.wants_web_example, 120),
    current_step: typeof step === "number" && Number.isInteger(step) && step >= 0 && step < stepCount ? step : null,
    steps_completed: Array.isArray(j.steps_completed)
      ? [...new Set(j.steps_completed.filter((i): i is number => typeof i === "number" && Number.isInteger(i) && i >= 0 && i < stepCount))]
      : [],
    reasoning_complete: j.reasoning_complete === true,
  };
}
