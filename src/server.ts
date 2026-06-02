/**
 * MCP server definition: registers all Reddit Ads tools.
 *
 * Tools are grouped into modules:
 *   - structure:  read-only accounts / campaigns / ad groups / ads
 *   - management: create / update / delete (campaign CRUD)
 *   - reports:    performance reporting
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerStructureTools } from "./tools/structure.js";
import { registerManagementTools } from "./tools/management.js";
import { registerReportTools } from "./tools/reports.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "reddit-ads-mcp",
    version: "0.1.0",
  });

  registerStructureTools(server);
  registerManagementTools(server);
  registerReportTools(server);

  return server;
}
