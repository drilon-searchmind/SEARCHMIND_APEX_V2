const MAX_CHAIN_DEPTH = 80;
const CONTINUATION_TIMEOUT_MS = 20_000;

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
 * Trigger the next batch in a NEW serverless invocation (separate HTTP request — no 508 loop).
 * Awaited so the dispatch completes before this function exits.
 * @param {"prepare"|"deliver"} phase
 * @param {{ manual?: boolean, chainDepth?: number }} [options]
 */
export async function dispatchOutboxContinuation(phase, options = {}) {
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

    try {
        const res = await fetch(url, {
            method: "GET",
            headers: { Authorization: `Bearer ${secret}` },
            signal: AbortSignal.timeout(CONTINUATION_TIMEOUT_MS),
        });

        const body = await res.text().catch(() => "");

        if (!res.ok) {
            console.error("[performance-brief/outbox] Continuation failed", {
                phase,
                status: res.status,
                chainDepth: chainDepth + 1,
                url: path,
                body: body.slice(0, 500),
            });
            return false;
        }

        let summary = {};
        try {
            summary = JSON.parse(body);
        } catch {
            summary = { raw: body.slice(0, 200) };
        }

        console.info("[performance-brief/outbox] Continuation accepted", {
            phase,
            chainDepth: chainDepth + 1,
            url: path,
            status: res.status,
            prepared: summary?.stats?.prepared,
            sent: summary?.stats?.sent,
            remaining: summary?.stats?.remaining,
            skipped: summary?.skipped,
            reason: summary?.reason,
        });
        return true;
    } catch (err) {
        console.error("[performance-brief/outbox] Continuation error", {
            phase,
            chainDepth: chainDepth + 1,
            url: path,
            error: err?.message || String(err),
        });
        return false;
    }
}

export { MAX_CHAIN_DEPTH };
