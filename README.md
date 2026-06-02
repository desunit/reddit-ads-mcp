# Reddit Ads MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-compatible-blue.svg)](https://modelcontextprotocol.io)

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that exposes the
[Reddit Ads API v3](https://ads-api.reddit.com/docs/v3/) to AI assistants like Claude. Browse and
manage your full ad-account hierarchy — businesses → accounts → campaigns → ad groups → ads — and pull
performance reports, all in plain language.

```
"List my Reddit ad accounts and their active campaigns."
"Create a paused campaign called 'Spring Launch' under account t2_xxxx."
"Show me clicks, spend, and CTR by campaign for the last 7 days."
"Archive the ad group that isn't converting."
```

## Features

- 🔌 **Stdio MCP server** — works with Claude Code, Claude Desktop, and any MCP client
- 🗂️ **Full hierarchy** — businesses, ad accounts, campaigns, ad groups, ads
- ✍️ **Create / update / archive** — JSON:API-style writes with partial `PATCH` updates
- 📊 **Performance reports** — custom fields, breakdowns, and per-day trends
- 🔐 **OAuth2 refresh-token auth** — token cached in memory and auto-refreshed before expiry
- 🪶 **Zero heavy dependencies** — native `fetch`, just the MCP SDK and `zod`

## Tools

### Structure (read)

| Tool | Endpoint | Description |
|------|----------|-------------|
| `whoami` | `GET /me` | Authenticated Reddit user — useful to verify auth. |
| `businesses_list` | `GET /me/businesses` | Businesses accessible to the authenticated user. |
| `accounts_list` | `GET /businesses/{id}/ad_accounts` | Ad accounts under a business. |
| `account_get` | `GET /ad_accounts/{id}` | A single ad account (name, currency, timezone, status). |
| `campaigns_list` | `GET /ad_accounts/{id}/campaigns` | Campaigns within an ad account. |
| `campaign_get` | `GET /campaigns/{id}` | A single campaign. |
| `ad_groups_list` | `GET /ad_accounts/{id}/ad_groups` | Ad groups in an account (optionally one campaign). |
| `ad_group_get` | `GET /ad_groups/{id}` | A single ad group. |
| `ads_list` | `GET /ad_accounts/{id}/ads` | Ads in an account (optionally one ad group). |
| `ad_get` | `GET /ads/{id}` | A single ad. |

### Management (write)

| Tool | Endpoint | Description |
|------|----------|-------------|
| `campaign_create` | `POST /ad_accounts/{id}/campaigns` | Create a campaign. |
| `campaign_update` | `PATCH /campaigns/{id}` | Partial update (name, status, budget…). |
| `campaign_delete` | `PATCH /campaigns/{id}` | Archive (`configured_status=ARCHIVED`). |
| `ad_group_create` | `POST /ad_accounts/{id}/ad_groups` | Create an ad group under a campaign. |
| `ad_group_update` | `PATCH /ad_groups/{id}` | Partial update (name, status, bid, budget). |
| `ad_group_delete` | `PATCH /ad_groups/{id}` | Archive (`configured_status=ARCHIVED`). |
| `ad_create` | `POST /ad_accounts/{id}/ads` | Create an ad under an ad group. |
| `ad_update` | `PATCH /ads/{id}` | Partial update (name, status). |
| `ad_delete` | `PATCH /ads/{id}` | Archive (`configured_status=ARCHIVED`). |

> Reddit Ads API v3 does not expose hard `DELETE` for campaigns, ad groups, or ads. The `*_delete`
> tools archive by setting `configured_status=ARCHIVED`.

### Reports

| Tool | Endpoint | Description |
|------|----------|-------------|
| `report_run` | `POST /ad_accounts/{id}/reports` | Custom report: pick fields, breakdowns, and date range. |
| `report_daily` | `POST /ad_accounts/{id}/reports` | Per-day trend for the last N days. |

Full parameter reference: [`docs/api-notes.md`](docs/api-notes.md).

## Prerequisites

- Node.js **>= 20**
- A Reddit Ads account and a Reddit **developer application** (client id + secret)

## Getting credentials

The server authenticates with the OAuth2 **refresh-token grant**, so you need a one-time refresh token.

### 1. Create a Reddit app

Create a Reddit Ads developer application and note the **client id** and **client secret**. Set the
redirect URI to `http://localhost:8080/callback` (or set `REDDIT_REDIRECT_URI` to match your own).

> Reddit has moved Ads API app setup into the Ads business developer application flow. Confirm the
> current portal UX, redirect-URI rules, and scope names against the live portal before relying on
> the legacy `prefs/apps` path.

### 2. Mint a refresh token

```bash
REDDIT_CLIENT_ID=xxx REDDIT_CLIENT_SECRET=yyy npm run get-token
```

Open the printed URL, approve access, and copy the `REDDIT_REFRESH_TOKEN=…` value it prints.

## Installation

```bash
git clone https://github.com/desunit/reddit-ads-mcp.git
cd reddit-ads-mcp
npm install
npm run build
```

## Configuration

The server reads these environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `REDDIT_CLIENT_ID` | ✅ | Reddit app client id. |
| `REDDIT_CLIENT_SECRET` | ✅ | Reddit app client secret. |
| `REDDIT_REFRESH_TOKEN` | ✅ | Refresh token from `npm run get-token`. |
| `REDDIT_USER_AGENT` | ➖ | Descriptive, unique UA (recommended by Reddit). |

For local development, copy `.env.example` → `.env` and fill it in.

### Claude Code

```bash
claude mcp add reddit-ads \
  --env REDDIT_CLIENT_ID=xxx \
  --env REDDIT_CLIENT_SECRET=yyy \
  --env REDDIT_REFRESH_TOKEN=zzz \
  --env "REDDIT_USER_AGENT=reddit-ads-mcp/0.1.0 (by /u/your_username)" \
  -- node /absolute/path/to/reddit-ads-mcp/dist/index.js
```

### Claude Desktop / generic MCP client

Add to your client's `mcpServers` config (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "reddit-ads": {
      "command": "node",
      "args": ["/absolute/path/to/reddit-ads-mcp/dist/index.js"],
      "env": {
        "REDDIT_CLIENT_ID": "...",
        "REDDIT_CLIENT_SECRET": "...",
        "REDDIT_REFRESH_TOKEN": "...",
        "REDDIT_USER_AGENT": "reddit-ads-mcp/0.1.0 (by /u/your_username)"
      }
    }
  }
}
```

Restart the client, then ask it about your Reddit ads.

## Usage examples

Once connected, prompt your assistant naturally:

- *"Who am I authenticated as?"* → `whoami`
- *"List my businesses and ad accounts."* → `businesses_list` → `accounts_list`
- *"Show campaigns in account t2_xxxx."* → `campaigns_list`
- *"Create a paused campaign 'Spring Launch'."* → `campaign_create`
- *"Spend and CTR by campaign for the last 7 days."* → `report_daily`
- *"Archive ad group ag_xxxx."* → `ad_group_delete`

## Development

```bash
npm run dev        # run from source with tsx (no build step)
npm run typecheck  # type-check only
npm run build      # compile to dist/
npm run get-token  # interactive OAuth helper to mint a refresh token
```

Project layout:

```
src/index.ts             stdio entry point
src/server.ts            MCP server + tool-group registration
src/client.ts            Reddit HTTP client + OAuth (token cache/refresh)
src/shared.ts            run() error wrapper, compact() body helper
src/constants.ts         report fields, breakdowns, enums
src/tools/structure.ts   read tools
src/tools/management.ts  write tools
src/tools/reports.ts     reporting tools
scripts/get-token.ts     auth-code → refresh-token helper
docs/                    API reference notes
```

> **Note:** stdout is reserved for the MCP protocol — all logging goes to stderr.

## Notes

- **Auth flow may need confirmation.** The live v3 docs say the Ads API is open to all developers and
  no longer requires allowlisting, but Ads app creation has moved toward the Reddit Ads business
  developer flow. Verify redirect URIs and current scope names against the live portal; capture
  findings in [`docs/api-notes.md`](docs/api-notes.md).
- **No hard deletes.** Campaigns, ad groups, and ads are archived, not deleted (see Management above).
- **Writes are JSON:API style.** Request bodies are `{ "data": { …attributes } }`; updates use `PATCH`.

## Credits

Sibling project to [`appfigures-mcp`](https://github.com/desunit/appfigures-mcp). Inspired by the
read-only Python [`sbmeaper/reddit-ad-mcp`](https://github.com/sbmeaper/reddit-ad-mcp).

## Author

Built by **[Songtive](https://songtive.com)** — [@desunit](https://x.com/desunit) on X.

## License

[MIT](LICENSE) © Songtive
