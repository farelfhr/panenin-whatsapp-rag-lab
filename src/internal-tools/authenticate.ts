import { createHash, timingSafeEqual } from "node:crypto";

export function hasValidToolSecret(supplied: string | null, expected: string): boolean {
  if (!supplied || !expected) return false;
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(suppliedDigest, expectedDigest);
}
