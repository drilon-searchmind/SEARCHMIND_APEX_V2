/**
 * Server-side fetch for parent aggregated metrics (no session on underlying route).
 * @param {string} parentId
 * @param {Record<string, string | undefined>} query
 */
export async function fetchParentCustomerAggregated(parentId, query = {}) {
    const base = String(process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");
    const origin = base || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const url = new URL(`/api/parent-customers/${encodeURIComponent(parentId)}/aggregated`, origin);

    for (const [key, value] of Object.entries(query)) {
        if (value != null && String(value).trim() !== "" && key !== "stream") {
            url.searchParams.set(key, String(value));
        }
    }

    const res = await fetch(url.toString(), { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.error || "Failed to fetch parent aggregated metrics");
    }
    return data;
}
