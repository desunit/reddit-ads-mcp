/**
 * Write tools: create / update / delete for campaigns, ad groups, and ads.
 *
 * Reddit Ads API v3 wraps write payloads as `{ "data": { ...attributes } }` and
 * uses PATCH for partial updates. The OpenAPI v3 spec does not expose DELETE
 * for campaigns, ad groups, or ads, so the `*_delete` tools archive via PATCH.
 *
 * The attribute fields below cover the common cases; pass anything extra via the
 * open-ended `fields` object, which is merged into the payload verbatim.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { redditRequest } from "../client.js";
import { run, compact } from "../shared.js";
import { STATUSES } from "../constants.js";

const accountId = z.string().describe("Reddit ad account ID that owns the resource.");

const status = z
  .enum(STATUSES)
  .optional()
  .describe("Lifecycle status. Use PAUSED to pause, ARCHIVED to archive (preferred over delete).");

const extraFields = z
  .record(z.unknown())
  .optional()
  .describe("Additional raw attribute fields to merge into the request body (e.g. fields not modelled here).");

/** Build the JSON:API-style write envelope Reddit expects. */
function wrap(attributes: Record<string, unknown>) {
  return { data: compact(attributes) };
}

export function registerManagementTools(server: McpServer): void {
  // ----- Campaigns -----------------------------------------------------------
  server.registerTool(
    "campaign_create",
    {
      title: "Create campaign",
      description: "Create a campaign in an ad account. Returns the created campaign.",
      inputSchema: {
        account_id: accountId,
        name: z.string().describe("Campaign name."),
        objective: z
          .enum([
            "APP_INSTALLS",
            "CATALOG_SALES",
            "CLICKS",
            "CONVERSIONS",
            "IMPRESSIONS",
            "LEAD_GENERATION",
            "VIDEO_VIEWABLE_IMPRESSIONS",
          ])
          .describe("Campaign objective."),
        configured_status: status.default("ACTIVE"),
        fields: extraFields,
      },
    },
    ({ account_id, fields, ...attrs }) =>
      run(() =>
        redditRequest("POST", `/ad_accounts/${encodeURIComponent(account_id)}/campaigns`, {
          body: wrap({ ...attrs, ...(fields ?? {}) }),
        }),
      ),
  );

  server.registerTool(
    "campaign_update",
    {
      title: "Update campaign",
      description:
        "Update a campaign (partial PATCH). Change name, objective, or configured_status (PAUSED/ARCHIVED/ACTIVE).",
      inputSchema: {
        account_id: accountId,
        campaign_id: z.string().describe("Campaign ID to update."),
        name: z.string().optional().describe("New campaign name."),
        objective: z.string().optional().describe("New objective."),
        configured_status: status,
        fields: extraFields,
      },
    },
    ({ account_id, campaign_id, fields, ...attrs }) =>
      run(() =>
        redditRequest(
          "PATCH",
          `/campaigns/${encodeURIComponent(campaign_id)}`,
          { body: wrap({ ...attrs, ...(fields ?? {}) }) },
        ),
      ),
  );

  server.registerTool(
    "campaign_delete",
    {
      title: "Delete campaign",
      description:
        "Archive a campaign by setting configured_status=ARCHIVED. Reddit Ads API v3 does not expose campaign DELETE.",
      inputSchema: {
        account_id: accountId,
        campaign_id: z.string().describe("Campaign ID to delete."),
      },
    },
    ({ account_id, campaign_id }) =>
      run(() =>
        redditRequest(
          "PATCH",
          `/campaigns/${encodeURIComponent(campaign_id)}`,
          { body: wrap({ configured_status: "ARCHIVED" }) },
        ),
      ),
  );

  // ----- Ad groups -----------------------------------------------------------
  server.registerTool(
    "ad_group_create",
    {
      title: "Create ad group",
      description: "Create an ad group under a campaign. Returns the created ad group.",
      inputSchema: {
        account_id: accountId,
        campaign_id: z.string().describe("Parent campaign ID."),
        name: z.string().describe("Ad group name."),
        configured_status: status,
        bid_strategy: z.string().optional().describe("Bid strategy, e.g. BIDLESS, MAXIMIZE_VOLUME, TARGET_CPX."),
        bid_type: z.string().optional().describe("Bid type, e.g. CPC, CPM, CPV, CPV6."),
        bid_value: z.number().optional().describe("Bid amount in account currency micros (if required by the strategy)."),
        goal_value: z.number().optional().describe("Budget/goal value in account currency micros."),
        fields: extraFields,
      },
    },
    ({ account_id, fields, ...attrs }) =>
      run(() =>
        redditRequest("POST", `/ad_accounts/${encodeURIComponent(account_id)}/ad_groups`, {
          body: wrap({ ...attrs, ...(fields ?? {}) }),
        }),
      ),
  );

  server.registerTool(
    "ad_group_update",
    {
      title: "Update ad group",
      description: "Update an ad group (partial PATCH). Change name, status, bid, or budget.",
      inputSchema: {
        account_id: accountId,
        ad_group_id: z.string().describe("Ad group ID to update."),
        name: z.string().optional().describe("New ad group name."),
        configured_status: status,
        bid_strategy: z.string().optional().describe("New bid strategy."),
        bid_type: z.string().optional().describe("New bid type."),
        bid_value: z.number().optional().describe("New bid amount (micros)."),
        goal_value: z.number().optional().describe("New budget/goal value (micros)."),
        fields: extraFields,
      },
    },
    ({ account_id, ad_group_id, fields, ...attrs }) =>
      run(() =>
        redditRequest(
          "PATCH",
          `/ad_groups/${encodeURIComponent(ad_group_id)}`,
          { body: wrap({ ...attrs, ...(fields ?? {}) }) },
        ),
      ),
  );

  server.registerTool(
    "ad_group_delete",
    {
      title: "Delete ad group",
      description: "Archive an ad group by setting configured_status=ARCHIVED. Reddit Ads API v3 does not expose ad group DELETE.",
      inputSchema: {
        account_id: accountId,
        ad_group_id: z.string().describe("Ad group ID to delete."),
      },
    },
    ({ account_id, ad_group_id }) =>
      run(() =>
        redditRequest(
          "PATCH",
          `/ad_groups/${encodeURIComponent(ad_group_id)}`,
          { body: wrap({ configured_status: "ARCHIVED" }) },
        ),
      ),
  );

  // ----- Ads -----------------------------------------------------------------
  server.registerTool(
    "ad_create",
    {
      title: "Create ad",
      description: "Create an ad under an ad group. Returns the created ad.",
      inputSchema: {
        account_id: accountId,
        ad_group_id: z.string().describe("Parent ad group ID."),
        name: z.string().describe("Ad name."),
        configured_status: status,
        post_id: z.string().optional().describe("ID of the Reddit post/promoted post backing this ad."),
        type: z.string().optional().describe("Ad type, e.g. TEXT, IMAGE, VIDEO, CAROUSEL."),
        fields: extraFields,
      },
    },
    ({ account_id, fields, ...attrs }) =>
      run(() =>
        redditRequest("POST", `/ad_accounts/${encodeURIComponent(account_id)}/ads`, {
          body: wrap({ ...attrs, ...(fields ?? {}) }),
        }),
      ),
  );

  server.registerTool(
    "ad_update",
    {
      title: "Update ad",
      description: "Update an ad (partial PATCH). Change name or status.",
      inputSchema: {
        account_id: accountId,
        ad_id: z.string().describe("Ad ID to update."),
        name: z.string().optional().describe("New ad name."),
        configured_status: status,
        fields: extraFields,
      },
    },
    ({ account_id, ad_id, fields, ...attrs }) =>
      run(() =>
        redditRequest(
          "PATCH",
          `/ads/${encodeURIComponent(ad_id)}`,
          { body: wrap({ ...attrs, ...(fields ?? {}) }) },
        ),
      ),
  );

  server.registerTool(
    "ad_delete",
    {
      title: "Delete ad",
      description: "Archive an ad by setting configured_status=ARCHIVED. Reddit Ads API v3 does not expose ad DELETE.",
      inputSchema: {
        account_id: accountId,
        ad_id: z.string().describe("Ad ID to delete."),
      },
    },
    ({ account_id, ad_id }) =>
      run(() =>
        redditRequest(
          "PATCH",
          `/ads/${encodeURIComponent(ad_id)}`,
          { body: wrap({ configured_status: "ARCHIVED" }) },
        ),
      ),
  );
}
