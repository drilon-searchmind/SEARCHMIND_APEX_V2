import { B2B_GROUP_LABELS } from "./b2bDailyUtils";
import { dailyHeadCellClass, isCobaltDaily } from "./dailyTableUi";

const GROUP_CLASS = {
    traffic: "is-traffic",
    engagement: "is-engagement",
    marketing: "is-marketing",
    efficiency: "is-efficiency",
};

const LEGACY_GROUP_BG = {
    traffic: "bg-[#1e2b2b]",
    engagement: "bg-[#3b5252]",
    marketing: "bg-[#406969]",
    efficiency: "bg-[#5e8888]",
};

function countVisibleInGroup(metricColumns, visibleMetrics, group) {
    return metricColumns.filter((m) => m.group === group && visibleMetrics[m.key]).length;
}

export default function B2BDailyMetricsTableHeader({
    visibleMetrics = {},
    metricColumns = [],
    variant = "default",
}) {
    const isCobalt = isCobaltDaily(variant);
    const groups = ["traffic", "engagement", "marketing", "efficiency"];
    const groupCounts = Object.fromEntries(
        groups.map((g) => [g, countVisibleInGroup(metricColumns, visibleMetrics, g)])
    );
    const showGroupRow = groups.some((g) => groupCounts[g] > 0);

    if (isCobalt) {
        return (
            <thead>
                {showGroupRow && (
                    <tr className="apex-daily-table__head-group-row">
                        <th className="apex-daily-table__head-date" rowSpan={2}>
                            Date
                        </th>
                        {groups.map((group) =>
                            groupCounts[group] > 0 ? (
                                <th
                                    key={group}
                                    className={`apex-daily-table__head-group ${GROUP_CLASS[group]}`}
                                    colSpan={groupCounts[group]}
                                >
                                    {B2B_GROUP_LABELS[group]}
                                </th>
                            ) : null
                        )}
                    </tr>
                )}
                <tr className="apex-daily-table__head-row">
                    {!showGroupRow && (
                        <th className="apex-daily-table__head-date">Date</th>
                    )}
                    {metricColumns.map((m, idx) => {
                        if (!visibleMetrics[m.key]) return null;
                        const visibleBefore = metricColumns.filter(
                            (p, i) => i < idx && visibleMetrics[p.key]
                        ).length;
                        const isFirstVisible = visibleBefore === 0;
                        const prevInGroup = metricColumns
                            .slice(0, idx)
                            .filter((p) => p.group === m.group && visibleMetrics[p.key]);
                        const showBorderL =
                            isFirstVisible ||
                            (prevInGroup.length === 0 &&
                                (m.group === "engagement" ||
                                    m.group === "marketing" ||
                                    m.group === "efficiency"));
                        return (
                            <th
                                key={m.key}
                                className={dailyHeadCellClass(variant, showBorderL)}
                            >
                                {m.label}
                            </th>
                        );
                    })}
                </tr>
            </thead>
        );
    }

    return (
        <thead>
            {showGroupRow && (
                <tr className="bg-gray-200">
                    <th
                        className="px-3 py-1.5 font-semibold text-gray-200 bg-black"
                        rowSpan={2}
                    >
                        Date
                    </th>
                    {groups.map((group) =>
                        groupCounts[group] > 0 ? (
                            <th
                                key={group}
                                className={`px-3 py-1.5 font-semibold text-gray-200 text-center border-l border-gray-300 ${LEGACY_GROUP_BG[group]}`}
                                colSpan={groupCounts[group]}
                            >
                                {B2B_GROUP_LABELS[group]}
                            </th>
                        ) : null
                    )}
                </tr>
            )}
            <tr className="bg-gray-50">
                {!showGroupRow && (
                    <th className="px-3 py-1.5 font-semibold text-gray-700">Date</th>
                )}
                {metricColumns.map((m, idx) => {
                    if (!visibleMetrics[m.key]) return null;
                    const visibleBefore = metricColumns.filter(
                        (p, i) => i < idx && visibleMetrics[p.key]
                    ).length;
                    const isFirstVisible = visibleBefore === 0;
                    const prevInGroup = metricColumns
                        .slice(0, idx)
                        .filter((p) => p.group === m.group && visibleMetrics[p.key]);
                    const showBorderL =
                        isFirstVisible ||
                        (prevInGroup.length === 0 &&
                            (m.group === "engagement" ||
                                m.group === "marketing" ||
                                m.group === "efficiency"));
                    return (
                        <th
                            key={m.key}
                            className={`px-3 py-1.5 font-semibold text-gray-700 whitespace-nowrap ${
                                showBorderL ? "border-l border-gray-300" : ""
                            }`}
                        >
                            {m.label}
                        </th>
                    );
                })}
            </tr>
        </thead>
    );
}
