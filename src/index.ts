#!/usr/bin/env node

import { config as dotenvConfig } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Resolve .env relative to the project root (where dist/ lives),
// not process.cwd() — Claude Desktop doesn't set cwd reliably.
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "..", ".env"), quiet: true });

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { loadConfig, setLogLevel, log } from "./config/configuration.js";
import { AsanaClient } from "./asana-client.js";
import { ToolRouter } from "./tools/router.js";
import { TOOL_SCHEMAS } from "./tools/schemas.js";

async function main(): Promise<void> {
  const config = loadConfig();
  setLogLevel(config.log_level);

  if (!config.asana_access_token) {
    log("error", "ASANA_ACCESS_TOKEN is required. Set it in a .env file or as an environment variable.");
    process.exit(1);
  }

  const client = new AsanaClient(config.asana_access_token, config.workspace_gid);

  // Auto-detect workspace if not configured
  await client.setDefaultWorkspace();

  const router = new ToolRouter(client, config);

  if (config.readonly_mode) {
    log("info", "Readonly mode: ON (default)");
  } else {
    const writeScope = config.write_allowlist
      ? `scoped to projects: ${config.write_allowlist.join(", ")}`
      : "all projects";
    log("info", `Readonly mode: OFF — writes enabled for ${writeScope}`);
    if (config.allow_delete) {
      log("warning", "Delete operations: ENABLED");
    }
  }
  if (config.project_allowlist) {
    log("info", `Project allowlist: ${config.project_allowlist.join(", ")}`);
  }

  const server = new Server(
    {
      name: "asana-mcp-server",
      version: "0.1.2",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    let tools = config.readonly_mode
      ? TOOL_SCHEMAS.filter((t) => t.readonly)
      : TOOL_SCHEMAS;
    // Hide delete_task unless explicitly enabled
    if (!config.allow_delete) {
      tools = tools.filter((t) => t.name !== "delete_task");
    }
    // Strip the internal `readonly` property before returning to the client
    return {
      tools: tools.map(({ readonly: _ro, ...rest }) => rest),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return router.handle(name, args as Record<string, unknown> | undefined);
  });

  const transport = new StdioServerTransport();
  log("info", "Starting asana-mcp-server v0.1.2 on stdio");
  await server.connect(transport);
}

main().catch((err) => {
  log("error", `Fatal: ${err}`);
  process.exit(1);
});
