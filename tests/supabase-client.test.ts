import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseEnv } from "../src/config/env.js";
import {
  createSupabaseServerClient,
  PANENIN_AI_LAB_SCHEMA,
} from "../src/database/supabase.js";

const config: SupabaseEnv = {
  NODE_ENV: "test",
  LOG_LEVEL: "error",
  SUPABASE_URL: "https://project-ref.supabase.co",
  SUPABASE_ANON_KEY: "test-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Supabase lab client", () => {
  it("menargetkan panenin_ai_lab dan bukan schema public", async () => {
    const fetchMock = vi.fn(async (
      _input: string | URL | Request,
      _init?: RequestInit,
    ) => new Response("[]", {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createSupabaseServerClient(config);
    const { error } = await client.from("knowledge_documents").select("id");

    expect(error).toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(requestInit?.headers).get("accept-profile")).toBe(PANENIN_AI_LAB_SCHEMA);
  });
});
