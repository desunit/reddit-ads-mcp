/**
 * Read-only structure tools: who am I, accounts, and the
 * campaign / ad group / ad hierarchy.
 *
 * Reddit Ads API v3 nests list/create endpoints under an ad account:
 *   /ad_accounts/{ad_account_id}/{campaigns|ad_groups|ads}
 * Single campaign/ad group/ad reads are top-level: /campaigns/{id}, etc.
 * List responses include `pagination.next_url` / `pagination.previous_url`;
 * pass the `page.token` value as `page_token`.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { redditGet } from "../client.js";
import { run } from "../shared.js";

const accountId = z
  .string()
  .describe("Reddit ad account ID (the numeric id, without the 't2_'/'a2_' style prefix unless required).");

const pageTokenParam = z
  .string()
  .optional()
  .describe("Pagination token for the `page.token` query parameter.");

const pageSizeParam = z
  .number()
  .int()
  .positive()
  .max(1000)
  .optional()
  .describe("Number of items to return via `page.size` (max 1000).");

export function registerStructureTools(server: McpServer): void {
  // GET /me — the authenticated user.
  server.registerTool(
    "whoami",
    {
      title: "Who am I",
      description: "Return the authenticated Reddit user behind the current OAuth credentials. Useful to verify auth.",
      inputSchema: {},
    },
    () => run(() => redditGet("/me")),
  );

  // GET /ad_accounts/{id} — a single ad account's details.
  server.registerTool(
    "account_get",
    {
      title: "Get ad account",
      description: "Fetch a single Reddit ad account by ID (name, currency, timezone, status).",
      inputSchema: { account_id: accountId },
    },
    ({ account_id }) => run(() => redditGet(`/ad_accounts/${encodeURIComponent(account_id)}`)),
  );

  // GET /me/businesses — businesses the authenticated user can access.
  server.registerTool(
    "businesses_list",
    {
      title: "List businesses",
      description: "List Reddit Ads businesses accessible to the authenticated user.",
      inputSchema: {
        account_id: accountId.optional().describe("Optionally filter businesses by ad account ID."),
        role: z.string().optional().describe("Optionally filter by business role."),
        page_token: pageTokenParam,
        page_size: pageSizeParam,
      },
    },
    ({ account_id, role, page_token, page_size }) =>
      run(() =>
        redditGet("/me/businesses", {
          ad_account_id: account_id,
          role,
          "page.token": page_token,
          "page.size": page_size,
        }),
      ),
  );

  // GET /businesses/{id}/ad_accounts — ad accounts under a business.
  server.registerTool(
    "accounts_list",
    {
      title: "List ad accounts",
      description: "List Reddit ad accounts under a business.",
      inputSchema: {
        business_id: z.string().describe("Business ID whose ad accounts should be listed."),
        ids: z.array(z.string()).optional().describe("Optional ad account IDs to filter by."),
        page_token: pageTokenParam,
        page_size: pageSizeParam,
      },
    },
    ({ business_id, ids, page_token, page_size }) =>
      run(() =>
        redditGet(`/businesses/${encodeURIComponent(business_id)}/ad_accounts`, {
          ids,
          "page.token": page_token,
          "page.size": page_size,
        }),
      ),
  );

  // GET /ad_accounts/{id}/campaigns
  server.registerTool(
    "campaigns_list",
    {
      title: "List campaigns",
      description: "List campaigns within an ad account.",
      inputSchema: {
        account_id: accountId,
        ids: z.array(z.string()).optional().describe("Optional campaign IDs to filter by."),
        page_token: pageTokenParam,
        page_size: pageSizeParam,
      },
    },
    ({ account_id, ids, page_token, page_size }) =>
      run(() =>
        redditGet(`/ad_accounts/${encodeURIComponent(account_id)}/campaigns`, {
          id: ids,
          "page.token": page_token,
          "page.size": page_size,
        }),
      ),
  );

  // GET /campaigns/{campaign_id}
  server.registerTool(
    "campaign_get",
    {
      title: "Get campaign",
      description: "Fetch a single campaign by ID.",
      inputSchema: {
        campaign_id: z.string().describe("Campaign ID."),
      },
    },
    ({ campaign_id }) => run(() => redditGet(`/campaigns/${encodeURIComponent(campaign_id)}`)),
  );

  // GET /ad_accounts/{id}/ad_groups (optionally filtered by campaign)
  server.registerTool(
    "ad_groups_list",
    {
      title: "List ad groups",
      description: "List ad groups within an ad account, optionally filtered to a single campaign.",
      inputSchema: {
        account_id: accountId,
        campaign_id: z.string().optional().describe("Filter to ad groups under this campaign."),
        ids: z.array(z.string()).optional().describe("Optional ad group IDs to filter by."),
        page_token: pageTokenParam,
        page_size: pageSizeParam,
      },
    },
    ({ account_id, campaign_id, ids, page_token, page_size }) =>
      run(() =>
        redditGet(`/ad_accounts/${encodeURIComponent(account_id)}/ad_groups`, {
          campaign_id,
          id: ids,
          "page.token": page_token,
          "page.size": page_size,
        }),
      ),
  );

  // GET /ad_groups/{ad_group_id}
  server.registerTool(
    "ad_group_get",
    {
      title: "Get ad group",
      description: "Fetch a single ad group by ID.",
      inputSchema: {
        ad_group_id: z.string().describe("Ad group ID."),
      },
    },
    ({ ad_group_id }) => run(() => redditGet(`/ad_groups/${encodeURIComponent(ad_group_id)}`)),
  );

  // GET /ad_accounts/{id}/ads (optionally filtered by ad group)
  server.registerTool(
    "ads_list",
    {
      title: "List ads",
      description: "List ads within an ad account, optionally filtered to a single ad group.",
      inputSchema: {
        account_id: accountId,
        ad_group_id: z.string().optional().describe("Filter to ads under this ad group."),
        campaign_id: z.string().optional().describe("Filter to ads under this campaign."),
        ids: z.array(z.string()).optional().describe("Optional ad IDs to filter by."),
        page_token: pageTokenParam,
        page_size: pageSizeParam,
      },
    },
    ({ account_id, ad_group_id, campaign_id, ids, page_token, page_size }) =>
      run(() =>
        redditGet(`/ad_accounts/${encodeURIComponent(account_id)}/ads`, {
          ad_group_id,
          campaign_id,
          id: ids,
          "page.token": page_token,
          "page.size": page_size,
        }),
      ),
  );

  // GET /ads/{ad_id}
  server.registerTool(
    "ad_get",
    {
      title: "Get ad",
      description: "Fetch a single ad by ID.",
      inputSchema: {
        ad_id: z.string().describe("Ad ID."),
      },
    },
    ({ ad_id }) => run(() => redditGet(`/ads/${encodeURIComponent(ad_id)}`)),
  );
}
