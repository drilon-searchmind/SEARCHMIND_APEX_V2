import { GoogleAuth } from "google-auth-library";

const ANALYTICS_DATA_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

function getServiceAccountCredentials() {
    const raw = process.env.GOOGLE_ADS_SERVICE_ACCOUNT_CREDENTIALS;
    if (!raw) throw new Error("Missing GOOGLE_ADS_SERVICE_ACCOUNT_CREDENTIALS env var");
    try {
        return JSON.parse(raw);
    } catch (e) {
        throw new Error("Invalid GOOGLE_ADS_SERVICE_ACCOUNT_CREDENTIALS JSON");
    }
}

export async function runGa4Report({
    propertyId,
    startDate = "2024-01-01",
    endDate = "today",
    metrics = ["sessions", "totalUsers", "screenPageViews"],
    dimensions = ["date"],
    limit = 10,
} = {}) {
    if (!propertyId) throw new Error("propertyId is required");

    const credentials = getServiceAccountCredentials();
    const auth = new GoogleAuth({ credentials, scopes: [ANALYTICS_DATA_SCOPE] });
    const client = await auth.getClient();
    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;

    const body = {
        dateRanges: [{ startDate, endDate }],
        metrics: metrics.map((name) => ({ name })),
        dimensions: dimensions.map((name) => ({ name })),
        limit,
    };

    const res = await client.request({ url, method: "POST", data: body });
    return res.data;
}
