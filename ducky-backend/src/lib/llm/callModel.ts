import "server-only";
import { z } from "zod";

// STU-7: the one door every model call goes through.
// Muse Spark speaks the OpenAI chat-completions shape, so the fallback is any OpenAI-compatible provider.

export type Part =
  | { type: "text"; text: string }
  | { type: "image"; url: string }                      // https:// or data:image/...;base64,
  | { type: "pdf"; data: string; filename?: string };   // base64, no data: prefix

export type Message = { role: "system" | "user" | "assistant"; content: string | Part[] };

type Provider = { name: string; baseUrl: string; apiKey: string; model: string };

export type CallModelOptions<T extends z.ZodType> = {
  messages: Message[];
  schema?: T;            // structured output; result is parsed + validated
  schemaName?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;        // per-agent model picker override
};

export type CallModelResult<T> = { data: T; text: string; provider: string; model: string; usage?: unknown };

function providers(): Provider[] {
  const list: Provider[] = [{
    name: "meta",
    baseUrl: process.env.META_BASE_URL ?? "https://api.meta.ai/v1",
    apiKey: process.env.META_API_KEY ?? "",
    model: process.env.META_MODEL ?? "muse-spark-1.2",
  }];
  if (process.env.LLM_FALLBACK === "1" && process.env.FALLBACK_BASE_URL) {
    list.push({
      name: "fallback",
      baseUrl: process.env.FALLBACK_BASE_URL,
      apiKey: process.env.FALLBACK_API_KEY ?? "",
      model: process.env.FALLBACK_MODEL ?? "",
    });
  }
  return list;
}

function toWire(content: Message["content"]) {
  if (typeof content === "string") return content;
  return content.map((p) => {
    if (p.type === "text") return p;
    if (p.type === "image") return { type: "image_url", image_url: { url: p.url } };
    return { type: "file", file: { filename: p.filename ?? "document.pdf", file_data: `data:application/pdf;base64,${p.data}` } };
  });
}

async function callProvider<T extends z.ZodType>(p: Provider, opts: CallModelOptions<T>) {
  const model = p.name === "meta" && opts.model ? opts.model : p.model;
  const body: Record<string, unknown> = {
    model,
    messages: opts.messages.map((m) => ({ role: m.role, content: toWire(m.content) })),
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 1024,
  };
  if (opts.schema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: opts.schemaName ?? "output", strict: true, schema: z.toJSONSchema(opts.schema) },
    };
  }

  const res = await fetch(`${p.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${p.apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`${p.name} ${res.status}: ${(await res.text()).slice(0, 500)}`);

  const json = await res.json();
  const text: string = json.choices?.[0]?.message?.content ?? "";
  const data = opts.schema ? opts.schema.parse(JSON.parse(text)) : text;
  return { data, text, provider: p.name, model, usage: json.usage };
}

export async function callModel<T extends z.ZodType = z.ZodString>(
  opts: CallModelOptions<T>,
): Promise<CallModelResult<T extends z.ZodType ? z.infer<T> : string>> {
  const errors: string[] = [];
  for (const p of providers()) {
    try {
      return (await callProvider(p, opts)) as CallModelResult<never>;
    } catch (e) {
      errors.push(String(e instanceof Error ? e.message : e));
    }
  }
  throw new Error(`callModel failed: ${errors.join(" | ")}`);
}

// ASG-5.1 / 5.4: untrusted text always goes in as data.
export function asDocument(text: string) {
  return `<document>\n${text.replaceAll("</document>", "<\\/document>")}\n</document>`;
}
