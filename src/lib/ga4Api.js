import { GoogleAuth } from "google-auth-library";
import { formatGa4ApiError } from "@/lib/ga4ErrorUtils";

const ANALYTICS_DATA_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

function getServiceAccountCredentials() {
    const raw = process.env.GOOGLE_ADS_SERVICE_ACCOUNT_CREDENTIALS;
    if (!raw) throw new Error("Missing GOOGLE_ADS_SERVICE_ACCOUNT_CREDENTIALS env var");
    try {
        let text = raw.trim();
        // Handle .env wrapping the JSON in single or double quotes
        if ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"'))) {
            text = text.slice(1, -1);
        }
        return JSON.parse(text);
    } catch (e) {
        throw new Error("Invalid GOOGLE_ADS_SERVICE_ACCOUNT_CREDENTIALS JSON");
    }
}

export async function runGa4Report({
    propertyId,
    startDate = "30daysAgo",
    endDate = "today",
    metrics = ["totalUsers", "screenPageViews", "bounceRate", "averageSessionDuration"],
    dimensions = ["date"],
    dimensionFilter,
    orderBys,
    limit = 100000,
} = {}) {
    if (!propertyId) throw new Error("propertyId is required");

    const credentials = getServiceAccountCredentials();
    const auth = new GoogleAuth({ credentials, scopes: [ANALYTICS_DATA_SCOPE] });
    const client = await auth.getClient();
    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;

    const body = {
        dateRanges: [{ startDate, endDate }],
        metrics: metrics.map((name) => ({ name })),
        dimensions: (dimensions || []).map((name) => ({ name })),
        limit,
    };

    if (dimensionFilter) {
        body.dimensionFilter = dimensionFilter;
    }
    if (orderBys?.length) {
        body.orderBys = orderBys;
    }

    try {
        const res = await client.request({ url, method: "POST", data: body });
        return res.data;
    } catch (err) {
        const formatted = formatGa4ApiError(err);
        const error = new Error(formatted.message);
        error.status = formatted.status;
        error.code = formatted.code;
        throw error;
    }
}
