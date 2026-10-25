import "server-only";

import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

/**
 * Streaming model adapter (STU-7). Mirrors ducky-backend's `callModel()`:
 * same env vars, same Meta-first order, same opt-in fallback, so one .env
 * works for both apps. Muse Spark speaks the OpenAI chat-completions shape.
 */

export type Tier = "fast" | "deep";

/**
 * Muse Spark is a reasoning model: hidden "thinking" tokens count against max_tokens,
 * so a small budget can come back with an empty reply. Keep conversational turns at
 * minimal effort (fast, ~2-3 s) and give every call room for the thinking.
 */
const EFFORT = { fast: "minimal", deep: "low" } as const;
const THINKING_HEADROOM = 2000;

interface Provider {
  name: string;
  baseURL: string;
  apiKey: string;
  model: Record<Tier, string>;
}

function providers(): Provider[] {
  const deep = process.env.META_MODEL || "muse-spark-1.2";
  const list: Provider[] = [
    {
      name: "meta",
      baseURL: process.env.META_BASE_URL || "https://api.meta.ai/v1",
      apiKey: process.env.META_API_KEY ?? "",
      model: { deep, fast: process.env.META_MODEL_FAST || deep },
    },
  ];
  if (process.env.LLM_FALLBACK === "1" && process.env.FALLBACK_BASE_URL) {
    const model = process.env.FALLBACK_MODEL ?? "";
    list.push({
      name: "fallback",
      baseURL: process.env.FALLBACK_BASE_URL,
      apiKey: process.env.FALLBACK_API_KEY ?? "",
      model: { deep: model, fast: model },
    });
  }
  return list;
}

/**
 * Yields text chunks as the model writes them. A provider is skipped only if it
 * fails before its first chunk; once text has streamed we can't switch mid-reply.
 */
export async function* streamChat({
  messages,
  tier,
}: {
  messages: ChatCompletionMessageParam[];
  tier: Tier;
}): AsyncIterable<string> {
  const errors: string[] = [];
  for (const p of providers()) {
    if (!p.apiKey) {
      errors.push(p.name === "meta" ? "META_API_KEY is not set" : `${p.name}: FALLBACK_API_KEY is not set`);
      continue;
    }
    const client = new OpenAI({ baseURL: p.baseURL, apiKey: p.apiKey, timeout: 60_000, maxRetries: 0 });
    let started = false;
    try {
      const stream = await client.chat.completions.create({
        model: p.model[tier],
        messages,
        stream: true,
        temperature: 0.4,
        max_tokens: (tier === "fast" ? 600 : 1500) + THINKING_HEADROOM,
        ...(p.name === "meta" ? { reasoning_effort: EFFORT[tier] } : {}),
      });
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) {
          started = true;
          yield text;
        }
      }
      return;
    } catch (e) {
      if (started) throw e;
      errors.push(`${p.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(`streamChat failed: ${errors.join(" | ")}`);
}

/** One full (non-streaming) reply. Messages may include image parts for vision review. */
export async function completeChat({
  messages,
  tier,
  maxTokens = 1024,
  temperature = 0.4,
}: {
  messages: ChatCompletionMessageParam[];
  tier: Tier;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const errors: string[] = [];
  for (const p of providers()) {
    if (!p.apiKey) {
      errors.push(p.name === "meta" ? "META_API_KEY is not set" : `${p.name}: FALLBACK_API_KEY is not set`);
      continue;
    }
    const client = new OpenAI({ baseURL: p.baseURL, apiKey: p.apiKey, timeout: 90_000, maxRetries: 0 });
    try {
      const res = await client.chat.completions.create({
        model: p.model[tier],
        messages,
        temperature,
        max_tokens: maxTokens + THINKING_HEADROOM,
        ...(p.name === "meta" ? { reasoning_effort: EFFORT[tier] } : {}),
      });
      return res.choices[0]?.message?.content ?? "";
    } catch (e) {
      errors.push(`${p.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(`completeChat failed: ${errors.join(" | ")}`);
}
