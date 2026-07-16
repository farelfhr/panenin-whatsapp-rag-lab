import { describe, expect, it } from "vitest";
import { createSupabaseOperationError } from "../src/database/supabase.js";

describe("Supabase error context", () => {
  it("menampilkan kode, pesan, dan hint tanpa multiline", () => {
    const error = createSupabaseOperationError("Operasi gagal", {
      code: "PGRST106",
      message: "Invalid schema: panenin_ai_lab",
      hint: "Expose schema\nthrough Data API",
    });

    expect(error.message).toBe(
      "Operasi gagal: PGRST106 | Invalid schema: panenin_ai_lab | Expose schema through Data API",
    );
  });
});
