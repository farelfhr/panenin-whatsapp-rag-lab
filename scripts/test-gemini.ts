import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env["GEMINI_API_KEY"];
const model = process.env["GEMINI_CHAT_MODEL"];
const maxAttempts = 5;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY belum diisi di file .env");
}

if (!model) {
  throw new Error("GEMINI_CHAT_MODEL belum diisi di file .env");
}

const ai = new GoogleGenAI({ apiKey });
const chatModel = model;

async function main() {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: chatModel,
        contents: "Balas tepat dengan teks GEMINI_OK",
      });

      console.log(response.text);
      return;
    } catch (error) {
      if (!isRetryable(error) || attempt === maxAttempts) {
        throw error;
      }

      const delayMs = 1_000 * (2 ** (attempt - 1));
      console.warn(
        `Gemini sedang sibuk. Percobaan ${attempt}/${maxAttempts} gagal; mencoba lagi dalam ${delayMs / 1_000} detik...`,
      );
      await delay(delayMs);
    }
  }
}

main().catch((error) => {
  console.error(`Gemini test gagal: ${formatError(error)}`);
  process.exitCode = 1;
});

function isRetryable(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status === 429 || (status !== undefined && status >= 500 && status <= 599)) {
    return true;
  }

  return error instanceof Error && /(?:timeout|timed out|network|ECONNRESET|fetch failed)/i.test(error.message);
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return undefined;
  }

  const status = error["status"];
  return typeof status === "number" ? status : undefined;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    const status = getErrorStatus(error);
    return status === undefined ? error.message : `${status} ${error.message}`;
  }

  return String(error);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
