# CLAUDE.md

Guidance for AI agents working in this repo. Keep it short; put durable API/domain
knowledge in [`docs/`](docs/) (git-tracked), not here.

## What this is

`reddit-ads-mcp` — an [MCP](https://modelcontextprotocol.io) server over **stdio** for the
**Reddit Ads API v3**. Exposes the ad-account hierarchy (accounts → campaigns → ad groups →
ads) with create/update/archive tools plus performance reporting. TypeScript, ESM, Node ≥20. Sibling project to
`appfigures-mcp`.

## Commands

```bash
npm install
npm run build      # tsc → dist/  (entry: dist/index.js)
npm run dev        # tsx src/index.ts (run from source)
npm start          # node dist/index.js (after build)
npm run typecheck  # tsc --noEmit
npm run get-token  # one-time OAuth helper to mint a refresh token (see Auth)
```

stdout is reserved for the MCP protocol — **all logging goes to stderr** (`console.error`).
Never `console.log` from server code.

## Layout

- `src/index.ts` — entry point; boots `McpServer` on `StdioServerTransport`. Warns (does not exit)
  on missing env vars.
- `src/server.ts` — registers the three tool groups.
- `src/client.ts` — HTTP wrapper + OAuth. Caches an access token in module scope, refreshes it
  ~60s before expiry via the refresh-token grant. `ADS_BASE_URL`, `TOKEN_URL`, `RedditAdsError` live here.
- `src/shared.ts` — `run()` (wraps handlers so errors become MCP error results), `compact()` (drops
  `undefined` so PATCH bodies stay minimal).
- `src/constants.ts` — common report fields, breakdowns, and other enums.
- `src/tools/{structure,management,reports}.ts` — read / write / reporting tools respectively.
- `scripts/get-token.ts` — interactive auth-code → refresh-token helper.

## Conventions

- Every tool handler wraps its work in `run(() => …)` from `shared.ts`; throw `RedditAdsError`
  (or any `Error`) on failure rather than returning ad-hoc error shapes.
- API paths passed to `redditRequest`/`redditGet` start with `/` (e.g. `/me`,
  `/ad_accounts/{id}/campaigns`). List/create endpoints for campaigns, ad groups, and ads are
  ad-account scoped; single get/update endpoints are top-level (`/campaigns/{id}`,
  `/ad_groups/{id}`, `/ads/{id}`).
- Writes are JSON:API style: `{ "data": { ...attributes } }`, `PATCH` for partial updates.
- Reddit Ads API v3 does not expose hard `DELETE` for campaigns, ad groups, or ads; archive with
  `configured_status=ARCHIVED`.
- Read pagination uses `page.token` / `page.size` query params and response
  `pagination.next_url` / `pagination.previous_url`.

## Auth (read before touching OAuth)

OAuth2 on Reddit's standard endpoints: authorize at `https://www.reddit.com/api/v1/authorize`,
tokens at `https://www.reddit.com/api/v1/access_token`. Runtime uses the **refresh-token grant**
(HTTP Basic `client_id:client_secret`).

Required env: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_REFRESH_TOKEN`, optional
`REDDIT_USER_AGENT`.

⚠️ **Auth setup note.** The live v3 docs say the Ads API is open to all developers and no longer
requires allowlisting/approval, but Ads app creation has moved toward the Reddit Ads business
developer application flow. The `prefs/apps` localhost-callback flow that `scripts/get-token.ts`
assumes may still need confirmation against the live portal, redirect URI rules, and current scope
names. Capture findings in `docs/api-notes.md`.

## Verification status

The public docs and OpenAPI were checked on 2026-06-02. Authenticated live requests were not run from
this environment, so product-specific write fields can still need adjustment. Corrections are
localised: paths in `src/tools/*.ts`, common report fields/breakdowns in `src/constants.ts`.
See [`docs/api-notes.md`](docs/api-notes.md) for the full endpoint map.
