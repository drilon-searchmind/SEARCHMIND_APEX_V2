import { createHash, timingSafeEqual } from "crypto";

/**
 * Static API key check for the CRM read endpoint.
 * Env: CRM_INDEKS_API_KEY — callers send header `x-api-key: <key>`.
 * Constant-time compare (both sides hashed to equal length first).
 */
export function verifyCrmIndeksApiKey(request) {
    const expected = (process.env.CRM_INDEKS_API_KEY || "").trim();
    if (!expected) {
        return { ok: false, status: 503, error: "CRM_INDEKS_API_KEY is not configured on this deployment." };
    }
    const provided = (request.headers.get("x-api-key") || "").trim();
    if (!provided) {
        return { ok: false, status: 401, error: "Missing x-api-key header." };
    }
    const a = createHash("sha256").update(provided).digest();
    const b = createHash("sha256").update(expected).digest();
    if (!timingSafeEqual(a, b)) {
        return { ok: false, status: 401, error: "Invalid API key." };
    }
    return { ok: true };
}
