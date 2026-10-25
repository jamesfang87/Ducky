import "server-only";

export type SseEvent = "say" | "meta" | "done" | "error";

const enc = new TextEncoder();

export function sseFrame(event: SseEvent, data: unknown): Uint8Array {
  return enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export const SSE_HEADERS = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
  connection: "keep-alive",
  "x-accel-buffering": "no",
};

/** Errors use the same SSE format as success, so the client parses one thing. */
export function sseError(status: number, message: string): Response {
  const body = new Uint8Array([...sseFrame("error", { message }), ...sseFrame("done", {})]);
  return new Response(body, { status, headers: SSE_HEADERS });
}
