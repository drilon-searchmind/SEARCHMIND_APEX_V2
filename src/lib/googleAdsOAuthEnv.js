/**
 * OAuth client credentials for Google Ads API (refresh_token grant).
 * Uses Searchmind SSO Google OAuth client; falls back to legacy GOOGLE_ADS_* env.
 */

export function getGoogleAdsOAuthClientId() {
    return String(
        process.env.SSO_GOOGLE_CLIENT_ID || process.env.GOOGLE_ADS_CLIENT_ID || ""
    ).trim();
}

export function getGoogleAdsOAuthClientSecret() {
    return String(
        process.env.SSO_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_ADS_CLIENT_SECRET || ""
    ).trim();
}

export function getGoogleAdsRefreshToken() {
    return String(process.env.GOOGLE_ADS_REFRESH_TOKEN || "").trim();
}

export function getGoogleAdsDeveloperToken() {
    return String(process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "").trim();
}

export function getGoogleAdsManagerCustomerId() {
    const raw = String(process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID || "").trim();
    return raw || undefined;
}

/** True when client id, secret, developer token, and refresh token are set. */
export function isGoogleAdsApiConfigured() {
    return Boolean(
        getGoogleAdsOAuthClientId() &&
            getGoogleAdsOAuthClientSecret() &&
            getGoogleAdsDeveloperToken() &&
            getGoogleAdsRefreshToken()
    );
}
