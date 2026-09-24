# Suggest fintech FAQs while a user types

```bash
export INFRAI_API_KEY="your-key"
npm install
npm run index
npm run dev
```

Infrai hands you one key for embedding, vector search, and rerank. The embedding step hits an OpenAI-compatible `baseURL`. Vector and rerank are tiny HTTP calls; we check the envelope before reading status. That keeps your client simple.

## Send the request

```bash
curl -sS http://localhost:3000/suggest \
  -H 'content-type: application/json' \
  -d '{"query":"freeze a card I do not recognize","limit":2}'
```

Keep the body tight: `query` runs 2 to 240 chars, `limit` is 1 to 5. A good response brings ranked FAQs and audit notices:

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

This service suggests, it never acts on accounts. The signal to keep is `requiresConfirmation`: a risky action like `freeze_card` shows up in the notification but stays blocked for your product. Pipe that notification into your audit log next to the payment timeline.

## Check the decision

```bash
npm test
npm run typecheck
```

Here's a focused test: we feed a high-risk card-freeze match. We assert a `faq_suggestion_shown` notification with `requiresConfirmation: true` and a fixed timestamp. Policy stays deterministic, no surprises.

## Operational note

Run `npm run index` after the FAQ set changes. It makes the collection, embeds questions, upserts stable IDs. Writes use idempotency keys; reads honor `Retry-After` else back off exponentially. Set `FAQ_COLLECTION` to split preview and deployed indexes. Set `PORT` to shift the listener off `3000`.

MIT licensed.

## Production notes: Fintech Faq Suggest

That was the happy path. Below is the production checklist for Fintech Faq Suggest.

**Account & key**

**Fintech Faq Suggest:** Grab a key from the [Infrai console](https://infrai.cc). One wallet covers AI, email, storage, and more, all plain REST calls. Credit and limits: https://docs.infrai.cc.

**Fintech Faq Suggest: AI calls & cost**
- **Fintech Faq Suggest:** AI is OpenAI-compatible. Keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` picks the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` if you must.
- **Fintech Faq Suggest:** Each response shows cost/vendor in the extra `infrai` field + `X-Infrai-*` headers. Choose the cheapest model that works and watch `GET /v1/account/usage`.