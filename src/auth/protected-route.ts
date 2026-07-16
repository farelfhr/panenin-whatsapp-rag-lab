import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuthVerifier {
  verifyAccessToken(accessToken: string): Promise<boolean>;
}

export class SupabaseAuthVerifier implements AuthVerifier {
  public constructor(private readonly client: SupabaseClient) {}

  public async verifyAccessToken(accessToken: string): Promise<boolean> {
    try {
      const { data, error } = await this.client.auth.getClaims(accessToken);
      return error === null
        && typeof data?.claims.sub === "string"
        && data.claims.sub.length > 0;
    } catch {
      return false;
    }
  }
}

export async function handleProtectedRoute(
  method: string,
  authorization: string | undefined,
  verifier: AuthVerifier,
): Promise<Response> {
  if (method.toUpperCase() !== "GET") {
    return new Response("method not allowed", { status: 405 });
  }

  const accessToken = extractBearerToken(authorization);
  if (!accessToken || !(await verifier.verifyAccessToken(accessToken))) {
    return new Response("unauthorized", {
      status: 401,
      headers: {
        "cache-control": "no-store",
        "www-authenticate": "Bearer",
      },
    });
  }

  return new Response(JSON.stringify({ status: "authenticated" }), {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json",
    },
  });
}

function extractBearerToken(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const parts = authorization.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== "bearer") return null;
  return parts[1] || null;
}
