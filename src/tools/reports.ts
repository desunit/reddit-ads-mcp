/**
 * Performance reporting tools.
 *
 * Reddit Ads reports are query-only: POST a report spec to
 * /ad_accounts/{id}/reports and receive paginated rows synchronously.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { redditRequest } from "../client.js";
import { run, compact } from "../shared.js";
import { BREAKDOWNS, LEVELS, DEFAULT_REPORT_FIELDS, DEFAULT_RANGE_DAYS } from "../constants.js";

/** Format a Date as an hourly ISO timestamp (UTC), as reports require. */
function isoHour(d: Date): string {
  const copy = new Date(d);
  copy.setUTCMinutes(0, 0, 0);
  return copy.toISOString().replace(".000Z", "Z");
}

/** Return [start, end] hourly ISO timestamps for the last `days` days. */
function lastNDays(days: number): [string, string] {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  return [isoHour(start), isoHour(end)];
}

function levelBreakdown(level: string): (typeof BREAKDOWNS)[number] | undefined {
  if (level === "CAMPAIGN") return "CAMPAIGN_ID";
  if (level === "AD_GROUP") return "AD_GROUP_ID";
  if (level === "AD") return "AD_ID";
  return undefined;
}

function buildReportBody(args: {
  level: string;
  fields?: string[];
  breakdowns?: string[];
  starts_at: string;
  ends_at: string;
  time_zone_id?: string;
  filter?: string;
  custom_column_ids?: string[];
  conversion_metrics?: Record<string, unknown>[];
  raw_data?: Record<string, unknown>;
}) {
  const breakdowns = [...(args.breakdowns ?? [])];
  const entityBreakdown = levelBreakdown(args.level);
  if (entityBreakdown && !breakdowns.includes(entityBreakdown)) {
    breakdowns.unshift(entityBreakdown);
  }

  return {
    data: compact({
      fields: args.fields?.length ? args.fields : DEFAULT_REPORT_FIELDS,
      breakdowns: breakdowns.length ? breakdowns : undefined,
      starts_at: args.starts_at,
      ends_at: args.ends_at,
      time_zone_id: args.time_zone_id,
      filter: args.filter,
      custom_column_ids: args.custom_column_ids,
      conversion_metrics: args.conversion_metrics,
      ...(args.raw_data ?? {}),
    }),
  };
}

const pageTokenParam = z.string().optional().describe("Pagination token for the `page.token` query parameter.");
const pageSizeParam = z.number().int().positive().max(1000).optional().describe("Items to return via `page.size`.");

export function registerReportTools(server: McpServer): void {
  server.registerTool(
    "report_run",
    {
      title: "Run performance report",
      description:
        "Run a custom performance report for an ad account. Choose level, metrics, up to 2 breakdowns, and a date range. " +
        "If start/end are omitted, defaults to the last 7 days.",
      inputSchema: {
        account_id: z.string().describe("Reddit ad account ID to report on."),
        level: z
          .enum(LEVELS)
          .default("ACCOUNT")
          .describe("Convenience aggregation level. CAMPAIGN/AD_GROUP/AD adds the matching ID breakdown."),
        fields: z
          .array(z.string())
          .optional()
          .describe(`Report fields to return, e.g. IMPRESSIONS, CLICKS, SPEND. Defaults to ${DEFAULT_REPORT_FIELDS.join(", ")}.`),
        breakdowns: z
          .array(z.enum(BREAKDOWNS))
          .max(4)
          .optional()
          .describe("Report breakdowns, e.g. DATE, COUNTRY, REGION, CAMPAIGN_ID."),
        starts_at: z.string().optional().describe("Start timestamp, hourly ISO format: YYYY-MM-DDTHH:00:00Z."),
        ends_at: z.string().optional().describe("End timestamp, hourly ISO format: YYYY-MM-DDTHH:00:00Z."),
        time_zone_id: z
          .string()
          .optional()
          .describe("IANA timezone for starts_at/ends_at. Defaults to UTC."),
        filter: z
          .string()
          .optional()
          .describe("Comma-separated report filter expression, e.g. campaign:effective_status==ACTIVE."),
        custom_column_ids: z.array(z.string()).optional().describe("Custom column IDs to include."),
        conversion_metrics: z.array(z.record(z.unknown())).optional().describe("Conversion metric configurations."),
        page_token: pageTokenParam,
        page_size: pageSizeParam,
        raw_data: z
          .record(z.unknown())
          .optional()
          .describe("Additional raw report request fields merged into data."),
      },
    },
    ({
      account_id,
      level,
      fields,
      breakdowns,
      starts_at,
      ends_at,
      time_zone_id,
      filter,
      custom_column_ids,
      conversion_metrics,
      page_token,
      page_size,
      raw_data,
    }) =>
      run(() => {
        const [defStart, defEnd] = lastNDays(DEFAULT_RANGE_DAYS);
        return redditRequest("POST", `/ad_accounts/${encodeURIComponent(account_id)}/reports`, {
          query: { "page.token": page_token, "page.size": page_size },
          body: buildReportBody({
            level,
            fields,
            breakdowns,
            starts_at: starts_at ?? defStart,
            ends_at: ends_at ?? defEnd,
            time_zone_id,
            filter,
            custom_column_ids,
            conversion_metrics,
            raw_data,
          }),
        });
      }),
  );

  server.registerTool(
    "report_daily",
    {
      title: "Daily performance report",
      description:
        "Convenience report: per-day performance over the last N days (breakdown=date) with the default core metrics. " +
        "Good for spotting trends quickly.",
      inputSchema: {
        account_id: z.string().describe("Reddit ad account ID to report on."),
        days: z
          .number()
          .int()
          .positive()
          .max(366)
          .default(DEFAULT_RANGE_DAYS)
          .describe(`Number of days back from today (default ${DEFAULT_RANGE_DAYS}).`),
        level: z.enum(LEVELS).default("ACCOUNT").describe("Aggregation level (default ACCOUNT)."),
        fields: z
          .array(z.string())
          .optional()
          .describe(`Report fields to return. Defaults to ${DEFAULT_REPORT_FIELDS.join(", ")}.`),
      },
    },
    ({ account_id, days, level, fields }) =>
      run(() => {
        const [starts_at, ends_at] = lastNDays(days);
        return redditRequest("POST", `/ad_accounts/${encodeURIComponent(account_id)}/reports`, {
          body: buildReportBody({ level, fields, breakdowns: ["DATE"], starts_at, ends_at }),
        });
      }),
  );
}
