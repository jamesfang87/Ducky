// Run before building on Muse: `npm run probe:muse` (needs META_API_KEY in .env.local)
// Checks: plain text, structured output (json_schema), image input, PDF input.
const base = process.env.META_BASE_URL ?? "https://api.meta.ai/v1";
const model = process.env.META_MODEL ?? "muse-spark-1.2";
const key = process.env.META_API_KEY;
if (!key) { console.error("Set META_API_KEY in .env.local"); process.exit(1); }

// 1x1 red PNG, and a one-page PDF that says "Ducky probe 42"
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";
const PDF = Buffer.from(`%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 100]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 44>>stream
BT /F1 18 Tf 20 50 Td (Ducky probe 42) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF`).toString("base64");

async function chat(body: object) {
  const r = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, max_tokens: 200, ...body }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${t.slice(0, 300)}`);
  return JSON.parse(t).choices[0].message.content as string;
}

const tests: [string, () => Promise<string>][] = [
  ["text", () => chat({ messages: [{ role: "user", content: "Reply with exactly: pong" }] })],
  ["structured output", async () => {
    const out = await chat({
      messages: [{ role: "user", content: "A student says heavier objects fall faster. Assess." }],
      response_format: { type: "json_schema", json_schema: { name: "turn", strict: true, schema: {
        type: "object", additionalProperties: false, required: ["say", "misconception"],
        properties: { say: { type: "string" }, misconception: { type: ["string", "null"] } },
      } } },
    });
    const parsed = JSON.parse(out);
    if (typeof parsed.say !== "string") throw new Error("schema not followed: " + out);
    return out;
  }],
  ["image input", () => chat({ messages: [{ role: "user", content: [
    { type: "text", text: "What color is this image? One word." },
    { type: "image_url", image_url: { url: `data:image/png;base64,${PNG}` } },
  ] }] })],
  ["pdf input", () => chat({ messages: [{ role: "user", content: [
    { type: "text", text: "What number appears in this PDF? Digits only." },
    { type: "file", file: { filename: "probe.pdf", file_data: `data:application/pdf;base64,${PDF}` } },
  ] }] })],
];

for (const [name, fn] of tests) {
  try { console.log(`✅ ${name}: ${(await fn()).replace(/\s+/g, " ").slice(0, 120)}`); }
  catch (e) { console.log(`❌ ${name}: ${e instanceof Error ? e.message : e}`); }
}
export {};
