#!/usr/bin/env node
/**
 * One-time helper to obtain a Reddit OAuth2 *refresh token* for the Ads API.
 *
 * Reddit issues refresh tokens via the authorization-code flow. This script:
 *   1. starts a tiny local server on the redirect URI,
 *   2. prints an authorize URL for you to open and approve,
 *   3. captures the returned ?code and exchanges it for tokens,
 *   4. prints the refresh_token to paste into your .env.
 *
 * Prereqs — in your Reddit app (https://www.reddit.com/prefs/apps):
 *   - type: "web app"
 *   - redirect uri: must EXACTLY match REDDIT_REDIRECT_URI below (default
 *     http://localhost:8080/callback)
 *
 * Usage:
 *   REDDIT_CLIENT_ID=… REDDIT_CLIENT_SECRET=… npm run get-token
 */

import http from "node:http";
import { randomBytes } from "node:crypto";
import "dotenv/config";

const CLIENT_ID = process.env.REDDIT_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET?.trim();
const REDIRECT_URI = process.env.REDDIT_REDIRECT_URI?.trim() || "http://localhost:8080/callback";
const SCOPE = process.env.REDDIT_SCOPE?.trim() || "adsread adsedit read";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in the environment first.");
  process.exit(1);
}

const redirect = new URL(REDIRECT_URI);
const PORT = Number(redirect.port || 80);
const state = randomBytes(8).toString("hex");

const authorizeUrl =
  "https://www.reddit.com/api/v1/authorize?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    state,
    redirect_uri: REDIRECT_URI,
    duration: "permanent", // required to receive a refresh_token
    scope: SCOPE,
  }).toString();

async function exchangeCode(code: string): Promise<void> {
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "reddit-ads-mcp-token-helper/0.1.0",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`\nToken exchange failed (${res.status}):\n${text}`);
    process.exit(1);
  }
  const json = JSON.parse(text) as { refresh_token?: string; scope?: string };
  if (!json.refresh_token) {
    console.error(
      `\nNo refresh_token returned. Ensure duration=permanent and the app is a "web app".\n${text}`,
    );
    process.exit(1);
  }
  console.error("\n✅ Success! Add this to your .env:\n");
  console.log(`REDDIT_REFRESH_TOKEN=${json.refresh_token}`);
  console.error(`\n(granted scopes: ${json.scope ?? "?"})`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", REDIRECT_URI);
  if (url.pathname !== redirect.pathname) {
    res.writeHead(404).end("Not found");
    return;
  }
  const err = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");

  if (err) {
    res.writeHead(400).end(`Authorization error: ${err}`);
    console.error(`\nAuthorization denied: ${err}`);
    server.close();
    process.exit(1);
  }
  if (returnedState !== state) {
    res.writeHead(400).end("State mismatch");
    console.error("\nState mismatch — possible CSRF. Aborting.");
    server.close();
    process.exit(1);
  }
  if (code) {
    res.writeHead(200, { "Content-Type": "text/plain" }).end(
      "Authorized. You can close this tab and return to the terminal.",
    );
    await exchangeCode(code);
    server.close();
    process.exit(0);
  }
});

server.listen(PORT, () => {
  console.error("Reddit Ads token helper\n");
  console.error(`Listening on ${REDIRECT_URI}`);
  console.error("\nOpen this URL in your browser, log in, and approve:\n");
  console.error(authorizeUrl + "\n");
});
