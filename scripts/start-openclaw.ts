import "dotenv/config";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { parseAgentEnv } from "../src/config/env.js";

const validated = parseAgentEnv({ ...process.env, OPENCLAW_ENABLED: "true" });
const portableNode = "C:\\Users\\user\\AppData\\Local\\Programs\\node-v24.18.0";
const globalNpm = process.env["APPDATA"] ? `${process.env["APPDATA"]}\\npm` : "";
const pathParts = [portableNode, globalNpm, process.env["PATH"] ?? ""].filter(Boolean);
const portableNodeExecutable = `${portableNode}\\node.exe`;
const openClawEntry = `${globalNpm}\\node_modules\\openclaw\\openclaw.mjs`;
const command = existsSync(portableNodeExecutable) && existsSync(openClawEntry)
  ? portableNodeExecutable
  : "openclaw";
const commandArgs = command === portableNodeExecutable
  ? [openClawEntry, "gateway", "run"]
  : ["gateway", "run"];

const child = spawn(command, commandArgs, {
  stdio: "inherit",
  shell: false,
  env: {
    ...process.env,
    PATH: pathParts.join(process.platform === "win32" ? ";" : ":"),
    ANTHROPIC_API_KEY: validated.OLAGON_API_KEY,
    OPENCLAW_GATEWAY_TOKEN: validated.OPENCLAW_GATEWAY_TOKEN,
    PANENIN_TOOL_SECRET: validated.PANENIN_TOOL_SECRET,
    PANENIN_RAG_TOOL_URL: validated.PANENIN_RAG_TOOL_URL,
  },
});

child.once("error", () => {
  console.error("OpenClaw gateway gagal dimulai");
  process.exitCode = 1;
});

child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
