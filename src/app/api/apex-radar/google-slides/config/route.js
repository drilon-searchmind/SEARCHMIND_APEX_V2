import { NextResponse } from "next/server";
import { getSlidesServiceAccountStatus } from "@/lib/googleSlidesServiceAccount";

/**
 * GET — whether server-side Google Slides append is configured (service account JSON).
 * Uses GOOGLE_SLIDES_SERVICE_ACCOUNT_JSON or falls back to GOOGLE_ADS_SERVICE_ACCOUNT_CREDENTIALS.
 */
export async function GET() {
    const { enabled, shareWithEmail } = getSlidesServiceAccountStatus();
    return NextResponse.json({ enabled, shareWithEmail });
}
