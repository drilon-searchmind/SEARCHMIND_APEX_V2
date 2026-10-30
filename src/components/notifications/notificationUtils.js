/** Shared helpers for the topbar bell and the notifications page. */

/** Fired on `window` after every notification was marked read, so the bell badge and the page stay in sync. */
export const NOTIFICATIONS_READ_EVENT = "apex:notifications-read";

export function formatRelativeTime(iso, { withYear = false } = {}) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const m = Math.floor((Date.now() - d.getTime()) / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 48) return `${h}h ago`;
    return d.toLocaleDateString(undefined, withYear ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric" });
}

function startOfLocalDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function startOfLocalWeek(d) {
    const x = startOfLocalDay(d);
    x.setDate(x.getDate() - x.getDay());
    return x;
}

export function groupNotifications(items) {
    const now = new Date();
    const sod = startOfLocalDay(now);
    const sow = startOfLocalWeek(now);
    const groups = { today: [], thisWeek: [], older: [] };
    for (const n of items) {
        const d = new Date(n.createdAt);
        if (d >= sod) groups.today.push(n);
        else if (d >= sow) groups.thisWeek.push(n);
        else groups.older.push(n);
    }
    return groups;
}

export const CATEGORY_LABELS = {
    alert: "Alert",
    feature: "New feature",
    system: "System",
};

export function categoryOf(n) {
    return n?.category === "alert" || n?.category === "feature" ? n.category : "system";
}
