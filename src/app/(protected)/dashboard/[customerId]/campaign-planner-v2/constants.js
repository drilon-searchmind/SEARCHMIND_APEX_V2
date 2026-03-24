export const PLANNER_V2_SERVICES = [
  "Paid Social",
  "Paid Search",
  "Email Marketing",
  "SEO",
];

/** Default media options per service (line items pick one) */
export const SERVICE_MEDIA_OPTIONS = {
  "Paid Social": ["META", "LinkedIn", "Pinterest", "TikTok", "YouTube"],
  "Paid Search": ["Google"],
  "Email Marketing": ["Email"],
  SEO: ["Website"],
};

export const CAMPAIGN_TYPE_FORMATS = [
  "Video",
  "Picture",
  "Carousel",
  "Display Ad",
  "Search Ad",
  "Newsletter",
  "Email Flow",
  "Landingpage",
  "Collection",
];

export const LINE_ITEM_STATUSES = [
  "Pending",
  "Pending Customer Approval",
  "Approved",
  "Live",
  "Ended",
];

export const SERVICE_COLORS = {
  "Paid Social": "#dbeafe",
  "Paid Search": "#dcfce7",
  "Email Marketing": "#e9d5ff",
  SEO: "#fed7aa",
};

/** ISO 4217 — used for parent total budget & service allocation display */
export const PLANNER_V2_BUDGET_CURRENCIES = [
  "DKK",
  "EUR",
  "USD",
  "GBP",
  "SEK",
  "NOK",
];

export const PLANNER_V2_DEFAULT_CURRENCY = "DKK";
