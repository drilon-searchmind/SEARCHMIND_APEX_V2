export function isCobaltDaily(variant) {
    return variant === "cobalt";
}

export function dailyTableWrapClass(variant) {
    return isCobaltDaily(variant) ? "apex-daily-table-wrap" : "overflow-x-auto";
}

export function dailyTableClass(variant) {
    return isCobaltDaily(variant)
        ? "apex-daily-table"
        : "min-w-full text-xs text-left border-collapse";
}

export function dailyTableStyle(variant) {
    return isCobaltDaily(variant) ? undefined : { fontSize: "12px" };
}

export function dailyCellClass(variant, groupStart = false) {
    if (isCobaltDaily(variant)) {
        return `apex-daily-table__cell${groupStart ? " is-group-start" : ""}`;
    }
    return `px-3 py-2 whitespace-nowrap${groupStart ? " border-l border-gray-200" : ""}`;
}

export function dailyHeadCellClass(variant, groupStart = false) {
    if (isCobaltDaily(variant)) {
        return `apex-daily-table__head-cell${groupStart ? " is-group-start" : ""}`;
    }
    return `px-3 py-1.5 font-semibold text-gray-700${groupStart ? " border-l border-gray-300" : ""}`;
}

export function dailyRowClass(variant, type = "data", index = 0) {
    if (!isCobaltDaily(variant)) {
        const legacy = {
            data: index % 2 === 0 ? "bg-white" : "bg-gray-50",
            total: "bg-gray-100 font-semibold border-t border-b border-gray-200",
            lastPeriod: "bg-gray-50 font-semibold border-t border-b border-gray-200",
            index: "bg-slate-50/80 font-medium border-t border-b border-gray-200",
            difference: "bg-amber-50/50 font-medium border-t border-b border-gray-200",
        };
        return legacy[type] || legacy.data;
    }

    const cobalt = {
        data: `apex-daily-table__row${index % 2 === 0 ? "" : " is-alt"}`,
        total: "apex-daily-table__row is-total",
        lastPeriod: "apex-daily-table__row is-summary",
        index: "apex-daily-table__row is-index",
        difference: "apex-daily-table__row is-difference",
    };
    return cobalt[type] || cobalt.data;
}

export function dailyEmptyCellClass(variant) {
    return isCobaltDaily(variant)
        ? "apex-daily-table__empty"
        : "text-center py-8 text-gray-400";
}

export function dailyMutedCellClass(variant, groupStart = false) {
    if (isCobaltDaily(variant)) {
        return `apex-daily-table__cell is-muted${groupStart ? " is-group-start" : ""}`;
    }
    return `px-3 py-2 whitespace-nowrap text-gray-500${groupStart ? " border-l border-gray-200" : ""}`;
}

/** Shared group-start border logic for visible columns. */
export function getGroupStartFlag(visibleCols, key, firstGroup = "sales") {
    const idx = visibleCols.findIndex((m) => m.key === key);
    const col = visibleCols[idx];
    if (!col || idx < 0) return false;
    const prevInGroup = visibleCols.slice(0, idx).filter((p) => p.group === col.group);
    const isFirst = idx === 0;
    const isFirstInGroup = prevInGroup.length === 0;
    return isFirst || (isFirstInGroup && col.group !== firstGroup);
}

export function getB2BGroupStartFlag(visibleCols, key) {
    return getGroupStartFlag(visibleCols, key, "traffic");
}
