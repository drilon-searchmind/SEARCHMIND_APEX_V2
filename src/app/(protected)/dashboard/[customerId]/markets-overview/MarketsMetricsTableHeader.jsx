'use client';

import {
    dailyHeadCellClass,
    getGroupStartFlag,
    isCobaltDaily,
} from '../daily-overview/dailyTableUi';

const GROUP_CLASS = {
    sales: 'is-sales',
    marketing: 'is-marketing',
    result: 'is-result',
};

function countVisibleInGroup(metricColumns, visibleMetrics, group) {
    return metricColumns.filter((m) => m.group === group && visibleMetrics[m.key]).length;
}

export default function MarketsMetricsTableHeader({
    variant = 'default',
    visibleMetrics = {},
    metricColumns = [],
}) {
    const isCobalt = isCobaltDaily(variant);
    const headerBg = 'bg-gray-50';

    const salesCount = countVisibleInGroup(metricColumns, visibleMetrics, 'sales');
    const marketingCount = countVisibleInGroup(metricColumns, visibleMetrics, 'marketing');
    const resultCount = countVisibleInGroup(metricColumns, visibleMetrics, 'result');

    const showSales = salesCount > 0;
    const showMarketing = marketingCount > 0;
    const showResult = resultCount > 0;
    const showGroupRow = showSales || showMarketing || showResult;

    if (isCobalt) {
        return (
            <thead>
                {showGroupRow && (
                    <tr className="apex-daily-table__head-group-row">
                        <th
                            className="apex-markets-table__head-include"
                            rowSpan={2}
                            aria-label="Include market"
                        />
                        <th className="apex-markets-table__head-market" rowSpan={2}>
                            Market
                        </th>
                        {showSales && (
                            <th
                                className={`apex-daily-table__head-group ${GROUP_CLASS.sales}`}
                                colSpan={salesCount}
                            >
                                Sales
                            </th>
                        )}
                        {showMarketing && (
                            <th
                                className={`apex-daily-table__head-group ${GROUP_CLASS.marketing}`}
                                colSpan={marketingCount}
                            >
                                Marketing
                            </th>
                        )}
                        {showResult && (
                            <th
                                className={`apex-daily-table__head-group ${GROUP_CLASS.result}`}
                                colSpan={resultCount}
                            >
                                Result
                            </th>
                        )}
                    </tr>
                )}
                <tr className="apex-daily-table__head-row">
                    {!showGroupRow && (
                        <>
                            <th className="apex-markets-table__head-include" aria-label="Include market" />
                            <th className="apex-markets-table__head-market">Market</th>
                        </>
                    )}
                    {metricColumns.map((m) => {
                        if (!visibleMetrics[m.key]) return null;
                        const visibleCols = metricColumns.filter((c) => visibleMetrics[c.key]);
                        const groupStart = getGroupStartFlag(visibleCols, m.key, 'sales');
                        return (
                            <th key={m.key} className={dailyHeadCellClass(variant, groupStart)}>
                                {m.label}
                            </th>
                        );
                    })}
                </tr>
            </thead>
        );
    }

    return (
        <thead className={`${headerBg} text-gray-700`}>
            <tr>
                <th
                    rowSpan={2}
                    className="px-2 py-2 w-10 border-b border-gray-200"
                    aria-label="Include market"
                />
                <th
                    rowSpan={2}
                    className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-gray-200"
                >
                    Market
                </th>
                {showSales && (
                    <th
                        colSpan={salesCount}
                        className="px-3 py-2 text-center font-semibold border-b border-l border-gray-200"
                    >
                        Sales
                    </th>
                )}
                {showMarketing && (
                    <th
                        colSpan={marketingCount}
                        className="px-3 py-2 text-center font-semibold border-b border-l border-gray-200"
                    >
                        Marketing
                    </th>
                )}
                {showResult && (
                    <th
                        colSpan={resultCount}
                        className="px-3 py-2 text-center font-semibold border-b border-l border-gray-200"
                    >
                        Result
                    </th>
                )}
            </tr>
            <tr>
                {metricColumns.map((m) => {
                    if (!visibleMetrics[m.key]) return null;
                    const visibleCols = metricColumns.filter((c) => visibleMetrics[c.key]);
                    const idx = visibleCols.findIndex((c) => c.key === m.key);
                    const prevInGroup = visibleCols
                        .slice(0, idx)
                        .filter((p) => p.group === m.group);
                    const isFirst = idx === 0;
                    const isFirstInGroup = prevInGroup.length === 0;
                    const borderCls =
                        isFirst || (isFirstInGroup && m.group !== 'sales')
                            ? ' border-l border-gray-200'
                            : '';

                    return (
                        <th
                            key={m.key}
                            className={`px-3 py-2 text-left font-medium whitespace-nowrap border-b border-gray-200${borderCls}`}
                        >
                            {m.label}
                        </th>
                    );
                })}
            </tr>
        </thead>
    );
}
