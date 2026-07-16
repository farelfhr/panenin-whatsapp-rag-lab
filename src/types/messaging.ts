export type MessageType = "text" | "image" | "audio" | "unknown";

export interface NormalizedIncomingMessage {
  providerMessageId: string;
  sender: string;
  type: MessageType;
  text?: string;
  raw: unknown;
}

export interface MessagingProvider {
  sendText(input: { to: string; text: string }): Promise<{ providerMessageId?: string }>;
  parseWebhook(payload: unknown): NormalizedIncomingMessage[];
}
