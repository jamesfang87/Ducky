// Single entry point for every model call in Ducky.
// Default provider: Meta Muse Spark (OpenAI-compatible endpoint at api.meta.ai/v1).
// A second provider is used only when LLM_FALLBACK=1 (e.g. if Muse is down on demo day).

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } }; // PDF as data: URL

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface CallModelOptions {
  messages: ChatMessage[];
  /** JSON Schema -> structured output. The parsed object is returned in `json`. */
  schema?: { name: string; schema: Record<string, unknown> };
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface CallModelResult {
  text: string;
  json?: unknown;
  provider: "muse" | "fallback";
}

const MUSE_URL = process.env.META_API_BASE ?? "https://api.meta.ai/v1";
const MUSE_MODEL = process.env.META_MODEL ?? "muse-spark";

async function post(
  base: string,
  key: string,
  model: string,
  o: CallModelOptions,
): Promise<{ text: string; json?: unknown }> {
  const body: Record<string, unknown> = {
    model,
    messages: o.messages,
    temperature: o.temperature ?? 0.4,
    max_tokens: o.maxTokens ?? 1024,
  };
  if (o.schema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: o.schema.name, schema: o.schema.schema, strict: true },
    };
  }
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${base} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";
  return { text, json: o.schema ? JSON.parse(text) : undefined };
}

export async function callModel(o: CallModelOptions): Promise<CallModelResult> {
  const key = process.env.META_API_KEY;
  if (!key) throw new Error("META_API_KEY is not set");
  try {
    return { ...(await post(MUSE_URL, key, o.model ?? MUSE_MODEL, o)), provider: "muse" };
  } catch (err) {
    if (process.env.LLM_FALLBACK !== "1") throw err;
    const fbKey = process.env.FALLBACK_API_KEY;
    const fbBase = process.env.FALLBACK_API_BASE;
    const fbModel = process.env.FALLBACK_MODEL;
    if (!fbKey || !fbBase || !fbModel) throw err;
    return { ...(await post(fbBase, fbKey, fbModel, o)), provider: "fallback" };
  }
}
