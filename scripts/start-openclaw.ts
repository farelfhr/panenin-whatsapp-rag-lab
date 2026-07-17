import "dotenv/config";
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAgentEnv } from "../src/config/env.js";

const validated = parseAgentEnv({ ...process.env, OPENCLAW_ENABLED: "true" });
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const portableNode = "C:\\Users\\user\\AppData\\Local\\Programs\\node-v24.18.0";
const globalNpm = process.env["APPDATA"] ? `${process.env["APPDATA"]}\\npm` : "";
const pathParts = [portableNode, globalNpm, process.env["PATH"] ?? ""].filter(Boolean);
const portableNodeExecutable = `${portableNode}\\node.exe`;
const localOpenClawEntry = resolve(
  repoRoot,
  "openclaw",
  "plugins",
  "panenin-tools",
  "node_modules",
  "openclaw",
  "openclaw.mjs",
);
const globalOpenClawEntry = `${globalNpm}\\node_modules\\openclaw\\openclaw.mjs`;
const openClawEntry = existsSync(localOpenClawEntry) ? localOpenClawEntry : globalOpenClawEntry;
const command = existsSync(portableNodeExecutable) && existsSync(openClawEntry)
  ? portableNodeExecutable
  : "openclaw";
const commandArgs = command === portableNodeExecutable
  ? [openClawEntry, "gateway", "run"]
  : ["gateway", "run"];
const runtimeDirectory = resolve(repoRoot, "tmp", "openclaw-runtime");
const stateDirectory = resolve(runtimeDirectory, "state");
const configSource = resolve(repoRoot, "openclaw", "config", "openclaw.example.json5");
const configPath = resolve(runtimeDirectory, "openclaw.json5");
const workspacePath = resolve(repoRoot, "openclaw", "workspace");
const pluginPath = resolve(repoRoot, "openclaw", "plugins", "panenin-tools");
mkdirSync(runtimeDirectory, { recursive: true });
copyFileSync(configSource, configPath);

const child = spawn(command, commandArgs, {
  stdio: "inherit",
  shell: false,
  windowsHide: true,
  env: {
    ...process.env,
    PATH: pathParts.join(process.platform === "win32" ? ";" : ":"),
    NODE_DISABLE_COMPILE_CACHE: "1",
    OPENCLAW_SDK_RETRY_MAX_WAIT_SECONDS: "5",
    OPENCLAW_CONFIG_PATH: configPath,
    OPENCLAW_OFFLINE: "1",
    OPENCLAW_STATE_DIR: stateDirectory,
    GROQ_API_KEY: validated.GROQ_API_KEY,
    GROQ_BASE_URL: validated.GROQ_BASE_URL,
    GROQ_MODEL: validated.GROQ_MODEL,
    GROQ_FALLBACK_MODEL: validated.GROQ_FALLBACK_MODEL,
    GROQ_TERTIARY_MODEL: validated.GROQ_TERTIARY_MODEL,
    OPENCLAW_PRIMARY_MODEL: `groq/${validated.GROQ_MODEL}`,
    OPENCLAW_FALLBACK_MODEL: `groq-fast/${validated.GROQ_FALLBACK_MODEL}`,
    OPENCLAW_TERTIARY_MODEL: `groq-backup/${validated.GROQ_TERTIARY_MODEL}`,
    OPENCLAW_GATEWAY_TOKEN: validated.OPENCLAW_GATEWAY_TOKEN,
    PANENIN_OPENCLAW_PLUGIN_PATH: pluginPath,
    PANENIN_OPENCLAW_WORKSPACE: workspacePath,
    PANENIN_TOOL_SECRET: validated.PANENIN_TOOL_SECRET,
    PANENIN_RAG_TOOL_URL: validated.PANENIN_RAG_TOOL_URL,
  },
});

console.log("OpenClaw gateway starting on http://127.0.0.1:18789");

child.once("error", () => {
  console.error("OpenClaw gateway gagal dimulai");
  process.exitCode = 1;
});

child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}
