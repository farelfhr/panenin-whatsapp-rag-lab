import { Type } from "@google/genai";
import {
  intentClassificationSchema,
  type IntentClassification,
} from "../types/intent.js";
import type {
  StructuredSchema,
  TextGenerationGateway,
} from "./gateway.js";

const INTENT_SCHEMA: StructuredSchema = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      enum: ["SHOW_MENU", "KNOWLEDGE_QUERY", "CANCEL_FLOW", "UNKNOWN"],
    },
    confidence: { type: Type.NUMBER },
    question: { type: Type.STRING },
  },
  required: ["intent", "confidence", "question"],
};

const CLASSIFIER_SYSTEM_INSTRUCTION = [
  "Anda hanya mengklasifikasikan pesan pengguna untuk lab Panenin.",
  "Jangan menjalankan action, mengubah data, atau membuat klaim di luar JSON.",
  "Gunakan UNKNOWN bila pesan menyangkut transaksi, saldo, pembayaran, stok, atau tidak jelas.",
  "Keluarkan JSON dengan intent, confidence antara 0 dan 1, dan question.",
].join(" ");

export interface IntentClassifier {
  classify(message: string): Promise<IntentClassification>;
}

export class GeminiIntentClassifier implements IntentClassifier {
  public constructor(private readonly gateway: TextGenerationGateway) {}

  public async classify(message: string): Promise<IntentClassification> {
    const raw = await this.gateway.generateText({
      prompt: `Pesan pengguna:\n${message}`,
      systemInstruction: CLASSIFIER_SYSTEM_INSTRUCTION,
      responseSchema: INTENT_SCHEMA,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { intent: "UNKNOWN", confidence: 0, question: "" };
    }

    const result = intentClassificationSchema.safeParse(parsed);
    if (!result.success || result.data.confidence < 0.8) {
      const question = result.success ? result.data.question : "";
      return { intent: "UNKNOWN", confidence: result.success ? result.data.confidence : 0, question };
    }
    return result.data;
  }
}
