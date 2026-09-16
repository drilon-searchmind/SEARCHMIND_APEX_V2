import { waitUntil } from "@vercel/functions";

const MAX_CHAIN_DEPTH = 80;

function getCronBaseUrl() {
    const configured = (
        process.env.APEX_RADAR_CRON_URL ||
        process.env.VERCEL_PROJECT_PRODUCTION_URL ||
        ""
    ).trim();
    if (configured) {
        return configured.replace(/\/$/, "");
    }
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    return "http://localhost:3000";
}

/**
 * Trigger the next batch in a NEW serverless invocation.
 * Returns immediately — does not wait for the child run to finish (child may take ~4 min).
 * @param {"prepare"|"deliver"} phase
 * @param {{ manual?: boolean, chainDepth?: number }} [options]
 */
export function dispatchOutboxContinuation(phase, options = {}) {
    const secret = (process.env.CRON_SECRET || "").trim();
    if (!secret) {
        console.warn("[performance-brief/outbox] CRON_SECRET missing — cannot chain next batch.");
        return false;
    }

    const chainDepth = Number(options.chainDepth || 0);
    if (chainDepth >= MAX_CHAIN_DEPTH) {
        console.warn("[performance-brief/outbox] Max chain depth reached.", { phase, chainDepth });
        return false;
    }

    const path = options.manual
        ? `/api/cron/performance-brief/${phase}/manual`
        : `/api/cron/performance-brief/${phase}`;

    const params = new URLSearchParams({
        continue: "1",
        chainDepth: String(chainDepth + 1),
    });

    const url = `${getCronBaseUrl()}${path}?${params.toString()}`;

    const followUp = fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${secret}` },
    })
        .then(async (res) => {
            if (!res.ok) {
                const body = await res.text().catch(() => "");
                console.error("[performance-brief/outbox] Continuation failed", {
                    phase,
                    status: res.status,
                    chainDepth: chainDepth + 1,
                    url: path,
                    body: body.slice(0, 500),
                });
                return;
            }
            console.info("[performance-brief/outbox] Continuation started", {
                phase,
                chainDepth: chainDepth + 1,
                url: path,
                status: res.status,
            });
        })
        .catch((err) => {
            console.error("[performance-brief/outbox] Continuation error", {
                phase,
                chainDepth: chainDepth + 1,
                url: path,
                error: err?.message || String(err),
            });
        });

    waitUntil(followUp);
    console.info("[performance-brief/outbox] Dispatched continuation", {
        phase,
        manual: Boolean(options.manual),
        chainDepth: chainDepth + 1,
        url: path,
    });
    return true;
}

export { MAX_CHAIN_DEPTH };
