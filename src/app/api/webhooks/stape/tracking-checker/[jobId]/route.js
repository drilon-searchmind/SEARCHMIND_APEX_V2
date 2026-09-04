import { NextResponse } from "next/server";
import { completeStapeTrackingCheckerWebhook } from "@/lib/stapeTrackingChecker";

/**
 * POST /api/webhooks/stape/tracking-checker/[jobId]?token=
 * Public callback from Stape Partner Tracking Checker API.
 */
export async function POST(request, { params }) {
    try {
        const { jobId } = await params;
        const { searchParams } = new URL(request.url);
        const token = searchParams.get("token") || "";

        let payload = null;
        const contentType = request.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            payload = await request.json();
        } else {
            const text = await request.text();
            if (text) {
                try {
                    payload = JSON.parse(text);
                } catch {
                    payload = { raw: text };
                }
            }
        }

        const job = await completeStapeTrackingCheckerWebhook(jobId, token, payload);
        return NextResponse.json({ ok: true, job });
    } catch (e) {
        const message = e.message || "Webhook handling failed";
        const status =
            message === "Invalid webhook token"
                ? 401
                : message === "Job not found"
                  ? 404
                  : message === "Invalid jobId"
                    ? 400
                    : 500;
        if (status >= 500) {
            console.error("[stape webhook POST]", e);
        }
        return NextResponse.json({ error: message }, { status });
    }
}
