import "server-only";

/**
 * SerpApi search: grounds generated visuals in real references, and finds study resources
 * for students (/api/resources). Results
 * are cached in memory by query so repeat requests are instant and don't burn
 * credits. Failures return [] so a search problem never blocks a visual.
 */

export interface Snippet {
  title: string;
  snippet: string;
  source: string;
}

interface Organic {
  title?: string;
  snippet?: string;
  link?: string;
}

const g = globalThis as typeof globalThis & { __duckySerpCache?: Map<string, Organic[]> };
const cache = (g.__duckySerpCache ??= new Map());

/** Raw Google results for a query, cached by query. [] when there's no key or the search fails. */
async function search(query: string): Promise<Organic[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return [];
  const q = query.trim().slice(0, 300);
  const hit = cache.get(q);
  if (hit) return hit;

  const url = new URL("https://serpapi.com/search.json");
  url.search = new URLSearchParams({ engine: "google", q, num: "10", hl: "en", api_key: key }).toString();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6_000), cache: "no-store" });
    if (!res.ok) throw new Error(`SerpApi ${res.status}`);
    const json = (await res.json()) as { organic_results?: Organic[] };
    const out = (json.organic_results ?? []).filter((r) => r.snippet && r.link);
    cache.set(q, out);
    return out;
  } catch (e) {
    console.warn("[serp] search failed:", e instanceof Error ? e.message : e);
    return [];
  }
}

const host = (link: string) => new URL(link).hostname.replace(/^www\./, "");

export async function searchSnippets(query: string, limit = 3): Promise<Snippet[]> {
  return (await search(query))
    .slice(0, limit)
    .map((r) => ({ title: r.title ?? "", snippet: r.snippet!.slice(0, 400), source: host(r.link!) }));
}

export interface Resource extends Snippet {
  link: string;
}

/** Homework-answer sites: they post worked solutions, not explanations. */
const ANSWER_SITES = ["chegg.com", "coursehero.com", "quizlet.com", "brainly.com", "numerade.com", "studocu.com", "bartleby.com", "transtutors.com"];

/**
 * Places a student can go to learn the idea behind a step (tutorials, course notes, references).
 * Answer-mill sites are excluded, and any result whose title or snippet matches `blocked`
 * (the problem's final-answer patterns) is dropped so the list never hands over the answer.
 */
export async function searchResources(query: string, blocked: RegExp[] = [], limit = 5): Promise<Resource[]> {
  const q = `${query} ${ANSWER_SITES.map((d) => `-site:${d}`).join(" ")}`;
  const seen = new Set<string>();
  return (await search(q))
    .filter((r) => {
      const h = host(r.link!);
      const text = `${r.title ?? ""} ${r.snippet}`;
      if (ANSWER_SITES.some((d) => h === d || h.endsWith(`.${d}`)) || seen.has(h) || blocked.some((p) => p.test(text))) return false;
      seen.add(h); // one result per site keeps the list varied
      return true;
    })
    .slice(0, limit)
    .map((r) => ({ title: r.title ?? host(r.link!), snippet: r.snippet!.slice(0, 300), source: host(r.link!), link: r.link! }));
}
