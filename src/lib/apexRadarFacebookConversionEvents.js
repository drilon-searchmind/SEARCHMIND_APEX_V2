/**
 * Apex Radar Meta PS — configurable conversion action types per customer.
 * Default: first non-zero purchase action (legacy behaviour).
 * Custom: sum of user-selected action types from Meta `actions`.
 */

export const DEFAULT_FB_PURCHASE_ACTION_TYPES = [
    "purchase",
    "omni_purchase",
    "offsite_conversion.fb_pixel_purchase",
];

const ACTION_TYPE_LABELS = {
    purchase: "Purchase",
    omni_purchase: "Omni purchase",
    "offsite_conversion.fb_pixel_purchase": "Pixel purchase",
    lead: "Lead",
    "offsite_conversion.fb_pixel_lead": "Pixel lead",
    complete_registration: "Complete registration",
    "offsite_conversion.fb_pixel_complete_registration": "Pixel complete registration",
    submit_application: "Submit application",
    "offsite_conversion.fb_pixel_submit_application": "Pixel submit application",
    contact: "Contact",
    "offsite_conversion.fb_pixel_contact": "Pixel contact",
    schedule: "Schedule",
    "offsite_conversion.fb_pixel_schedule": "Pixel schedule",
    subscribe: "Subscribe",
    "offsite_conversion.fb_pixel_subscribe": "Pixel subscribe",
    add_to_cart: "Add to cart",
    "offsite_conversion.fb_pixel_add_to_cart": "Pixel add to cart",
    initiate_checkout: "Initiate checkout",
    "offsite_conversion.fb_pixel_initiate_checkout": "Pixel initiate checkout",
    add_payment_info: "Add payment info",
    "offsite_conversion.fb_pixel_add_payment_info": "Pixel add payment info",
    view_content: "View content",
    "offsite_conversion.fb_pixel_view_content": "Pixel view content",
    "offsite_conversion.fb_pixel_custom": "Pixel custom",
};

/** Ad-account insight action types that are engagement/metrics noise, not conversion pickers. */
const ACCOUNT_ACTION_EXCLUDE = new Set([
    "page_engagement",
    "post_engagement",
    "video_view",
    "link_click",
    "landing_page_view",
    "omni_landing_page_view",
    "post_interaction_gross",
    "post_reaction",
    "comment",
    "like",
    "photo_view",
    "post",
    "rsvp",
    "checkin",
]);

/** When a fb_pixel variant exists, hide duplicate omni/onsite/generic action types in the picker. */
const ACCOUNT_ACTION_DEDUPE_GROUPS = [
    [
        "offsite_conversion.fb_pixel_view_content",
        "view_content",
        "omni_view_content",
        "onsite_web_view_content",
        "onsite_web_app_view_content",
    ],
    ["offsite_conversion.fb_pixel_add_to_cart", "add_to_cart", "omni_add_to_cart"],
    ["offsite_conversion.fb_pixel_purchase", "purchase", "omni_purchase"],
    ["offsite_conversion.fb_pixel_lead", "lead"],
    ["offsite_conversion.fb_pixel_contact", "contact"],
    ["offsite_conversion.fb_pixel_subscribe", "subscribe"],
    ["offsite_conversion.fb_pixel_complete_registration", "complete_registration"],
    ["offsite_conversion.fb_pixel_initiate_checkout", "initiate_checkout"],
    ["offsite_conversion.fb_pixel_add_payment_info", "add_payment_info"],
];

/** @param {string} actionType */
export function isConversionRelevantAccountActionType(actionType) {
    const t = String(actionType || "").trim();
    if (!t || ACCOUNT_ACTION_EXCLUDE.has(t)) return false;
    if (t.startsWith("offsite_content_view_")) return false;
    if (t.startsWith("offsite_conversion.")) return true;
    if (t.startsWith("onsite_conversion.")) return true;
    if (t.startsWith("onsite_web")) return false;
    if (ACTION_TYPE_LABELS[t]) return true;
    if (t.startsWith("omni_") && t !== "omni_landing_page_view") return true;
    return false;
}

/**
 * @param {Array<{ actionType: string, count: number, label: string }>} events
 */
export function filterConversionRelevantAccountEvents(events) {
    return (events || [])
        .filter((e) => isConversionRelevantAccountActionType(e.actionType))
        .map((e) => ({ ...e, source: "ad_account" }));
}

/**
 * Prefer fb_pixel insight action types over duplicate omni/onsite rows with the same meaning.
 * @param {Array<{ actionType: string, count: number, label: string }>} events
 */
export function dedupeAccountActionEvents(events) {
    const byType = new Map((events || []).map((e) => [e.actionType, e]));
    const toDrop = new Set();

    for (const group of ACCOUNT_ACTION_DEDUPE_GROUPS) {
        const winner = group.find((t) => {
            const row = byType.get(t);
            return row && row.count > 0;
        });
        if (!winner) continue;
        for (const t of group) {
            if (t !== winner) toDrop.add(t);
        }
    }

    return (events || []).filter((e) => !toDrop.has(e.actionType));
}

/**
 * @param {Array<{ actions?: object[] }>} dailyRows
 * @returns {Array<{ actionType: string, count: number, label: string, source?: string }>}
 */
export function aggregateConversionRelevantAccountEvents(dailyRows) {
    const aggregated = aggregateActionTypesFromDailyRows(dailyRows);
    const filtered = filterConversionRelevantAccountEvents(aggregated);
    return dedupeAccountActionEvents(filtered);
}

export function getActionValue(actions, actionType) {
    if (!actions) return 0;
    const action = actions.find((a) => a.action_type === actionType);
    return parseFloat(action?.value || 0);
}

/** First non-zero among default Meta purchase action types. */
export function purchaseConversionsFromActions(actions) {
    if (!actions) return 0;
    for (const t of DEFAULT_FB_PURCHASE_ACTION_TYPES) {
        const v = getActionValue(actions, t);
        if (v > 0) return v;
    }
    return 0;
}

/**
 * @param {unknown} raw — from Mongo / API
 * @returns {string[]|null} null = use default purchase logic
 */
export function normalizeTrackingConversionActionTypes(raw) {
    if (raw == null) return null;
    if (!Array.isArray(raw)) return null;
    const filtered = [...new Set(raw.map((s) => String(s).trim()).filter(Boolean))];
    return filtered.length ? filtered : null;
}

/**
 * @param {object[]|null|undefined} actions — Meta insight actions
 * @param {string[]|null} actionTypes — custom types; null = default purchase logic
 */
export function conversionsFromActions(actions, actionTypes = null) {
    const normalized = normalizeTrackingConversionActionTypes(actionTypes);
    if (!normalized) {
        return purchaseConversionsFromActions(actions);
    }
    let sum = 0;
    for (const t of normalized) {
        sum += getActionValue(actions, t);
    }
    return sum;
}

export function formatActionTypeLabel(actionType) {
    const key = String(actionType || "").trim();
    if (!key) return "Unknown";
    if (ACTION_TYPE_LABELS[key]) return ACTION_TYPE_LABELS[key];
    if (key.includes(".") || key.includes("_")) {
        return key
            .replace(/^offsite_conversion\./, "")
            .replace(/^onsite_conversion\./, "")
            .replace(/_/g, " ")
            .replace(/\./g, " · ");
    }
    return key.replace(/([a-z])([A-Z])/g, "$1 $2");
}

/** Short phrase for alert copy. */
export function getTrackingConversionLabel(actionTypes) {
    const normalized = normalizeTrackingConversionActionTypes(actionTypes);
    if (!normalized) return "conversions (purchases)";
    if (normalized.length === 1) {
        return formatActionTypeLabel(normalized[0]);
    }
    return `${normalized.length} selected events`;
}

/**
 * @param {Array<{ actions?: object[] }>} dailyRows
 * @returns {Array<{ actionType: string, count: number, label: string }>}
 */
export function aggregateActionTypesFromDailyRows(dailyRows) {
    const counts = new Map();
    for (const row of dailyRows || []) {
        for (const a of row.actions || []) {
            const v = parseFloat(a.value || 0);
            if (!Number.isFinite(v) || v <= 0) continue;
            const t = a.action_type;
            if (!t) continue;
            counts.set(t, (counts.get(t) || 0) + v);
        }
    }
    return [...counts.entries()]
        .map(([actionType, count]) => ({
            actionType,
            count: Math.round(count * 1000) / 1000,
            label: formatActionTypeLabel(actionType),
        }))
        .sort((a, b) => b.count - a.count || a.actionType.localeCompare(b.actionType));
}

/**
 * Merge pixel API events with saved selection (saved items stay visible at 0 volume).
 * @param {Array<{ actionType: string, count: number, label: string }>} activeEvents
 * @param {string[]|null} savedActionTypes
 */
export function mergeConversionEventOptions(activeEvents, savedActionTypes) {
    const byType = new Map((activeEvents || []).map((e) => [e.actionType, e]));
    for (const t of normalizeTrackingConversionActionTypes(savedActionTypes) || []) {
        if (!byType.has(t)) {
            byType.set(t, { actionType: t, count: 0, label: formatActionTypeLabel(t), savedOnly: true });
        }
    }
    return [...byType.values()].sort(
        (a, b) => b.count - a.count || a.actionType.localeCompare(b.actionType)
    );
}
