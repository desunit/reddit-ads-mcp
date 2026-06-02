/**
 * Shared helpers for tool handlers.
 */

import { RedditAdsError } from "./client.js";

export type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

/** Wrap a handler so any error becomes an MCP error result instead of crashing. */
export async function run(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    const data = await fn();
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  } catch (err) {
    const msg =
      err instanceof RedditAdsError
        ? `${err.message}${err.body ? `\n${err.body}` : ""}`
        : (err as Error).message;
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${msg}` }],
    };
  }
}

/** Build a request body, dropping undefined values so PATCH stays minimal. */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}
