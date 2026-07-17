import "dotenv/config";
import { z } from "zod";
import { parseFonnteEnv } from "../src/config/env.js";

const profileSchema = z.object({
  status: z.union([z.boolean(), z.string()]).optional(),
  reason: z.string().optional(),
  detail: z.string().optional(),
  device: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional(),
  device_status: z.string().optional(),
}).passthrough();

const updateSchema = z.object({
  status: z.union([z.boolean(), z.string()]).optional(),
  reason: z.string().optional(),
  detail: z.string().optional(),
}).passthrough();

async function main(): Promise<void> {
  const env = parseFonnteEnv();
  const webhook = validateWebhookUrl(env.PUBLIC_WEBHOOK_URL, env.FONNTE_WEBHOOK_SECRET);
  await requirePublicHealth(webhook.origin);

  const profileResponse = await requestFonnte("https://api.fonnte.com/device", env.FONNTE_TOKEN);
  const profile = profileSchema.safeParse(profileResponse);
  if (!profile.success) throw new Error("Respons profil device Fonnte tidak valid");
  if (isRejected(profile.data.status)) {
    throw new Error(describeRejection(profile.data.reason ?? profile.data.detail));
  }

  const device = profile.data.device === undefined ? "" : String(profile.data.device).trim();
  const name = profile.data.name?.trim() ?? "";
  if (!device || name.length < 2) {
    throw new Error("Profil Fonnte tidak memiliki identitas device yang dapat diperbarui");
  }
  const deviceStatus = profile.data.device_status?.trim().toLowerCase() ?? "";
  if (!["connect", "connected", "ready"].includes(deviceStatus)) {
    throw new Error("Device Fonnte belum connected; scan atau reconnect QR terlebih dahulu");
  }

  const form = new FormData();
  form.set("device", device);
  form.set("name", name);
  form.set("webhook", env.PUBLIC_WEBHOOK_URL);
  form.set("autoread", "true");
  form.set("personal", "true");
  form.set("group", "false");
  form.set("quick", "false");
  const updateResponse = await requestFonnte(
    "https://api.fonnte.com/update-device",
    env.FONNTE_TOKEN,
    form,
  );
  const update = updateSchema.safeParse(updateResponse);
  if (!update.success) throw new Error("Respons update device Fonnte tidak valid");
  if (isRejected(update.data.status)) {
    throw new Error(describeRejection(update.data.reason ?? update.data.detail));
  }

  console.log("[ok] token device Fonnte valid dan connected");
  console.log("[ok] webhook publik sehat dan secret sesuai");
  console.log("[ok] webhook personal chat serta Auto Read sudah diaktifkan");
  console.log("FONNTE_ACTIVATED");
}

function validateWebhookUrl(rawUrl: string, secret: string): URL {
  const webhook = new URL(rawUrl);
  if (webhook.pathname.replace(/\/+$/, "") !== "/webhook/fonnte") {
    throw new Error("PUBLIC_WEBHOOK_URL harus memakai route /webhook/fonnte");
  }
  if (webhook.searchParams.get("token") !== secret) {
    throw new Error("PUBLIC_WEBHOOK_URL belum membawa FONNTE_WEBHOOK_SECRET yang benar");
  }
  return webhook;
}

async function requirePublicHealth(origin: string): Promise<void> {
  const response = await fetchWithTimeout(new URL("/health", origin), {}, 15_000);
  if (response.status !== 200) {
    throw new Error(`Endpoint publik tidak sehat (HTTP ${response.status})`);
  }
}

async function requestFonnte(
  endpoint: string,
  token: string,
  body?: FormData,
): Promise<unknown> {
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { Authorization: token },
    ...(body ? { body } : {}),
  }, 15_000);
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Fonnte HTTP error ${response.status}`);
  return payload;
}

async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Koneksi ke Fonnte/tunnel timeout");
    }
    throw new Error("Koneksi ke Fonnte/tunnel gagal");
  } finally {
    clearTimeout(timer);
  }
}

function isRejected(status: boolean | string | undefined): boolean {
  return status === false || (typeof status === "string" && status.toLowerCase() === "false");
}

function describeRejection(reason: string | undefined): string {
  const normalized = reason?.trim().toLowerCase() ?? "";
  if (normalized.includes("token") || normalized.includes("device not found")) {
    return "FONNTE_TOKEN ditolak Fonnte; salin ulang Device Token dari Device > Token";
  }
  if (normalized.includes("disconnect")) {
    return "Device Fonnte belum connected; scan atau reconnect QR terlebih dahulu";
  }
  if (normalized.includes("webhook")) {
    return "Fonnte menolak URL webhook publik";
  }
  return "Fonnte menolak aktivasi device";
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Aktivasi Fonnte gagal");
  process.exitCode = 1;
});
