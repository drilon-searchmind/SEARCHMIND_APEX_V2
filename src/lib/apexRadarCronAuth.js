/**
 * Verify Vercel Cron or manual trigger requests.
 * Set CRON_SECRET in Vercel env; callers must send: Authorization: Bearer <CRON_SECRET>
 */
export function verifyApexRadarCronRequest(request) {
    const secret = (process.env.CRON_SECRET || "").trim();
    if (!secret) {
        return {
            ok: false,
            status: 503,
            error: "CRON_SECRET is not configured on this deployment.",
        };
    }

    const auth = request.headers.get("authorization") || "";
    if (auth === `Bearer ${secret}`) {
        return { ok: true };
    }

    return {
        ok: false,
        status: 401,
        error: "Unauthorized. Send Authorization: Bearer <CRON_SECRET>.",
    };
}

export function isApexRadarCronEnabled() {
    const flag = (process.env.APEX_RADAR_CRON_ENABLED || "true").trim().toLowerCase();
    return flag !== "false" && flag !== "0" && flag !== "off";
}
