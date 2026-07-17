import { z } from "zod";

const nonEmptySecret = z.string().trim().min(1, "wajib diisi");
const modelName = z.string().trim().min(1, "wajib diisi");
const optionalText = z.string().trim().default("");
const envBoolean = z.preprocess((value) => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false" || value === undefined) return false;
  return value;
}, z.boolean());
const loopbackUrl = z.string().url().refine(isLoopbackHttpUrl, "harus menggunakan URL HTTP loopback");
const httpsUrl = z.string().url().refine((value) => value.startsWith("https://"), "harus menggunakan HTTPS");

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

const agentFieldsSchema = z.object({
  OPENCLAW_ENABLED: envBoolean.default(false),
  OPENCLAW_GATEWAY_URL: loopbackUrl.default("http://127.0.0.1:18789"),
  OPENCLAW_GATEWAY_TOKEN: optionalText,
  OPENCLAW_MODEL: optionalText,
  AGENT_SESSION_HMAC_SECRET: optionalText,
  INTERNAL_TOOL_HOST: z.literal("127.0.0.1").default("127.0.0.1"),
  INTERNAL_TOOL_PORT: z.coerce.number().int().min(1024).max(65535).default(3001),
  PANENIN_TOOL_SECRET: optionalText,
  PANENIN_RAG_TOOL_URL: loopbackUrl.default("http://127.0.0.1:3001/internal/tools/rag-query"),
  OLAGON_API_KEY: optionalText,
  OLAGON_API_URL: httpsUrl.default("https://gateway.olagon.site/anthropic/v1/messages"),
  OLAGON_BASE_URL: httpsUrl.default("https://gateway.olagon.site/anthropic"),
  OLAGON_MODEL_ID: optionalText,
});

export const agentEnvSchema = baseEnvSchema
  .merge(agentFieldsSchema)
  .superRefine(validateEnabledAgentFields);

export const internalToolEnvSchema = baseEnvSchema.extend({
  INTERNAL_TOOL_HOST: z.literal("127.0.0.1").default("127.0.0.1"),
  INTERNAL_TOOL_PORT: z.coerce.number().int().min(1024).max(65535).default(3001),
  PANENIN_TOOL_SECRET: z.string().trim().min(24, "minimal 24 karakter"),
});

export const olagonTestEnvSchema = baseEnvSchema.extend({
  OLAGON_API_KEY: z.string().trim().min(24, "isi API key Olagon asli; local secret bukan API key Olagon"),
  OLAGON_API_URL: httpsUrl.default("https://gateway.olagon.site/anthropic/v1/messages"),
  OLAGON_MODEL_ID: z.string().trim().min(1, "isi ID model Olagon dari dashboard/provider"),
});

export const fullEnvSchema = geminiEnvSchema
  .merge(supabaseEnvSchema)
  .merge(fonnteEnvSchema)
  .merge(agentFieldsSchema)
  .superRefine(validateEnabledAgentFields);

export type BaseEnv = z.infer<typeof baseEnvSchema>;
export type GeminiEnv = z.infer<typeof geminiEnvSchema>;
export type SupabaseEnv = z.infer<typeof supabaseEnvSchema>;
export type FonnteEnv = z.infer<typeof fonnteEnvSchema>;
export type AgentEnv = z.infer<typeof agentEnvSchema>;
export type InternalToolEnv = z.infer<typeof internalToolEnvSchema>;
export type OlagonTestEnv = z.infer<typeof olagonTestEnvSchema>;
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

export function parseAgentEnv(input: NodeJS.ProcessEnv = process.env): AgentEnv {
  return parseEnv(agentEnvSchema, input);
}

export function parseInternalToolEnv(input: NodeJS.ProcessEnv = process.env): InternalToolEnv {
  return parseEnv(internalToolEnvSchema, input);
}

export function parseOlagonTestEnv(input: NodeJS.ProcessEnv = process.env): OlagonTestEnv {
  return parseEnv(olagonTestEnvSchema, input);
}

export function parseFullEnv(input: NodeJS.ProcessEnv = process.env): FullEnv {
  return parseEnv(fullEnvSchema, input);
}

function parseEnv<TSchema extends z.ZodTypeAny>(
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

function isLoopbackHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:"
      && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

function validateEnabledAgentFields(
  data: z.infer<typeof agentFieldsSchema>,
  context: z.RefinementCtx,
): void {
  if (!data.OPENCLAW_ENABLED) return;

  const required: Array<keyof Pick<
    typeof data,
    | "OPENCLAW_GATEWAY_TOKEN"
    | "OPENCLAW_MODEL"
    | "AGENT_SESSION_HMAC_SECRET"
    | "PANENIN_TOOL_SECRET"
    | "OLAGON_API_KEY"
    | "OLAGON_MODEL_ID"
  >> = [
    "OPENCLAW_GATEWAY_TOKEN",
    "OPENCLAW_MODEL",
    "AGENT_SESSION_HMAC_SECRET",
    "PANENIN_TOOL_SECRET",
    "OLAGON_API_KEY",
    "OLAGON_MODEL_ID",
  ];

  for (const field of required) {
    const value = data[field];
    const minimum = field === "OPENCLAW_MODEL" || field === "OLAGON_MODEL_ID" ? 1 : 24;
    if (value.length < minimum) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: minimum === 1 ? "wajib diisi saat OPENCLAW_ENABLED=true" : "minimal 24 karakter saat OPENCLAW_ENABLED=true",
      });
    }
  }
}
