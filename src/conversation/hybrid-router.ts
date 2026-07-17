import type { AgentGateway } from "../agent/agent-gateway.js";
import { createAgentSessionId } from "../agent/session-id.js";
import { AGENT_UNAVAILABLE_TEXT } from "../agent/fallback.js";
import type { ConversationRouterLike } from "../webhook/handler.js";
import { deterministicFallback } from "./fallback.js";
import { EMPTY_QUESTION_TEXT, MENU_TEXT, CANCEL_TEXT } from "./menu.js";

export interface HybridConversationRouterOptions {
  localRouter: ConversationRouterLike;
  agentGateway?: AgentGateway;
  enabled: boolean;
  sessionSecret?: string;
  sessionIdFactory?: (sender: string) => string;
}

export class HybridConversationRouter implements ConversationRouterLike {
  private readonly sessionIdFactory: (sender: string) => string;

  public constructor(private readonly options: HybridConversationRouterOptions) {
    this.sessionIdFactory = options.sessionIdFactory
      ?? ((sender) => createAgentSessionId(sender, options.sessionSecret ?? ""));
  }

  public async route(input: { sender: string; text: string }): Promise<string> {
    const normalized = input.text.trim();
    if (!this.options.enabled || !this.options.agentGateway) return this.options.localRouter.route(input);
    if (/^(menu|help|bantuan)$/i.test(normalized) || /^batal$/i.test(normalized)) {
      return this.options.localRouter.route(input);
    }
    if (/^tanya\s*:/i.test(normalized)) {
      const question = normalized.replace(/^tanya\s*:/i, "").trim();
      if (question.length < 3) return EMPTY_QUESTION_TEXT;
      return this.runAgentOrLocal(input.sender, question, input);
    }
    try {
      return (await this.options.agentGateway.run({
        internalUserId: this.sessionIdFactory(input.sender),
        message: normalized,
      })).text;
    } catch {
      return deterministicFallback();
    }
  }

  private async runAgentOrLocal(sender: string, question: string, original: { sender: string; text: string }): Promise<string> {
    try {
      return (await this.options.agentGateway!.run({
        internalUserId: this.sessionIdFactory(sender),
        message: question,
      })).text;
    } catch {
      try {
        return await this.options.localRouter.route(original);
      } catch {
        return AGENT_UNAVAILABLE_TEXT;
      }
    }
  }
}
