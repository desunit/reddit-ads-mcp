/**
 * Thin HTTP wrapper around the Reddit Ads API (v3).
 *
 * Auth: OAuth2. We exchange a long-lived refresh token for short-lived access
 * tokens against https://www.reddit.com/api/v1/access_token (HTTP Basic with
 * client id/secret), cache the access token in module scope, and refresh it
 * shortly before it expires.
 *
 * Docs: https://ads-api.reddit.com/docs/v3/
 */

const ADS_BASE_URL = "https://ads-api.reddit.com/api/v3";
const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";

export class RedditAdsError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = "RedditAdsError";
  }
}

interface Credentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  userAgent: string;
}

/** Read and validate OAuth credentials from the environment. Throws if missing. */
function getCredentials(): Credentials {
  const clientId = process.env.REDDIT_CLIENT_ID?.trim();
  const clientSecret = process.env.REDDIT_CLIENT_SECRET?.trim();
  const refreshToken = process.env.REDDIT_REFRESH_TOKEN?.trim();
  const missing = [
    !clientId && "REDDIT_CLIENT_ID",
    !clientSecret && "REDDIT_CLIENT_SECRET",
    !refreshToken && "REDDIT_REFRESH_TOKEN",
  ].filter(Boolean);
  if (missing.length) {
    throw new RedditAdsError(
      `Missing Reddit OAuth env vars: ${missing.join(", ")}. ` +
        "Create an app at https://www.reddit.com/prefs/apps and run `npm run get-token` " +
        "to obtain a refresh token. See .env.example.",
    );
  }
  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    refreshToken: refreshToken!,
    userAgent:
      process.env.REDDIT_USER_AGENT?.trim() || "reddit-ads-mcp/0.1.0",
  };
}

// Cached access token, valid until `expiresAt` (epoch ms). Refreshed lazily.
let cachedToken: { value: string; expiresAt: number } | null = null;

/** Return a valid access token, refreshing via the refresh token when needed. */
async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  const { clientId, clientSecret, refreshToken, userAgent } = getCredentials();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": userAgent,
      },
      body,
    });
  } catch (err) {
    throw new RedditAdsError(
      `Network error obtaining Reddit access token: ${(err as Error).message}`,
    );
  }

  const text = await res.text();
  if (!res.ok) {
    throw new RedditAdsError(
      `Reddit token endpoint returned ${res.status} ${res.statusText}`,
      res.status,
      text.slice(0, 2000),
    );
  }

  let parsed: { access_token?: string; expires_in?: number };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new RedditAdsError("Failed to parse Reddit token response as JSON", res.status, text.slice(0, 2000));
  }
  if (!parsed.access_token) {
    throw new RedditAdsError("Reddit token response did not include access_token", res.status, text.slice(0, 2000));
  }

  // Refresh ~60s before the stated expiry to avoid edge-of-expiry failures.
  const ttlMs = (parsed.expires_in ?? 3600) * 1000;
  cachedToken = {
    value: parsed.access_token,
    expiresAt: Date.now() + Math.max(ttlMs - 60_000, 0),
  };
  return cachedToken.value;
}

export type QueryValue =
  | string
  | number
  | boolean
  | readonly (string | number | boolean)[]
  | undefined
  | null;
export type Query = Record<string, QueryValue>;
export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** Build a querystring, skipping undefined/null/empty values. */
function buildQuery(query?: Query): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export interface RequestOptions {
  query?: Query;
  /** JSON body for POST/PATCH/PUT requests. */
  body?: unknown;
}

/**
 * Perform an authenticated request against the Reddit Ads API and return parsed
 * JSON. `path` must start with `/` (e.g. "/me", "/ad_accounts/123/campaigns").
 */
export async function redditRequest<T = unknown>(
  method: HttpMethod,
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const token = await getAccessToken();
  const { userAgent } = getCredentials();
  const url = `${ADS_BASE_URL}${path}${buildQuery(opts.query)}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "User-Agent": userAgent,
  };
  let bodyInit: string | undefined;
  if (opts.body !== undefined && method !== "GET" && method !== "DELETE") {
    headers["Content-Type"] = "application/json";
    bodyInit = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: bodyInit });
  } catch (err) {
    throw new RedditAdsError(`Network error calling Reddit Ads API: ${(err as Error).message}`);
  }

  const text = await res.text();
  if (!res.ok) {
    throw new RedditAdsError(
      `Reddit Ads API returned ${res.status} ${res.statusText} for ${method} ${path}`,
      res.status,
      text.slice(0, 2000),
    );
  }

  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new RedditAdsError(`Failed to parse Reddit Ads response as JSON for ${path}`, res.status, text.slice(0, 2000));
  }
}

/** Convenience GET wrapper. */
export const redditGet = <T = unknown>(path: string, query?: Query) =>
  redditRequest<T>("GET", path, { query });
