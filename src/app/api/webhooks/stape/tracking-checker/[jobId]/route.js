import { NextResponse } from "next/server";
import { completeStapeTrackingCheckerWebhook } from "@/lib/stapeTrackingChecker";

const WEBHOOK_READY = {
    ok: true,
    endpoint: "stape-tracking-checker",
    message: "Webhook ready — Stape must POST JSON results here.",
};

/**
 * GET/HEAD — Stape or load balancers may probe callback URLs before accepting them.
 */
export async function GET() {
    return NextResponse.json(WEBHOOK_READY);
}

export async function HEAD() {
    return new NextResponse(null, { status: 200 });
}

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

        console.info("[stape webhook POST]", {
            jobId,
            hasToken: Boolean(token),
            contentType,
            keys:
                payload && typeof payload === "object" && !Array.isArray(payload)
                    ? Object.keys(payload)
                    : [],
        });

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
