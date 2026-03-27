import { isMicrosoftAdvertisingConfigured } from "@/lib/microsoftAdvertisingApi";

/**
 * GET /api/microsoft-advertising/status
 * Returns whether server-side Microsoft Advertising env vars are set (no secrets exposed).
 */
export async function GET() {
    const configured = isMicrosoftAdvertisingConfigured();
    return Response.json({
        configured,
        requiredEnv: [
            "MICROSOFT_ADVERTISING_DEVELOPER_TOKEN",
            "MICROSOFT_ADVERTISING_CLIENT_ID",
            "MICROSOFT_ADVERTISING_CLIENT_SECRET",
            "MICROSOFT_ADVERTISING_REFRESH_TOKEN",
        ],
        optionalEnv: ["MICROSOFT_ADVERTISING_TENANT_ID (defaults to common)"],
    });
}
