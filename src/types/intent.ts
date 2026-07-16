import { z } from "zod";

export const allowedIntents = [
  "SHOW_MENU",
  "KNOWLEDGE_QUERY",
  "CANCEL_FLOW",
  "UNKNOWN",
] as const;

export const intentClassificationSchema = z.object({
  intent: z.enum(allowedIntents),
  confidence: z.number().min(0).max(1),
  question: z.string().trim(),
});

export type Intent = (typeof allowedIntents)[number];
export type IntentClassification = z.infer<typeof intentClassificationSchema>;
