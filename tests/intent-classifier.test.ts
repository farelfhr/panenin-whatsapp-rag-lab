import { describe, expect, it, vi } from "vitest";
import { GeminiIntentClassifier } from "../src/ai/intent-classifier.js";
import type { TextGenerationGateway } from "../src/ai/gateway.js";

function gateway(response: string): TextGenerationGateway {
  return { generateText: vi.fn(async () => response) };
}

describe("intent classifier", () => {
  it("mengembalikan intent valid bila confidence >= 0.80", async () => {
    const classifier = new GeminiIntentClassifier(gateway(JSON.stringify({ intent: "KNOWLEDGE_QUERY", confidence: 0.91, question: "cara packing" })));
    await expect(classifier.classify("Tanya cara packing")).resolves.toEqual({ intent: "KNOWLEDGE_QUERY", confidence: 0.91, question: "cara packing" });
  });

  it("confidence rendah menjadi UNKNOWN", async () => {
    const classifier = new GeminiIntentClassifier(gateway(JSON.stringify({ intent: "SHOW_MENU", confidence: 0.79, question: "" })));
    await expect(classifier.classify("menu?")).resolves.toMatchObject({ intent: "UNKNOWN", confidence: 0.79 });
  });

  it("JSON invalid menjadi UNKNOWN", async () => {
    const classifier = new GeminiIntentClassifier(gateway("bukan json"));
    await expect(classifier.classify("apa saja")).resolves.toEqual({ intent: "UNKNOWN", confidence: 0, question: "" });
  });
});
