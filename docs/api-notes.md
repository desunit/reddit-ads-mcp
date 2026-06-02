# Reddit Ads API notes

Reference for the endpoints wrapped by this MCP server.
Full docs: https://ads-api.reddit.com/docs/v3/ · Postman: https://www.postman.com/reddit-ads-api/reddit-ads-api-v3/overview

- **Base URL:** `https://ads-api.reddit.com/api/v3`
- **Token URL:** `https://www.reddit.com/api/v1/access_token`

## Learned from live v3 docs (2026-06-02)

- The public docs expose OpenAPI at `https://ads-api.reddit.com/api/v3/openapi.json`.
- The docs state the Reddit Ads API is open to all developers and does not require allowlisting or
  approval to access. Write endpoints may still be limited by product permissions and ad account access.
- There is no `GET /ad_accounts` in the v3 OpenAPI. Ad accounts are listed through business endpoints:
  `GET /me/businesses`, then `GET /businesses/{business_id}/ad_accounts` or
  `POST /businesses/{business_id}/ad_accounts/query`.
- Campaign/ad group/ad list and create endpoints are ad-account scoped, but single get/update endpoints
  are top-level.
- Pagination changed from old cursor assumptions to `page.token` and `page.size`, with response links in
  `pagination.next_url` and `pagination.previous_url`.
- Reports require `data.fields`; the old lowercase `metrics`/`level` body shape is not in the v3 OpenAPI.
- Report timestamps must be hourly ISO timestamps like `2026-06-02T10:00:00Z`, not bare dates.
- Report fields and breakdowns are uppercase enum values (`IMPRESSIONS`, `SPEND`, `DATE`,
  `CAMPAIGN_ID`, etc.).

## Auth (OAuth2, refresh-token grant)

The Ads API rides on Reddit's standard OAuth2. Flow used by this server:

1. Create a Reddit Ads developer application, note the **client id** + **secret**, and configure the
   redirect URI used for token setup. The current docs describe this in the Ads business developer
   application flow; confirm the portal UX before relying on the legacy `prefs/apps` path.
2. Mint a **refresh token** once: `npm run get-token` (authorization-code flow, `duration=permanent`,
   scopes `adsread adsedit read`, or the current Ads portal equivalents if Reddit has migrated scope names).
3. At runtime the server exchanges the refresh token for short-lived access tokens via the token URL
   (HTTP Basic `client_id:client_secret`, `grant_type=refresh_token`), caching them with a ~60s safety
   margin (`src/client.ts`).

Env vars: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_REFRESH_TOKEN`, optional `REDDIT_USER_AGENT`.

## Resource model

List/create endpoints nest under an ad account: `/ad_accounts/{ad_account_id}/{campaigns|ad_groups|ads}`.
Single campaign, ad group, and ad reads/updates are top-level: `/campaigns/{campaign_id}`,
`/ad_groups/{ad_group_id}`, `/ads/{ad_id}`.

- **Pagination** uses `page.token` and `page.size` query parameters. Responses include
  `pagination.next_url` / `pagination.previous_url`; extract the token from the URL and pass it back
  as `page_token`.
- **Writes** use body `{ "data": { ...attributes } }` and `PATCH` for partial updates. The v3 OpenAPI
  spec does not expose `DELETE` for campaigns, ad groups, or ads; archive via `configured_status=ARCHIVED`.

## Endpoints used → tools

| Method & path | Tool(s) |
|---|---|
| `GET /me` | `whoami` |
| `GET /me/businesses` | `businesses_list` |
| `GET /businesses/{business_id}/ad_accounts` | `accounts_list` |
| `GET /ad_accounts/{id}` | `account_get` |
| `GET /ad_accounts/{id}/campaigns` · `GET …/campaigns/{cid}` | `campaigns_list`, `campaign_get` |
| `POST /ad_accounts/{id}/campaigns` · `GET/PATCH /campaigns/{cid}` | `campaign_create`, `campaign_get`, `campaign_update` |
| `GET …/ad_groups[/ {gid}]` | `ad_groups_list`, `ad_group_get` |
| `POST /ad_accounts/{id}/ad_groups` · `GET/PATCH /ad_groups/{gid}` | `ad_group_create`, `ad_group_get`, `ad_group_update` |
| `GET …/ads[/{aid}]` | `ads_list`, `ad_get` |
| `POST /ad_accounts/{id}/ads` · `GET/PATCH /ads/{aid}` | `ad_create`, `ad_get`, `ad_update` |
| `POST /ad_accounts/{id}/reports` | `report_run`, `report_daily` |

The `campaign_delete`, `ad_group_delete`, and `ad_delete` tools intentionally archive via `PATCH`
for compatibility with callers that use delete-style tool names.

## Reports

Reports are **query-only**: POST a spec, get metrics back synchronously (no stored report object).
Report body (`data`) requires `starts_at`, `ends_at`, and `fields`.

- `starts_at` / `ends_at`: hourly ISO timestamps, `YYYY-MM-DDTHH:00:00Z`.
- `fields`: uppercase report fields such as `IMPRESSIONS`, `CLICKS`, `SPEND`, `CTR`, `CPC`.
- `breakdowns`: uppercase dimensions such as `DATE`, `CAMPAIGN_ID`, `AD_GROUP_ID`, `AD_ID`,
  `COUNTRY`, `REGION`, `COMMUNITY`, `PLACEMENT`, `OS_TYPE`.
- Optional: `filter`, `custom_column_ids`, `conversion_metrics`, `time_zone_id`.

### Confirmed against a live account (2026-06-02)

Authenticated reads were run against a real account on this date. Confirmed behaviour:

- **Monetary fields are in currency micros.** `SPEND` and `CPC` come back as integers in account-currency
  micros — divide by 1,000,000 for the display value (e.g. `spend: 297276077` = $297.28; verified
  `spend / clicks == cpc`). `CTR` is a fraction (0.0057 = 0.57%).
- **A `COUNTRY` (or other non-ID) breakdown is account-wide** — it aggregates across every campaign in
  the account. To scope to one campaign, pass `filter="campaign:id==<campaign_id>"`. The `==` operator
  works; combine with a campaign-ID loop client-side to scope to a set.
- **Reports paginate.** Even a single `COUNTRY` breakdown returns ~50 rows per page; follow
  `pagination.next_url`, extract its `page.token` query param, and pass it back as `page_token` until
  `next_url` is null.
- Country rows can include `"UNKNOWN"` and an `AQ`/edge ISO with negligible spend; filter as needed.

## ⚠️ Verification status

This endpoint map was checked against the live v3 OpenAPI document at
`https://ads-api.reddit.com/api/v3/openapi.json` on 2026-06-02, and **read paths were exercised against a
live authenticated account on 2026-06-02** (`whoami`, `businesses_list`, `accounts_list`,
`campaigns_list`, `report_run` with `COUNTRY`/`CAMPAIGN_ID` breakdowns and a `campaign:id==` filter — all
returned as documented; see "Confirmed against a live account" above). Write paths (`*_create`,
`*_update`) were **not** exercised, so request fields can still need adjustment for account-specific products
or approval-gated write features. Corrections are localised: paths in `src/tools/*.ts`, common report
fields/breakdowns in `src/constants.ts`.
