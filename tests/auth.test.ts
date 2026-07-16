import { describe, expect, it, vi } from "vitest";
import { handleProtectedRoute, type AuthVerifier } from "../src/auth/protected-route.js";

function verifier(result: boolean): AuthVerifier {
  return { verifyAccessToken: vi.fn(async () => result) };
}

describe("Supabase Auth protected route", () => {
  it("menolak request tanpa bearer token", async () => {
    const auth = verifier(true);
    const response = await handleProtectedRoute("GET", undefined, auth);

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe("Bearer");
    expect(auth.verifyAccessToken).not.toHaveBeenCalled();
  });

  it("menolak token yang gagal diverifikasi", async () => {
    const auth = verifier(false);
    const response = await handleProtectedRoute("GET", "Bearer invalid-demo-token", auth);

    expect(response.status).toBe(401);
    expect(auth.verifyAccessToken).toHaveBeenCalledWith("invalid-demo-token");
  });

  it("mengizinkan token valid tanpa membocorkan claim pengguna", async () => {
    const auth = verifier(true);
    const response = await handleProtectedRoute("GET", "bearer valid-demo-token", auth);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "authenticated" });
  });

  it("menolak method selain GET", async () => {
    const auth = verifier(true);
    const response = await handleProtectedRoute("POST", "Bearer valid-demo-token", auth);

    expect(response.status).toBe(405);
    expect(auth.verifyAccessToken).not.toHaveBeenCalled();
  });
});
