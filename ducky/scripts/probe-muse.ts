// Run: npm run probe:muse   (needs META_API_KEY in .env.local)
// Checks the four capabilities Ducky depends on. You want a check on all four.
import { callModel, type ChatMessage } from "../lib/llm/callModel";

// 1x1 red PNG
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";
// Minimal one-page PDF containing the word "DUCKY"
const PDF =
  "data:application/pdf;base64," +
  Buffer.from(
    "%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
      "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n" +
      "4 0 obj<</Length 44>>stream\nBT /F1 24 Tf 20 40 Td (DUCKY) Tj ET\nendstream endobj\n" +
      "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
  ).toString("base64");

async function check(name: string, fn: () => Promise<boolean>) {
  try {
    console.log(`${(await fn()) ? "✅" : "❌"} ${name}`);
  } catch (e) {
    console.log(`❌ ${name}: ${(e as Error).message}`);
  }
}

const user = (content: ChatMessage["content"]): ChatMessage[] => [{ role: "user", content }];

(async () => {
  await check("text", async () => {
    const r = await callModel({ messages: user("Reply with exactly: pong"), maxTokens: 16 });
    return /pong/i.test(r.text);
  });
  await check("structured output", async () => {
    const r = await callModel({
      messages: user("Is 7 prime?"),
      schema: {
        name: "answer",
        schema: {
          type: "object",
          properties: { prime: { type: "boolean" } },
          required: ["prime"],
          additionalProperties: false,
        },
      },
    });
    return (r.json as { prime?: boolean })?.prime === true;
  });
  await check("image input", async () => {
    const r = await callModel({
      messages: user([
        { type: "text", text: "What colour is this image? One word." },
        { type: "image_url", image_url: { url: PNG } },
      ]),
      maxTokens: 16,
    });
    return /red/i.test(r.text);
  });
  await check("PDF input", async () => {
    const r = await callModel({
      messages: user([
        { type: "text", text: "What word is written in this PDF? One word." },
        { type: "file", file: { filename: "t.pdf", file_data: PDF } },
      ]),
      maxTokens: 16,
    });
    return /ducky/i.test(r.text);
  });
  console.log("\nIf PDF fails, send PDF pages to the model as images instead.");
})();
