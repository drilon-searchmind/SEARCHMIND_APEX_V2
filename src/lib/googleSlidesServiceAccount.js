/**
 * Service account JSON for Google Slides API.
 *
 * Uses the same credential shape as Google Ads / GA — either:
 * - GOOGLE_SLIDES_SERVICE_ACCOUNT_JSON (optional override), or
 * - GOOGLE_ADS_SERVICE_ACCOUNT_CREDENTIALS (reuse existing SA)
 *
 * In Google Cloud Console, enable "Google Slides API" on the project that owns this
 * service account. Share each target presentation with the service account email (Editor).
 */

function parseJsonEnv(raw) {
    if (!raw) return null;
    try {
        let text = raw.trim();
        if (
            (text.startsWith("'") && text.endsWith("'")) ||
            (text.startsWith('"') && text.endsWith('"'))
        ) {
            text = text.slice(1, -1);
        }
        return JSON.parse(text);
    } catch {
        return null;
    }
}

/**
 * @returns {object | null} Parsed service account `{ client_email, private_key, ... }`
 */
export function getServiceAccountCredentialsForSlides() {
    const explicit = parseJsonEnv(process.env.GOOGLE_SLIDES_SERVICE_ACCOUNT_JSON);
    if (explicit?.client_email && explicit?.private_key) return explicit;
    const fallback = parseJsonEnv(process.env.GOOGLE_ADS_SERVICE_ACCOUNT_CREDENTIALS);
    if (fallback?.client_email && fallback?.private_key) return fallback;
    return null;
}

/**
 * @returns {{ enabled: boolean, shareWithEmail: string | null }}
 */
export function getSlidesServiceAccountStatus() {
    const c = getServiceAccountCredentialsForSlides();
    return {
        enabled: !!c,
        shareWithEmail: c?.client_email ?? null,
    };
}
