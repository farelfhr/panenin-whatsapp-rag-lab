import { z } from "zod";
import type { AgentGateway } from "./agent-gateway.js";

const responseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.string() }),
  })).min(1),
});

export interface OpenClawClientOptions {
  gatewayUrl: string;
  gatewayToken: string;
  model: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export class OpenClawClient implements AgentGateway {
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  public constructor(private readonly options: OpenClawClientOptions) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  public async run(input: { internalUserId: string; message: string }): Promise<{ text: string }> {
    const message = input.message.trim();
    if (!message) throw new Error("pesan agen kosong");
    if (!input.internalUserId.trim()) throw new Error("identitas sesi kosong");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchFn(`${this.options.gatewayUrl.replace(/\/+$/, "")}/v1/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.gatewayToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.options.model,
          user: input.internalUserId,
          stream: false,
          messages: [{ role: "user", content: message }],
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`gateway HTTP ${response.status}`);
      const parsed = responseSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("respons gateway tidak valid");
      const text = parsed.data.choices[0]?.message.content.trim();
      if (!text) throw new Error("respons gateway kosong");
      return { text };
    } finally {
      clearTimeout(timer);
    }
  }
}
