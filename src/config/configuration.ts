import { readFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import type { ServerConfig } from "../models/types.js";

const CONFIG_DIR = join(homedir(), ".asana-mcp-server");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

interface ConfigFile {
  workspace_gid?: string;
  readonly_mode?: boolean;
  allow_delete?: boolean;
  default_limit?: number;
  max_limit?: number;
  log_level?: string;
  project_allowlist?: string[];
  write_allowlist?: string[];
}

function parseAllowlist(
  envVar: string | undefined,
  fileValue: string[] | undefined
): string[] | undefined {
  if (envVar) {
    const ids = envVar.split(",").map((s) => s.trim()).filter(Boolean);
    return ids.length > 0 ? ids : undefined;
  }
  return fileValue;
}

export function loadConfig(): ServerConfig {
  let fileConfig: ConfigFile = {};

  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = readFileSync(CONFIG_PATH, "utf-8");
      fileConfig = JSON.parse(raw) as ConfigFile;
    } catch {
      log("warning", `Failed to parse config file at ${CONFIG_PATH}`);
    }
  }

  const readonlyEnv = process.env.ASANA_MCP_READONLY;
  const readonlyMode =
    readonlyEnv !== undefined
      ? readonlyEnv !== "false" && readonlyEnv !== "0"
      : fileConfig.readonly_mode ?? true; // readonly by default

  const allowWriteMyTasksEnv = process.env.ASANA_MCP_ALLOW_WRITE_MY_TASKS;
  const allowWriteMyTasks =
    allowWriteMyTasksEnv !== undefined
      ? allowWriteMyTasksEnv === "true" || allowWriteMyTasksEnv === "1"
      : (fileConfig as Record<string, unknown>).allow_write_my_tasks === true;

  const allowDeleteEnv = process.env.ASANA_MCP_ALLOW_DELETE;
  const allowDelete =
    allowDeleteEnv !== undefined
      ? allowDeleteEnv === "true" || allowDeleteEnv === "1"
      : fileConfig.allow_delete ?? false; // delete disabled by default

  const logFile = process.env.ASANA_MCP_LOG_FILE ??
    (fileConfig as Record<string, unknown>).log_file as string | undefined;

  const config: ServerConfig = {
    asana_access_token: process.env.ASANA_ACCESS_TOKEN,
    workspace_gid:
      process.env.ASANA_WORKSPACE_GID ?? fileConfig.workspace_gid,
    readonly_mode: readonlyMode,
    allow_delete: allowDelete,
    allow_write_my_tasks: allowWriteMyTasks,
    default_limit: parseInt(
      process.env.ASANA_MCP_DEFAULT_LIMIT ??
        String(fileConfig.default_limit ?? 50),
      10
    ),
    max_limit: parseInt(
      process.env.ASANA_MCP_MAX_LIMIT ??
        String(fileConfig.max_limit ?? 200),
      10
    ),
    log_level: (process.env.ASANA_MCP_LOG_LEVEL ??
      fileConfig.log_level ??
      "info") as ServerConfig["log_level"],
    log_file: logFile,
    project_allowlist: parseAllowlist(
      process.env.ASANA_MCP_PROJECT_ALLOWLIST,
      fileConfig.project_allowlist
    ),
    write_allowlist: parseAllowlist(
      process.env.ASANA_MCP_WRITE_ALLOWLIST,
      fileConfig.write_allowlist
    ),
  };

  return config;
}

const LOG_LEVELS = { debug: 0, info: 1, warning: 2, error: 3 } as const;
let currentLevel: number = LOG_LEVELS.info;
let logFilePath: string | undefined;

export function setLogLevel(level: ServerConfig["log_level"]): void {
  currentLevel = LOG_LEVELS[level] ?? LOG_LEVELS.info;
}

export function setLogFile(path: string | undefined): void {
  if (!path) return;
  logFilePath = path;
  try {
    mkdirSync(dirname(path), { recursive: true });
  } catch {
    // best-effort
  }
}

export function log(
  level: "debug" | "info" | "warning" | "error",
  message: string,
  tool?: string
): void {
  if (LOG_LEVELS[level] < currentLevel) return;
  const ts = new Date().toISOString();
  const prefix = tool ? `[${tool}]` : "";
  process.stderr.write(
    `[asana-mcp-server] [${ts}] [${level.toUpperCase()}] ${prefix} ${message}\n`
  );
}

export interface ToolCallLog {
  timestamp: string;
  tool: string;
  args?: Record<string, unknown>;
  duration_ms: number;
  status: "ok" | "error" | "blocked";
  error?: string;
}

/**
 * Append a structured JSON log entry to the log file.
 * Each line is a self-contained JSON object (JSONL format).
 */
export function logToolCall(entry: ToolCallLog): void {
  if (!logFilePath) return;
  try {
    appendFileSync(logFilePath, JSON.stringify(entry) + "\n");
  } catch {
    // best-effort — don't break tool execution over logging
  }
}
