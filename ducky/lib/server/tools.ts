import "server-only";

/**
 * Every outside tool the tutor agent can call, declared once. Each agent (template + policy)
 * reuses the same connections; the policy only says which ones it may use. The blueprint lists
 * them, and Agent CI shows which are connected on this deployment, so a teacher can see what an
 * agent depends on without reading code.
 */
export interface ToolSpec {
  id: string;
  name: string;
  provider: string;
  usedFor: string;
  /** Env vars this tool needs; "connected" means all are set. */
  needs: string[];
  /** The policy switch that turns it off for an assignment, if any. */
  gatedBy?: string;
}

export const TOOLS: ToolSpec[] = [
  { id: "muse-spark", name: "Muse Spark", provider: "Meta", usedFor: "Tutor turns, grading each step, mapping voice notes onto steps, matching resources to a teacher's explanation", needs: ["META_API_KEY"] },
  { id: "muse-voice-transcribe", name: "Muse Voice Transcribe", provider: "Meta", usedFor: "Students' spoken answers, teachers' voice notes, students' tips", needs: ["META_API_KEY"] },
  { id: "serpapi-google", name: "SerpApi · Google", provider: "SerpApi", usedFor: "Where to learn this, and checking whether a problem is posted online", needs: ["SERPAPI_KEY"], gatedBy: "tools.webExamples" },
  { id: "serpapi-youtube", name: "SerpApi · YouTube", provider: "SerpApi", usedFor: "Videos that explain an idea the same way the teacher did", needs: ["SERPAPI_KEY"] },
  { id: "tts", name: "Ducky's voice", provider: "ElevenLabs", usedFor: "Speaking replies aloud (falls back to the browser's voice)", needs: ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"] },
  { id: "storage", name: "Supabase", provider: "Supabase", usedFor: "Hidden solutions, attempts, voice-note recordings", needs: ["SUPABASE_SERVICE_ROLE_KEY"] },
  { id: "visual-sandbox", name: "Visual sandbox", provider: "Ducky", usedFor: "Animated step-throughs, rendered and reviewed before a student sees them", needs: [], gatedBy: "tools.visualizations" },
];

export function toolStatus() {
  return TOOLS.map((t) => ({ ...t, connected: t.needs.every((k) => !!process.env[k]) }));
}
