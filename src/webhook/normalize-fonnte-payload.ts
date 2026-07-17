import { createHash } from "node:crypto";
import type { MessageType, NormalizedIncomingMessage } from "../types/messaging.js";

// Verified against a sanitized Fonnte personal-text webhook fixture on 17 July 2026.
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
  const id = firstStableIdentifier(candidate, [
    "id",
    "inboxid",
    "message_id",
    "messageId",
    "provider_message_id",
  ])
    ?? stableNestedIdentifier(candidate, ["key", "id"])
    ?? deriveStableWebhookId(candidate);
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

function firstStableIdentifier(
  record: Record<string, unknown>,
  keys: string[],
): string | undefined {
  const value = firstString(record, keys);
  return isStableIdentifier(value) ? value : undefined;
}

function stableNestedIdentifier(
  record: Record<string, unknown>,
  path: string[],
): string | undefined {
  const value = nestedString(record, path);
  return isStableIdentifier(value) ? value : undefined;
}

function isStableIdentifier(value: string | undefined): value is string {
  return value !== undefined && value !== "0";
}

function deriveStableWebhookId(candidate: Record<string, unknown>): string | undefined {
  const sender = firstString(candidate, ["sender", "from", "phone", "number", "target"])
    ?? nestedString(candidate, ["key", "remoteJid"]);
  const timestamp = firstString(candidate, ["timestamp", "message_timestamp", "messageTimestamp"]);
  if (!sender || !timestamp) return undefined;
  const message = firstString(candidate, ["message", "text", "body", "content"]) ?? "";
  const type = firstString(candidate, ["type", "mode"]) ?? "";
  const digest = createHash("sha256")
    .update([sender, timestamp, type, message].join("\u001f"))
    .digest("hex")
    .slice(0, 32);
  return `fonnte:${digest}`;
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
