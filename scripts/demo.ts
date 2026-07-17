import "dotenv/config";
import { spawn, type ChildProcess } from "node:child_process";
import { connect } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { parseFullEnv, type FullEnv } from "../src/config/env.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tsxCli = resolve(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
const env = parseFullEnv();
const webhookPort = parsePort(process.env["PORT"] ?? "3000");
const checkOnly = process.argv.includes("--check");
const ownedChildren: ChildProcess[] = [];

const services = [
  {
    name: "internal RAG tool",
    port: env.INTERNAL_TOOL_PORT,
    entry: resolve(repoRoot, "src", "internal-tools", "server.ts"),
    startupTimeoutMs: 45_000,
  },
  {
    name: "OpenClaw gateway",
    port: new URL(env.OPENCLAW_GATEWAY_URL).port
      ? Number(new URL(env.OPENCLAW_GATEWAY_URL).port)
      : 80,
    entry: resolve(repoRoot, "scripts", "start-openclaw.ts"),
    startupTimeoutMs: 180_000,
  },
  {
    name: "WhatsApp webhook",
    port: webhookPort,
    entry: resolve(repoRoot, "src", "index.ts"),
    startupTimeoutMs: 45_000,
  },
] as const;

async function main(): Promise<void> {
  if (!env.OPENCLAW_ENABLED) {
    throw new Error("OPENCLAW_ENABLED harus true untuk demo OpenClaw");
  }

  if (!checkOnly) {
    for (const service of services) {
      if (await isPortOpen(service.port)) {
        console.log(`[reuse] ${service.name} sudah aktif`);
        continue;
      }
      const child = spawn(process.execPath, [tsxCli, service.entry], {
        cwd: repoRoot,
        env: process.env,
        shell: false,
        stdio: "inherit",
        windowsHide: true,
      });
      ownedChildren.push(child);
      await waitForPort(service.port, service.startupTimeoutMs, child);
      console.log(`[ready] ${service.name}`);
    }
  }

  const results = await checkReadiness(env, webhookPort);
  for (const result of results) {
    console.log(`[${result.ok ? "ok" : "blocked"}] ${result.label}`);
  }

  const localReady = results
    .filter((result) => result.scope === "local")
    .every((result) => result.ok);
  const externalReady = results
    .filter((result) => result.scope === "external")
    .every((result) => result.ok);

  console.log(localReady ? "DEMO_LOCAL_READY" : "DEMO_LOCAL_BLOCKED");
  console.log(externalReady ? "DEMO_WHATSAPP_READY" : "DEMO_WHATSAPP_BLOCKED");

  if (checkOnly) {
    if (!localReady || !externalReady) process.exitCode = 1;
    return;
  }
  if (!localReady) throw new Error("Service lokal demo belum sehat");

  console.log("Tekan Ctrl+C untuk menghentikan service yang dimulai launcher ini.");
  await new Promise<void>((done) => {
    process.once("SIGINT", done);
    process.once("SIGTERM", done);
  });
}

async function checkReadiness(
  config: FullEnv,
  localWebhookPort: number,
): Promise<Array<{ label: string; ok: boolean; scope: "local" | "external" }>> {
  const webhookConfigured = hasExpectedWebhook(config);
  const [toolReady, gatewayReady, webhookReady, fonnteReady, publicReady] = await Promise.all([
    isExpectedHttpStatus(
      `http://${config.INTERNAL_TOOL_HOST}:${config.INTERNAL_TOOL_PORT}/internal/tools/rag-query`,
      405,
    ),
    isPortOpen(services[1].port),
    isExpectedHttpStatus(`http://127.0.0.1:${localWebhookPort}/health`, 200),
    checkFonnteDevice(config.FONNTE_TOKEN),
    checkPublicHealth(config.PUBLIC_WEBHOOK_URL),
  ]);

  return [
    { label: "internal RAG tool hanya tersedia di loopback", ok: toolReady, scope: "local" },
    { label: "OpenClaw gateway tersedia di loopback", ok: gatewayReady, scope: "local" },
    { label: "webhook app lokal sehat", ok: webhookReady, scope: "local" },
    { label: "Fonnte token valid dan device connected", ok: fonnteReady, scope: "external" },
    { label: "PUBLIC_WEBHOOK_URL memakai route dan secret demo yang benar", ok: webhookConfigured, scope: "external" },
    { label: "endpoint publik /health dapat dijangkau", ok: publicReady, scope: "external" },
  ];
}

async function checkFonnteDevice(token: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch("https://api.fonnte.com/device", {
      method: "POST",
      headers: { authorization: token },
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const parsed = z.object({
      status: z.union([z.boolean(), z.string()]).optional(),
      device_status: z.string().optional(),
    }).passthrough().safeParse(await response.json());
    if (!parsed.success) return false;
    const status = parsed.data.status === true || parsed.data.status === "true";
    const deviceStatus = parsed.data.device_status?.toLowerCase() ?? "";
    return status && ["connect", "connected", "ready"].includes(deviceStatus);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function checkPublicHealth(publicWebhookUrl: string): Promise<boolean> {
  try {
    const webhook = new URL(publicWebhookUrl);
    const health = new URL("/health", webhook.origin);
    return isExpectedHttpStatus(health.toString(), 200, 15_000);
  } catch {
    return false;
  }
}

function hasExpectedWebhook(config: FullEnv): boolean {
  const webhook = new URL(config.PUBLIC_WEBHOOK_URL);
  return webhook.pathname.replace(/\/+$/, "") === "/webhook/fonnte"
    && webhook.searchParams.get("token") === config.FONNTE_WEBHOOK_SECRET;
}

async function isExpectedHttpStatus(
  url: string,
  expectedStatus: number,
  timeoutMs = 2_000,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.status === expectedStatus;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function isPortOpen(port: number, timeoutMs = 1_000): Promise<boolean> {
  return new Promise((done) => {
    const socket = connect({ host: "127.0.0.1", port });
    const finish = (result: boolean) => {
      socket.destroy();
      done(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function waitForPort(
  port: number,
  timeoutMs: number,
  child: ChildProcess,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Service demo berhenti sebelum port ${port} siap`);
    }
    if (await isPortOpen(port)) return;
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error(`Timeout menunggu service demo pada port ${port}`);
}

function parsePort(raw: string): number {
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1_024 || port > 65_535) {
    throw new Error("PORT harus berupa angka 1024-65535");
  }
  return port;
}

async function shutdown(): Promise<void> {
  for (const child of ownedChildren.reverse()) {
    if (!child.killed) child.kill("SIGTERM");
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Demo gagal dimulai");
    process.exitCode = 1;
  })
  .finally(shutdown);
