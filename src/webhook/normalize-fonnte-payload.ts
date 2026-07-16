import type { MessageType, NormalizedIncomingMessage } from "../types/messaging.js";

// TODO: Verify against actual sanitized Fonnte webhook payload.
export function normalizeFonntePayload(payload: unknown): NormalizedIncomingMessage[] {
  const candidates = collectCandidates(payload);
  return candidates.flatMap((candidate) => normalizeCandidate(candidate));
}

function collectCandidates(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  for (const key of ["data", "messages", "message", "result"]) {
    const nested = payload[key];
    if (Array.isArray(nested)) return nested;
    if (isRecord(nested)) return [nested];
    if (typeof nested === "string") {
      try {
        const parsed: unknown = JSON.parse(nested);
        if (Array.isArray(parsed)) return parsed;
        if (isRecord(parsed)) return [parsed];
      } catch {
        // Unknown form fields are ignored until an actual provider payload is verified.
      }
    }
  }
  return [payload];
}

function normalizeCandidate(candidate: unknown): NormalizedIncomingMessage[] {
  if (!isRecord(candidate)) return [];
  if (isOutgoing(candidate)) return [];
  const id = firstString(candidate, ["id", "message_id", "messageId", "provider_message_id"])
    ?? nestedString(candidate, ["key", "id"]);
  const sender = firstString(candidate, ["sender", "from", "phone", "number", "target"])
    ?? nestedString(candidate, ["key", "remoteJid"]);
  if (!id || !sender) return [];

  const text = firstString(candidate, ["message", "text", "body", "content"])
    ?? nestedString(candidate, ["message", "conversation"]);
  const type = inferType(candidate, text);
  const normalized: NormalizedIncomingMessage = {
    providerMessageId: id,
    sender,
    type,
    raw: candidate,
  };
  if (text) normalized.text = text.trim();
  return [normalized];
}

function isOutgoing(candidate: Record<string, unknown>): boolean {
  return candidate["fromMe"] === true
    || candidate["from_me"] === true
    || candidate["isOutgoing"] === true
    || candidate["direction"] === "outgoing"
    || candidate["type"] === "outgoing";
}

function inferType(candidate: Record<string, unknown>, text: string | undefined): MessageType {
  if (text) return "text";
  if (candidate["image"] !== undefined || candidate["type"] === "image") return "image";
  if (candidate["audio"] !== undefined || candidate["type"] === "audio") return "audio";
  return "unknown";
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function nestedString(record: Record<string, unknown>, path: string[]): string | undefined {
  let current: unknown = record;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return typeof current === "string" && current.trim() ? current.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
