import { describe, expect, it } from "vitest";
import {
  isSupportedNodeVersion,
  parseNodeVersion,
} from "../scripts/openclaw-cli.mjs";

describe("OpenClaw CLI runtime", () => {
  it("membaca versi Node dengan atau tanpa prefix v", () => {
    expect(parseNodeVersion("v24.18.0")).toEqual({ major: 24, minor: 18, patch: 0 });
    expect(parseNodeVersion("22.22.3")).toEqual({ major: 22, minor: 22, patch: 3 });
    expect(parseNodeVersion("invalid")).toBeUndefined();
  });

  it("menolak Node 24.14 dan menerima runtime yang didukung OpenClaw", () => {
    expect(isSupportedNodeVersion("v24.14.1")).toBe(false);
    expect(isSupportedNodeVersion("v24.15.0")).toBe(true);
    expect(isSupportedNodeVersion("v24.18.0")).toBe(true);
    expect(isSupportedNodeVersion("v22.22.3")).toBe(true);
    expect(isSupportedNodeVersion("v25.9.0")).toBe(true);
  });
});
