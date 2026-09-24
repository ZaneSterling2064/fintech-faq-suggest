import { createServer } from "node:http";
import { z } from "zod";
import { FaqSuggestionService } from "./faq_service.ts";
import { InfraiClient, InfraiError } from "./infrai_client.ts";

const requestSchema = z.object({ query: z.string().trim().min(2).max(240), limit: z.number().int().min(1).max(5).default(3) }).strict();
const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");
const service = new FaqSuggestionService(new InfraiClient(apiKey), process.env.FAQ_COLLECTION ?? "fintech-faq-v1");
const port = Number(process.env.PORT ?? 3000);

const server = createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/suggest") {
    res.writeHead(404, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Not found" }));
    return;
  }
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const parsed = requestSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (!parsed.success) {
      res.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Invalid request", issues: parsed.error.issues }));
      return;
    }
    const result = await service.suggest(parsed.data.query, parsed.data.limit);
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(result));
  } catch (error) {
    const status = error instanceof SyntaxError ? 400 : error instanceof InfraiError && error.status < 500 ? error.status : 502;
    const message = error instanceof InfraiError ? error.message : error instanceof SyntaxError ? "Invalid JSON" : "Suggestion request failed";
    res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify({ error: message }));
  }
});

server.listen(port, () => console.log(`FAQ suggestion service listening on http://localhost:${port}`));
