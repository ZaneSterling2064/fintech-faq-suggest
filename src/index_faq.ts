import { InfraiClient } from "./infrai_client.ts";
import type { FaqEntry } from "./faq_types.ts";

const entries: FaqEntry[] = [
  { id: "card-pending", question: "Why is my card payment pending?", answer: "A pending payment is authorized but not settled. Check it again after the merchant completes settlement.", action: "view_payment_status", risk: "low" },
  { id: "card-freeze", question: "How do I freeze a card I do not recognize?", answer: "Open card controls, select the card, and confirm the freeze action.", action: "freeze_card", risk: "high" },
  { id: "transfer-review", question: "Why is my bank transfer under review?", answer: "Transfers may be reviewed before release. The payment timeline shows the latest state.", action: "view_transfer_status", risk: "low" },
];

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before indexing FAQs");
const collection = process.env.FAQ_COLLECTION ?? "fintech-faq-v1";
const client = new InfraiClient(apiKey);
const embedded = await Promise.all(entries.map(async (entry) => ({ entry, values: await client.embedding(entry.question) })));
await client.createCollection(collection, embedded[0].values.length);
await client.upsert(collection, embedded.map(({ entry, values }) => ({ id: entry.id, values, metadata: entry })));
console.log(JSON.stringify({ collection, indexed: entries.length }));
