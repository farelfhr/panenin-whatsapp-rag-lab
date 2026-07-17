import { createHmac } from "node:crypto";

export function createAgentSessionId(sender: string, secret: string): string {
  const normalizedSender = sender.trim();
  if (!normalizedSender) throw new Error("sender wajib diisi");
  if (secret.length < 24) throw new Error("secret sesi terlalu pendek");
  const digest = createHmac("sha256", secret).update(normalizedSender).digest("hex").slice(0, 24);
  return `panenin:${digest}`;
}
