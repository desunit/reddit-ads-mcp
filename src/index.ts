#!/usr/bin/env node
/**
 * Entry point: start the Reddit Ads MCP server over stdio.
 * IMPORTANT: stdout is reserved for the MCP protocol — all logging goes to stderr.
 */

import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main() {
  const missing = [
    !process.env.REDDIT_CLIENT_ID?.trim() && "REDDIT_CLIENT_ID",
    !process.env.REDDIT_CLIENT_SECRET?.trim() && "REDDIT_CLIENT_SECRET",
    !process.env.REDDIT_REFRESH_TOKEN?.trim() && "REDDIT_REFRESH_TOKEN",
  ].filter(Boolean);

  if (missing.length) {
    // Warn but don't exit: tools will return a clear error if actually called.
    console.error(
      `[reddit-ads-mcp] Warning: missing env vars (${missing.join(", ")}). ` +
        "Tool calls will fail until they are set. See .env.example.",
    );
  }

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[reddit-ads-mcp] Server running on stdio.");
}

main().catch((err) => {
  console.error("[reddit-ads-mcp] Fatal error:", err);
  process.exit(1);
});
