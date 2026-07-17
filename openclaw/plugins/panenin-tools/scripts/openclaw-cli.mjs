import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const OPENCLAW_NODE_RANGE = ">=22.22.3 <23, >=24.15.0 <25, atau >=25.9.0";

export function parseNodeVersion(rawVersion) {
  const match = String(rawVersion).trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return undefined;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function isSupportedNodeVersion(rawVersion) {
  const version = parseNodeVersion(rawVersion);
  if (!version) return false;
  if (version.major === 22) return isAtLeast(version, { major: 22, minor: 22, patch: 3 });
  if (version.major === 24) return isAtLeast(version, { major: 24, minor: 15, patch: 0 });
  if (version.major === 25) return isAtLeast(version, { major: 25, minor: 9, patch: 0 });
  return version.major > 25;
}

export function discoverWindowsPortableNodes(localAppData = process.env.LOCALAPPDATA) {
  if (!localAppData) return [];
  const programsDirectory = join(localAppData, "Programs");
  if (!existsSync(programsDirectory)) return [];

  return readdirSync(programsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^node-v\d+/i.test(entry.name))
    .map((entry) => join(programsDirectory, entry.name, "node.exe"))
    .filter((candidate) => existsSync(candidate))
    .sort((left, right) => compareVersions(readNodeVersion(right), readNodeVersion(left)));
}

export function selectCompatibleNode(options = {}) {
  const configuredBinary = options.configuredBinary?.trim();
  const currentExecutable = options.currentExecutable ?? process.execPath;
  const currentVersion = options.currentVersion ?? process.version;
  const portableNodes = options.portableNodes ?? discoverWindowsPortableNodes();

  if (configuredBinary) {
    if (!existsSync(configuredBinary)) {
      throw new Error("OPENCLAW_NODE_BINARY tidak ditemukan");
    }
    if (!isSupportedNodeVersion(readNodeVersion(configuredBinary))) {
      throw new Error(`OPENCLAW_NODE_BINARY harus memakai Node ${OPENCLAW_NODE_RANGE}`);
    }
    return configuredBinary;
  }

  if (isSupportedNodeVersion(currentVersion)) return currentExecutable;

  for (const candidate of portableNodes) {
    if (isSupportedNodeVersion(readNodeVersion(candidate))) return candidate;
  }

  throw new Error(
    `OpenClaw membutuhkan Node ${OPENCLAW_NODE_RANGE}. `
      + "Instal Node yang kompatibel atau set OPENCLAW_NODE_BINARY ke node.exe yang sesuai.",
  );
}

function readNodeVersion(executable) {
  const result = spawnSync(executable, ["--version"], {
    encoding: "utf8",
    shell: false,
    timeout: 5_000,
    windowsHide: true,
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

function isAtLeast(version, minimum) {
  return compareVersions(version, minimum) >= 0;
}

function compareVersions(leftInput, rightInput) {
  const left = typeof leftInput === "string" ? parseNodeVersion(leftInput) : leftInput;
  const right = typeof rightInput === "string" ? parseNodeVersion(rightInput) : rightInput;
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  return left.patch - right.patch;
}

function resolveOpenClawEntry() {
  const localEntry = resolve(process.cwd(), "node_modules", "openclaw", "openclaw.mjs");
  if (existsSync(localEntry)) return localEntry;

  const appData = process.env.APPDATA;
  const globalEntry = appData
    ? join(appData, "npm", "node_modules", "openclaw", "openclaw.mjs")
    : "";
  if (globalEntry && existsSync(globalEntry)) return globalEntry;

  throw new Error("OpenClaw CLI tidak ditemukan. Jalankan npm install pada folder plugin.");
}

function run() {
  const args = process.argv.slice(2);
  if (args.length === 0) throw new Error("Argumen OpenClaw CLI wajib diberikan");

  const nodeExecutable = selectCompatibleNode({
    configuredBinary: process.env.OPENCLAW_NODE_BINARY,
  });
  const cliEntry = resolveOpenClawEntry();
  const result = spawnSync(nodeExecutable, [cliEntry, ...args], {
    env: {
      ...process.env,
      NODE_DISABLE_COMPILE_CACHE: "1",
    },
    shell: false,
    stdio: "inherit",
    windowsHide: true,
  });

  if (result.error) throw new Error("OpenClaw CLI gagal dijalankan");
  process.exitCode = result.status ?? 1;
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (entrypoint === import.meta.url) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "OpenClaw CLI gagal dijalankan");
    process.exitCode = 1;
  }
}
