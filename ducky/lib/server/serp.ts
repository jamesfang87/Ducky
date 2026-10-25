import "server-only";

/**
 * SerpApi search, used to ground generated visuals in real references. Results
 * are cached in memory by query so repeat requests are instant and don't burn
 * credits. Failures return [] so a search problem never blocks a visual.
 */

export interface Snippet {
  title: string;
  snippet: string;
  source: string;
}

const g = globalThis as typeof globalThis & { __duckySerpCache?: Map<string, Snippet[]> };
const cache = (g.__duckySerpCache ??= new Map());

export async function searchSnippets(query: string, limit = 3): Promise<Snippet[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return [];
  const q = query.trim().slice(0, 200);
  const hit = cache.get(q);
  if (hit) return hit.slice(0, limit);

  const url = new URL("https://serpapi.com/search.json");
  url.search = new URLSearchParams({ engine: "google", q, num: "6", hl: "en", api_key: key }).toString();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6_000), cache: "no-store" });
    if (!res.ok) throw new Error(`SerpApi ${res.status}`);
    const json = (await res.json()) as { organic_results?: { title?: string; snippet?: string; link?: string }[] };
    const out: Snippet[] = (json.organic_results ?? [])
      .filter((r) => r.snippet && r.link)
      .slice(0, 6)
      .map((r) => ({ title: r.title ?? "", snippet: r.snippet!.slice(0, 400), source: new URL(r.link!).hostname }));
    cache.set(q, out);
    return out.slice(0, limit);
  } catch (e) {
    console.warn("[serp] search failed:", e instanceof Error ? e.message : e);
    return [];
  }
}
