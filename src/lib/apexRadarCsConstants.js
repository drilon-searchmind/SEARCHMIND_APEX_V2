export const APEX_RADAR_CS_PLATFORMS = ["google-ads", "meta", "seo", "email"];

export const APEX_RADAR_CS_PERIODS = ["dod", "wow"];

export const APEX_RADAR_CS_PLATFORM_LABELS = {
    "google-ads": "Google Ads",
    meta: "Meta",
    seo: "SEO",
    email: "Email",
};

export const APEX_RADAR_CS_KPI_LABELS = {
    conversions: "Conversions",
    spend: "Spend",
    revenue: "Revenue",
    merchant_approved: "Approved Merchant products",
    clicks: "Clicks",
    impressions: "Impressions",
    flow_mails: "Flow emails sent",
};

export const APEX_RADAR_CS_PERIOD_LABELS = {
    dod: "DoD",
    wow: "WoW",
};

/** KPIs allowed per platform (defaults + custom alerts). */
export const APEX_RADAR_CS_PLATFORM_KPIS = {
    "google-ads": ["conversions", "spend", "revenue", "merchant_approved"],
    meta: ["conversions", "spend", "revenue"],
    seo: ["clicks", "impressions"],
    email: ["flow_mails", "revenue", "conversions"],
};

/**
 * Seeded defaults — never deleted. `ruleId` is stable for per-customer overrides.
 * dropPct is the minimum drop (e.g. 90 = alert when pctChange <= -90).
 */
export const APEX_RADAR_CS_DEFAULT_RULES = [
    { ruleId: "google-ads:conversions", platform: "google-ads", kpi: "conversions", period: "dod", dropPct: 90 },
    { ruleId: "google-ads:spend", platform: "google-ads", kpi: "spend", period: "dod", dropPct: 70 },
    { ruleId: "google-ads:revenue", platform: "google-ads", kpi: "revenue", period: "dod", dropPct: 90 },
    { ruleId: "google-ads:merchant_approved", platform: "google-ads", kpi: "merchant_approved", period: "dod", dropPct: 40 },
    { ruleId: "meta:conversions", platform: "meta", kpi: "conversions", period: "dod", dropPct: 90 },
    { ruleId: "meta:spend", platform: "meta", kpi: "spend", period: "dod", dropPct: 70 },
    { ruleId: "meta:revenue", platform: "meta", kpi: "revenue", period: "dod", dropPct: 90 },
    { ruleId: "seo:clicks", platform: "seo", kpi: "clicks", period: "wow", dropPct: 70 },
    { ruleId: "seo:impressions", platform: "seo", kpi: "impressions", period: "wow", dropPct: 70 },
    { ruleId: "email:flow_mails", platform: "email", kpi: "flow_mails", period: "wow", dropPct: 70 },
    { ruleId: "email:revenue", platform: "email", kpi: "revenue", period: "dod", dropPct: 90 },
    { ruleId: "email:conversions", platform: "email", kpi: "conversions", period: "dod", dropPct: 90 },
];

export const APEX_RADAR_CS_DEFAULT_RULE_IDS = new Set(
    APEX_RADAR_CS_DEFAULT_RULES.map((r) => r.ruleId)
);

export function isValidCsPlatform(platform) {
    return APEX_RADAR_CS_PLATFORMS.includes(String(platform || ""));
}

export function isValidCsPeriod(period) {
    return APEX_RADAR_CS_PERIODS.includes(String(period || ""));
}

export function isValidCsKpiForPlatform(platform, kpi) {
    const list = APEX_RADAR_CS_PLATFORM_KPIS[platform];
    return Array.isArray(list) && list.includes(String(kpi || ""));
}

export function isApexRadarCsCustomerId(value) {
    return /^[a-fA-F0-9]{24}$/.test(String(value || "").trim());
}

/** Matches dashboard sidebar `CONFIG_WARNING_TITLE`. */
export const APEX_RADAR_CS_CONFIG_WARNING_TITLE =
    "Integration not configured for this customer (check Config or set a valid ID — not empty, 0, or 1)";

/** Maps CS platforms to `getServiceDashboardConfigWarnings` keys. */
export const APEX_RADAR_CS_PLATFORM_WARNING_KEYS = {
    "google-ads": "ppc",
    meta: "ps",
    seo: "seo",
    email: "em",
};

/** Skip reasons that mean this customer is missing the service (not an env/API issue). */
export const APEX_RADAR_CS_CUSTOMER_MISSING_SKIP_REASONS = new Set([
    "no_google_ads_customer_id",
    "no_facebook_ad_account",
    "no_search_console_property",
    "no_klaviyo_key",
    "not_configured",
]);

export function isCsCustomerMissingService(platform) {
    if (!platform || platform.configured) return false;
    return APEX_RADAR_CS_CUSTOMER_MISSING_SKIP_REASONS.has(platform.skipReason);
}

export function clampCsDropPct(value, fallback = 70) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(100, Math.max(1, Math.round(n)));
}
