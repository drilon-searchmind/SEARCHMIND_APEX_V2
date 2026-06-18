/**
 * Parent property — child properties table column definitions.
 */

/** @typedef {{ id: string, label: string, group?: string, defaultVisible?: boolean }} ParentChildColumnDef */

/** Core metrics that should be on by default (excludes per-channel ad spend). */
export const PARENT_CHILD_CORE_DEFAULT_METRIC_IDS = [
    "revenue",
    "total_adspend",
    "blended",
    "net_profit",
];

export const PARENT_CHILD_TABLE_COLUMNS_STORAGE_PREFIX =
    "searchmind.parentProperty.childTableColumns.v2.";

/** @deprecated v1 key — migrated on read */
export const PARENT_CHILD_TABLE_COLUMNS_STORAGE_PREFIX_V1 =
    "searchmind.parentProperty.childTableColumns.";

/** @type {ParentChildColumnDef[]} */
export const PARENT_CHILD_METRIC_COLUMNS = [
    { id: "revenue", label: "Revenue", group: "Performance", defaultVisible: true },
    { id: "orders", label: "Orders", group: "Performance", defaultVisible: false },
    { id: "total_adspend", label: "Total Adspend", group: "Marketing", defaultVisible: true },
    { id: "blended", label: "Blended ROAS", group: "Marketing", defaultVisible: true },
    { id: "aov", label: "AOV", group: "Performance", defaultVisible: false },
    { id: "net_profit", label: "Net Profit", group: "Profitability", defaultVisible: true },
    { id: "poas", label: "POAS", group: "Profitability", defaultVisible: false },
    { id: "cac", label: "CAC", group: "Marketing", defaultVisible: false },
    { id: "gross_sales", label: "Gross Sales", group: "Revenue breakdown", defaultVisible: false },
    { id: "returns", label: "Returns", group: "Revenue breakdown", defaultVisible: false },
    { id: "discounts", label: "Discounts", group: "Revenue breakdown", defaultVisible: false },
];

/**
 * @param {Array<{ id: string, label?: string }>} visibleAdSpendChannels
 * @returns {ParentChildColumnDef[]}
 */
export function parentChildChannelColumnDefs(visibleAdSpendChannels = []) {
    return (visibleAdSpendChannels || []).map((ch) => {
        let label = `${ch.label} Adspend`;
        if (ch.id === "facebook") label = "Meta Adspend";
        if (ch.id === "google") label = "Google Adspend";
        return {
            id: `channel_${ch.id}`,
            label,
            group: "Ad spend by channel",
            defaultVisible: true,
        };
    });
}

/**
 * @param {Array<{ id: string, label?: string }>} visibleAdSpendChannels
 * @returns {ParentChildColumnDef[]}
 */
export function parentChildAllToggleableColumns(visibleAdSpendChannels = []) {
    return [...PARENT_CHILD_METRIC_COLUMNS, ...parentChildChannelColumnDefs(visibleAdSpendChannels)];
}

/**
 * @param {string} parentCustomerId
 */
export function parentChildTableColumnsStorageKey(parentCustomerId) {
    return `${PARENT_CHILD_TABLE_COLUMNS_STORAGE_PREFIX}${String(parentCustomerId || "default")}`;
}

export function parentChildTableColumnsLegacyStorageKey(parentCustomerId) {
    return `${PARENT_CHILD_TABLE_COLUMNS_STORAGE_PREFIX_V1}${String(parentCustomerId || "default")}`;
}

/**
 * Default visible column ids for the child properties table.
 * @param {ParentChildColumnDef[]} allColumns
 */
export function defaultParentChildVisibleColumnIds(allColumns = []) {
    return allColumns.filter((c) => c.defaultVisible !== false).map((c) => c.id);
}

/** @param {string[]} ids */
function isCorruptedLegacyColumnSelection(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return true;
    // Early bug: only revenue + orders saved before other defaults existed
    if (ids.length <= 2 && ids.every((id) => id === "revenue" || id === "orders")) {
        return true;
    }
    return false;
}

/**
 * Resolve which columns to show. Merges in registered ad channel columns when they
 * were not yet known at save time. Resets corrupted legacy saves to full defaults.
 * @param {string[]} storedIds — raw ids from localStorage (user picker selection)
 * @param {ParentChildColumnDef[]} allColumns
 */
export function resolveParentChildVisibleColumnIds(storedIds, allColumns) {
    const defaultIds = defaultParentChildVisibleColumnIds(allColumns);

    if (isCorruptedLegacyColumnSelection(storedIds)) {
        return defaultIds;
    }

    const valid = new Set(allColumns.map((c) => c.id));
    const filtered = storedIds.filter((id) => valid.has(id));

    if (filtered.length === 0) {
        return defaultIds;
    }

    // Registered ad channels: on by default when channels load after an earlier save
    const defaultChannelIds = defaultIds.filter((id) => id.startsWith("channel_"));
    const merged = [...filtered];
    for (const id of defaultChannelIds) {
        if (!merged.includes(id)) merged.push(id);
    }

    return merged;
}

/**
 * @param {string[]} visibleIds
 * @param {ParentChildColumnDef[]} allColumns
 */
export function buildOrderedVisibleColumns(visibleIds, allColumns) {
    const visibleSet = new Set(visibleIds);
    return allColumns.filter((c) => visibleSet.has(c.id));
}
