import { HttpError } from "@/lib/auth";
import { errorStatus, loadOwnSession, readJson } from "@/lib/server/guard";
import { searchResources } from "@/lib/server/serp";
import { getPolicy, getProblem, getSolution, getSteps } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SEARCHES_PER_SESSION = 10;

/**
 * POST /api/resources  { sessionId, topic? }
 * Finds where the student can learn the idea behind their current step (SerpApi). The query
 * is built from the topic and the step, never the problem's exact text, so it points to
 * explanations rather than a solved copy of this problem. Off when the teacher disables
 * web examples.
 */
export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const s = await loadOwnSession(body.sessionId);
    const policy = getPolicy(s);
    if (!policy.tools.webExamples) throw new HttpError(403, "Your teacher turned off web resources for this assignment.");
    if (!process.env.SERPAPI_KEY) throw new HttpError(503, "Resource search isn't configured on the server (SERPAPI_KEY is not set).");
    if ((s.resourceSearches ?? 0) >= MAX_SEARCHES_PER_SESSION) throw new HttpError(429, "That's the most searches for this problem. Try the ones above.");

    const problem = getProblem(s);
    const subject = problem.set.split("·").pop()?.trim() || problem.course;
    const typed = typeof body.topic === "string" ? body.topic.trim().slice(0, 120) : "";
    // Drop this problem's specific values (arrays, numbers) so results explain the concept, not this exact instance.
    const step = (getSteps(s)[s.currentStep] ?? "").replace(/\[[^\]]*\]|\(?[\d.,]+\)?/g, "").replace(/\s+(on|of|for|with)\s*$/i, "").trim();
    const query = `${typed || `${subject} ${step}`} explained`;

    s.resourceSearches = (s.resourceSearches ?? 0) + 1;
    const hideAnswer = !policy.revealAnswers && !s.revealed;
    const resources = await searchResources(query, hideAnswer ? getSolution(s).finalAnswerPatterns : []);
    return Response.json({ query: typed || `${subject}: ${step}`, resources });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  }
}
