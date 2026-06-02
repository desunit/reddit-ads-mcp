/** Common report fields from the Reddit Ads API v3 OpenAPI schema. */
export const REPORT_FIELDS = [
  "IMPRESSIONS",
  "REACH",
  "CLICKS",
  "SPEND",
  "CTR",
  "CPC",
  "ECPM",
  "FREQUENCY",
  "VIDEO_STARTED",
  "VIDEO_VIEWABLE_IMPRESSIONS",
  "VIDEO_WATCHED_25_PERCENT",
  "VIDEO_WATCHED_50_PERCENT",
  "VIDEO_WATCHED_75_PERCENT",
  "VIDEO_WATCHED_100_PERCENT",
  "CONVERSION_PURCHASE_CLICKS",
  "CONVERSION_ADD_TO_CART_CLICKS",
  "CONVERSION_LEAD_CLICKS",
  "CONVERSION_SIGN_UP_CLICKS",
  "CONVERSION_PAGE_VISIT_CLICKS",
] as const;

/** Dimensions a report can be broken down by. */
export const BREAKDOWNS = [
  "AD_ACCOUNT_ID",
  "AD_GROUP_ID",
  "AD_ID",
  "CAMPAIGN_ID",
  "COUNTRY",
  "DATE",
  "HOUR",
  "DMA",
  "METRO",
  "CAROUSEL_CARD",
  "GALLERY_ITEM_ID",
  "GENDER",
  "INTEREST",
  "KEYWORD",
  "PLACEMENT",
  "OS_TYPE",
  "ASSET_ID",
  "REGION",
  "COMMUNITY",
] as const;

/** Hierarchy levels a report can be aggregated at. */
export const LEVELS = ["ACCOUNT", "CAMPAIGN", "AD_GROUP", "AD"] as const;

/** Lifecycle status values shared by campaigns, ad groups, and ads. */
export const STATUSES = ["ACTIVE", "PAUSED", "ARCHIVED", "DELETED"] as const;

/** Context-friendly default report field set when the caller doesn't specify any. */
export const DEFAULT_REPORT_FIELDS = ["IMPRESSIONS", "CLICKS", "SPEND", "CTR", "CPC"];

/** Default look-back window (days) for convenience report tools. */
export const DEFAULT_RANGE_DAYS = 7;
