const SENSITIVE_KEY = /(token|secret|authorization|api[_-]?key|service[_-]?role|password|qr|session)/i;

export function sanitizePayload(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizePayload(item, depth + 1));
  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      result[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : sanitizePayload(child, depth + 1);
    }
    return result;
  }
  if (typeof value === "string") {
    return maskPhoneNumbers(value);
  }
  return value;
}

function maskPhoneNumbers(value: string): string {
  return value.replace(/\b\d{8,15}\b/g, (digits) => `${digits.slice(0, 3)}***${digits.slice(-2)}`);
}

export function describePayloadShape(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[depth-limit]";
  if (Array.isArray(value)) {
    return { type: "array", length: value.length, sample: value.length > 0 ? describePayloadShape(value[0], depth + 1) : undefined };
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).slice(0, 100).map(([key, child]) => [key, describePayloadShape(child, depth + 1)]));
  }
  return typeof value;
}
