import { z } from "zod";

const nonEmptySecret = z.string().trim().min(1, "wajib diisi");
const modelName = z.string().trim().min(1, "wajib diisi");

export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const geminiEnvSchema = baseEnvSchema.extend({
  GEMINI_API_KEY: nonEmptySecret,
  GEMINI_CHAT_MODEL: modelName,
  GEMINI_EMBEDDING_MODEL: modelName,
  GEMINI_EMBEDDING_DIMENSION: z.coerce.number().int().positive().refine(
    (dimension) => dimension === 768,
    "harus bernilai 768",
  ),
});

export const supabaseEnvSchema = baseEnvSchema.extend({
  SUPABASE_URL: z.string().url().refine(
    (url) => url.startsWith("https://"),
    "harus menggunakan HTTPS",
  ),
  SUPABASE_ANON_KEY: nonEmptySecret,
  SUPABASE_SERVICE_ROLE_KEY: nonEmptySecret,
});

export const fonnteEnvSchema = baseEnvSchema.extend({
  FONNTE_TOKEN: nonEmptySecret,
  FONNTE_WEBHOOK_SECRET: nonEmptySecret,
  PUBLIC_WEBHOOK_URL: z.string().url().refine(
    (url) => url.startsWith("https://"),
    "harus menggunakan HTTPS",
  ),
});

export const fullEnvSchema = geminiEnvSchema
  .merge(supabaseEnvSchema)
  .merge(fonnteEnvSchema);

export type BaseEnv = z.infer<typeof baseEnvSchema>;
export type GeminiEnv = z.infer<typeof geminiEnvSchema>;
export type SupabaseEnv = z.infer<typeof supabaseEnvSchema>;
export type FonnteEnv = z.infer<typeof fonnteEnvSchema>;
export type FullEnv = z.infer<typeof fullEnvSchema>;

export function parseBaseEnv(input: NodeJS.ProcessEnv = process.env): BaseEnv {
  return parseEnv(baseEnvSchema, input);
}

export function parseGeminiEnv(input: NodeJS.ProcessEnv = process.env): GeminiEnv {
  return parseEnv(geminiEnvSchema, input);
}

export function parseSupabaseEnv(input: NodeJS.ProcessEnv = process.env): SupabaseEnv {
  return parseEnv(supabaseEnvSchema, input);
}

export function parseFonnteEnv(input: NodeJS.ProcessEnv = process.env): FonnteEnv {
  return parseEnv(fonnteEnvSchema, input);
}

export function parseFullEnv(input: NodeJS.ProcessEnv = process.env): FullEnv {
  return parseEnv(fullEnvSchema, input);
}

function parseEnv<TSchema extends z.AnyZodObject>(
  schema: TSchema,
  input: NodeJS.ProcessEnv,
): z.infer<TSchema> {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }

  const fields = result.error.issues
    .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Konfigurasi environment tidak valid: ${fields}`);
}
