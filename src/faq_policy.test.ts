import test from "node:test";
import assert from "node:assert/strict";
import { buildNotification } from "./faq_service.ts";

test("a card freeze suggestion requires explicit confirmation in its audit notification", () => {
  const notification = buildNotification("freeze a card", {
    id: "card-freeze",
    question: "How do I freeze a card I do not recognize?",
    answer: "Open card controls and confirm the freeze action.",
    action: "freeze_card",
    risk: "high",
  }, "2026-09-05T10:00:00.000Z");

  assert.deepEqual(notification, {
    event: "faq_suggestion_shown",
    query: "freeze a card",
    faqId: "card-freeze",
    action: "freeze_card",
    requiresConfirmation: true,
    recordedAt: "2026-09-05T10:00:00.000Z",
  });
});
