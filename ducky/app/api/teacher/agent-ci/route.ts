import { requirePermission } from "@/lib/auth";
import { buildBlueprint, lastCiReport, runAgentCi } from "@/lib/server/agentCi";
import { errorStatus } from "@/lib/server/guard";
import { monitorSummary } from "@/lib/server/monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET: the agent blueprint, live monitoring and the last CI report. */
export async function GET() {
  try {
    await requirePermission("class:manage");
    return Response.json({ blueprint: await buildBlueprint(), monitor: monitorSummary(), report: lastCiReport() });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  }
}

/** POST: run the three student personas against the tutor and return a pass/fail report. */
export async function POST() {
  try {
    await requirePermission("class:manage");
    const report = await runAgentCi();
    return Response.json({ blueprint: await buildBlueprint(), monitor: monitorSummary(), report });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  }
}
