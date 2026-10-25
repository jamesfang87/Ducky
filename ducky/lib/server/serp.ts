import "server-only";

/**
 * SerpApi search: grounds generated visuals in real references, and finds study resources
 * for students (/api/resources), and checks whether a teacher's problems are posted online. Results
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

/** Lowercased word tokens; keeps decimals like "1.0" whole so numbers in a problem still match. */
const tokens = (text: string) => text.toLowerCase().match(/[a-z0-9]+(?:\.[0-9]+)?/g) ?? [];

/** Every run of n consecutive words, joined: the unit two texts must share to count as copied. */
function shingles(words: string[], n: number): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) out.add(words.slice(i, i + n).join(" "));
  return out;
}

const pageCache: Map<string, string | null> = ((g as typeof g & { __duckyPageCache?: Map<string, string | null> }).__duckyPageCache ??= new Map());

/** Visible text of a result page, or null when it can't be read (paywall, bot block, timeout, not HTML). */
async function pageText(link: string): Promise<string | null> {
  if (pageCache.has(link)) return pageCache.get(link)!;
  let text: string | null = null;
  try {
    if (!/^https?:$/.test(new URL(link).protocol)) throw new Error("not http");
    const res = await fetch(link, {
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; DuckyLeakCheck/1.0)", accept: "text/html,text/plain" },
    });
    if (!res.ok || !/text\/(html|plain)/.test(res.headers.get("content-type") ?? "")) throw new Error(`page ${res.status}`);
    text = (await res.text())
      .slice(0, 2_000_000)
      .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/g, " ")
      .replace(/&amp;/g, "&");
  } catch {
    text = null;
  }
  pageCache.set(link, text);
  return text;
}

/** Result pages read in full per problem; the rest are scored on their snippet alone. */
const PAGES_TO_READ = 5;

/**
 * Pages that may post this problem (the teacher's answer-leak check).
 * Searches the problem's opening words, both as an exact phrase and loosely, then reads the top
 * result pages and scores each by how much of the problem's wording (5-word runs) appears on it.
 * Pages that block reading (Chegg and the like) are scored on their search snippet instead.
 * Answer-mill sites get a boost, since a copy there usually comes with a worked solution.
 */
export async function searchLeaks(prompt: string, limit = 5): Promise<{ domain: string; title: string; match: number; url: string }[]> {
  const text = prompt.replace(/\s+/g, " ").trim();
  const opening = text.split(" ");
  if (!opening[0]) return [];
  const mine = tokens(text);
  const n = Math.min(5, mine.length);
  const target = shingles(mine, n);

  const [exact, loose] = await Promise.all([search(`"${opening.slice(0, 12).join(" ")}"`), search(opening.slice(0, 24).join(" "))]);
  const seen = new Set<string>();
  const results = [...exact, ...loose].filter((r) => !seen.has(r.link!) && seen.add(r.link!));

  const scored = await Promise.all(
    results.map(async (r, i) => {
      const h = host(r.link!);
      // Snippets are fragments joined by ellipses; score how much of what Google shows is the problem's wording.
      const snippetScore = Math.max(
        0,
        ...r.snippet!.split(/\.\.\.|…/).map((part) => {
          const theirs = shingles(tokens(part), n);
          return theirs.size >= 3 ? [...theirs].filter((s) => target.has(s)).length / theirs.size : 0;
        }),
      );
      const page = i < PAGES_TO_READ ? await pageText(r.link!) : null;
      // On a full page, score how much of the problem appears there.
      const onPage = page ? shingles(tokens(page), n) : null;
      const pageScore = onPage && target.size ? [...target].filter((s) => onPage.has(s)).length / target.size : 0;
      const answerSite = ANSWER_SITES.some((d) => h === d || h.endsWith(`.${d}`));
      const match = Math.min(99, Math.round(100 * Math.max(snippetScore, pageScore) * (answerSite ? 1.25 : 1)));
      return { domain: h, title: r.title ?? h, url: r.link!, match };
    }),
  );
  return scored
    .filter((r) => r.match >= 40)
    .sort((a, b) => b.match - a.match)
    .slice(0, limit);
}
