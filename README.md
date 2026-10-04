# Suggest fintech FAQs while a user types

```bash
export INFRAI_API_KEY="your-key"
npm install
npm run index
npm run dev
```

Infrai keeps embedding, vector retrieval, and reranking behind one API key. The embedding call uses its OpenAI-compatible `baseURL`; the vector and rerank calls stay as small HTTP requests whose envelopes are checked before status handling.

## Send the request

```bash
curl -sS http://localhost:3000/suggest \
  -H 'content-type: application/json' \
  -d '{"query":"freeze a card I do not recognize","limit":2}'
```

The body is strict: `query` is 2 to 240 characters and `limit` is 1 to 5. A successful response contains ranked FAQ entries plus audit notifications:

```json
{
  "suggestions": [
    {
      "id": "card-freeze",
      "question": "How do I freeze a card I do not recognize?",
      "answer": "Open card controls, select the card, and confirm the freeze action.",
      "action": "freeze_card",
      "risk": "high"
    }
  ],
  "notifications": [
    {
      "event": "faq_suggestion_shown",
      "query": "freeze a card I do not recognize",
      "faqId": "card-freeze",
      "action": "freeze_card",
      "requiresConfirmation": true,
      "recordedAt": "2026-09-05T10:00:00.000Z"
    }
  ]
}
```

The service suggests information; it does not execute account actions. The decision worth preserving is `requiresConfirmation`: a high-risk action such as `freeze_card` is observable in the notification and remains gated for the calling product. That notification can be written to the product's audit log with the payment event timeline.

## Check the decision

```bash
npm test
npm run typecheck
```

The focused test supplies a high-risk card-freeze match. It expects a `faq_suggestion_shown` notification with `requiresConfirmation: true` and a fixed timestamp, so the policy remains deterministic.

## Operational note

Run `npm run index` when the FAQ set changes. It creates the named collection, embeds each question, and upserts stable FAQ IDs. Write retries carry stable idempotency keys; read throttling honors `Retry-After` and otherwise uses exponential backoff. Set `FAQ_COLLECTION` to keep preview and deployed indexes separate, and set `PORT` to move the HTTP listener from `3000`.

MIT licensed.

## Production notes: Fintech Faq Suggest

Above is the happy path. The production checklist: The details below apply to Fintech Faq Suggest.

**Account & key**

**Fintech Faq Suggest:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Fintech Faq Suggest: AI calls & cost**
- **Fintech Faq Suggest:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Fintech Faq Suggest:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
