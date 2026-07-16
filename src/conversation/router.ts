import type { RagAnswer } from "../types/rag.js";
import { answerKnowledge } from "../rag/answer.js";
import type { GeminiGateway } from "../ai/gemini-client.js";
import type { Retriever } from "../rag/retrieve.js";
import { CANCEL_TEXT, EMPTY_QUESTION_TEXT, MENU_TEXT } from "./menu.js";
import { deterministicFallback } from "./fallback.js";

export interface ConversationSessionStore {
  resetSession(sender: string): Promise<void>;
}

export interface ConversationRouterDependencies {
  retriever: Retriever;
  gateway: GeminiGateway;
  sessionStore: ConversationSessionStore;
  answerFn?: (question: string, dependencies: { retriever: Retriever; gateway: GeminiGateway }) => Promise<RagAnswer>;
}

export class ConversationRouter {
  private readonly answerFn: NonNullable<ConversationRouterDependencies["answerFn"]>;

  public constructor(private readonly dependencies: ConversationRouterDependencies) {
    this.answerFn = dependencies.answerFn ?? answerKnowledge;
  }

  public async route(input: { sender: string; text: string }): Promise<string> {
    const normalized = input.text.trim();
    if (/^(menu|help|bantuan)$/i.test(normalized)) return MENU_TEXT;
    if (/^batal$/i.test(normalized)) {
      await this.dependencies.sessionStore.resetSession(input.sender);
      return CANCEL_TEXT;
    }
    if (/^tanya\s*:/i.test(normalized)) {
      const question = normalized.replace(/^tanya\s*:/i, "").trim();
      if (question.length < 3) return EMPTY_QUESTION_TEXT;
      try {
        const result = await this.answerFn(question, {
          retriever: this.dependencies.retriever,
          gateway: this.dependencies.gateway,
        });
        return result.answer;
      } catch {
        return "Maaf, layanan pengetahuan sedang tidak tersedia. Silakan coba lagi nanti.";
      }
    }
    return deterministicFallback();
  }
}
