/**
 * Parse service account client_email from GOOGLE_ADS_SERVICE_ACCOUNT_CREDENTIALS.
 * @returns {string | null}
 */
export function getGa4ServiceAccountEmail() {
    const raw = process.env.GOOGLE_ADS_SERVICE_ACCOUNT_CREDENTIALS;
    if (!raw) return null;
    try {
        let text = raw.trim();
        if ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"'))) {
            text = text.slice(1, -1);
        }
        const parsed = JSON.parse(text);
        return typeof parsed.client_email === "string" ? parsed.client_email : null;
    } catch {
        return null;
    }
}

/**
 * Turn GA4 Data API / google-auth-library errors into a short user-facing message.
 * @param {unknown} err
 * @returns {{ message: string, status: number, code?: string }}
 */
export function formatGa4ApiError(err) {
    const status = Number(err?.response?.status || err?.status || err?.code) || 500;
    const data = err?.response?.data;

    let apiMessage = "";
    if (typeof data === "string") {
        apiMessage = data;
    } else if (data?.error?.message) {
        apiMessage = data.error.message;
    } else if (data?.message) {
        apiMessage = data.message;
    } else if (typeof err?.message === "string") {
        apiMessage = err.message;
    }

    const lower = apiMessage.toLowerCase();
    const serviceAccountEmail = getGa4ServiceAccountEmail();

    if (status === 403 || lower.includes("permission") || lower.includes("forbidden")) {
        const emailHint = serviceAccountEmail
            ? ` Add ${serviceAccountEmail} as Viewer on the GA4 property (Admin → Property access management).`
            : " Add the APEX Google service account as Viewer on the GA4 property (Admin → Property access management).";
        return {
            status: 403,
            code: "GA4_PERMISSION_DENIED",
            message: `GA4 access denied.${emailHint}`,
        };
    }

    if (status === 404 || lower.includes("not found")) {
        return {
            status: 404,
            code: "GA4_PROPERTY_NOT_FOUND",
            message: "GA4 property not found. Check that the Property ID in config is correct (numeric ID only, not Measurement ID G-XXXX).",
        };
    }

    if (lower.includes("missing google_ads_service_account_credentials")) {
        return {
            status: 500,
            code: "GA4_CREDENTIALS_MISSING",
            message: "GA4 is not configured on the server (missing service account credentials).",
        };
    }

    return {
        status: status >= 400 && status < 600 ? status : 500,
        message: apiMessage || "GA4 request failed",
    };
}
