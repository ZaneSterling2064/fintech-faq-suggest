export type Risk = "low" | "high";

export type FaqEntry = {
  id: string;
  question: string;
  answer: string;
  action: string;
  risk: Risk;
};

export type FaqMatch = FaqEntry & { score?: number };

export type AuditNotification = {
  event: "faq_suggestion_shown";
  query: string;
  faqId: string;
  action: string;
  requiresConfirmation: boolean;
  recordedAt: string;
};
