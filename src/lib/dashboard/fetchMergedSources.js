const baseUrl = () => process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

function readResolved(resolvedCache, key) {
    if (resolvedCache?.has(key)) {
        return resolvedCache.get(key);
    }
    return undefined;
}

function storeResolved(resolvedCache, key, value) {
    resolvedCache?.set(key, value);
}

/** Cache key ignores `source` — merged payload is identical per date range + filter suffix. */
export function buildMergedSourcesCacheKey(
    customerId,
    startDate,
    endDate,
    suffix = ""
) {
    return `merged|${customerId}|${startDate}|${endDate}|${suffix}`;
}

export async function fetchMergedSourcesJson({
    customerId,
    source,
    startDate,
    endDate,
    suffix = "",
    cache,
    resolvedCache,
    signal,
}) {
    const key = buildMergedSourcesCacheKey(
        customerId,
        startDate,
        endDate,
        suffix
    );

    const resolved = readResolved(resolvedCache, key);
    if (resolved !== undefined) {
        return resolved;
    }

    if (cache?.has(key)) {
        return cache.get(key).then((data) => {
            storeResolved(resolvedCache, key, data);
            return data;
        });
    }

    const sourceParam = source || "hub";
    const url = `${baseUrl()}/api/merged-sources/${customerId}?startDate=${startDate}&endDate=${endDate}&source=${sourceParam}${suffix}`;
    const promise = fetch(url, { signal })
        .then(async (res) => {
            if (!res.ok) {
                throw new Error(`Failed to fetch merged-sources (${sourceParam})`);
            }
            return res.json();
        })
        .then((data) => {
            storeResolved(resolvedCache, key, data);
            return data;
        })
        .catch((err) => {
            cache?.delete(key);
            resolvedCache?.delete(key);
            throw err;
        });

    cache?.set(key, promise);
    return promise;
}

export async function fetchCustomKpisJson({
    customerId,
    cache,
    resolvedCache,
    context = "ecommerce",
}) {
    const key = `custom-kpis|${customerId}|${context}`;

    const resolved = readResolved(resolvedCache, key);
    if (resolved !== undefined) {
        return resolved;
    }

    if (cache?.has(key)) {
        return cache.get(key).then((data) => {
            storeResolved(resolvedCache, key, data);
            return data;
        });
    }

    const qs = context === "b2b" ? "?context=b2b" : "";
    const promise = fetch(`${baseUrl()}/api/custom-kpis/${customerId}${qs}`)
        .then(async (res) => {
            if (!res.ok) return [];
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        })
        .then((data) => {
            storeResolved(resolvedCache, key, data);
            return data;
        })
        .catch(() => {
            storeResolved(resolvedCache, key, []);
            return [];
        });

    cache?.set(key, promise);
    return promise;
}

export function buildMarketsOverviewCacheKey(
    customerId,
    startDate,
    endDate,
    suffix = ""
) {
    return `markets-overview|${customerId}|${startDate}|${endDate}|${suffix}`;
}

export async function fetchMarketsOverviewJson({
    customerId,
    startDate,
    endDate,
    suffix = "",
    cache,
    resolvedCache,
    signal,
}) {
    const key = buildMarketsOverviewCacheKey(customerId, startDate, endDate, suffix);

    const resolved = readResolved(resolvedCache, key);
    if (resolved !== undefined) {
        return resolved;
    }

    if (cache?.has(key)) {
        return cache.get(key).then((data) => {
            storeResolved(resolvedCache, key, data);
            return data;
        });
    }

    const url = `${baseUrl()}/api/markets-overview/${customerId}?startDate=${startDate}&endDate=${endDate}${suffix}`;
    const promise = fetch(url, { credentials: "same-origin", signal })
        .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(body.error || "Failed to fetch markets overview");
            }
            return body;
        })
        .then((data) => {
            storeResolved(resolvedCache, key, data);
            return data;
        })
        .catch((err) => {
            cache?.delete(key);
            resolvedCache?.delete(key);
            throw err;
        });

    cache?.set(key, promise);
    return promise;
}
