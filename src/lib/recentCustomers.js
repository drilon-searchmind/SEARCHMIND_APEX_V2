const STORAGE_KEY = "apex-recent-customer-ids";
export const RECENT_CUSTOMER_LIMIT = 5;

export function readRecentCustomerIds() {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(String).filter(Boolean).slice(0, RECENT_CUSTOMER_LIMIT);
    } catch {
        return [];
    }
}

export function addRecentCustomerId(customerId) {
    if (typeof window === "undefined") return [];
    const id = String(customerId ?? "").trim();
    if (!id) return readRecentCustomerIds();

    const prev = readRecentCustomerIds().filter((entry) => entry !== id);
    const next = [id, ...prev].slice(0, RECENT_CUSTOMER_LIMIT);

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        // Ignore quota / private mode errors.
    }

    return next;
}
