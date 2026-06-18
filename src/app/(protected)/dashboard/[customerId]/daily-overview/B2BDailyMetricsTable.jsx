"use client";

import CobaltLoader from "@/components/ui/CobaltLoader";
import { B2B_METRIC_COLUMNS, formatB2BCellValue } from "./b2bMetricConfig";
import B2BDailyMetricsTableHeader from "./B2BDailyMetricsTableHeader";
import {
    computeB2BRowMax,
    computeB2BTotals,
    computeB2BDifference,
    computeB2BIndex,
    getB2BVisibleColumns,
    getB2BCellStyle,
} from "./b2bDailyUtils";
import {
    dailyCellClass,
    dailyEmptyCellClass,
    dailyMutedCellClass,
    dailyRowClass,
    dailyTableClass,
    dailyTableStyle,
    dailyTableWrapClass,
    getB2BGroupStartFlag,
    isCobaltDaily,
} from "./dailyTableUi";

function SummaryRow({
    label,
    values,
    visibleCols,
    variant,
    rowType = "total",
}) {
    return (
        <tr className={dailyRowClass(variant, rowType)}>
            <td className={dailyCellClass(variant)}>{label}</td>
            {visibleCols.map((col) => (
                <td
                    key={col.key}
                    className={dailyCellClass(variant, getB2BGroupStartFlag(visibleCols, col.key))}
                >
                    {values[col.key] ?? "—"}
                </td>
            ))}
        </tr>
    );
}

export default function B2BDailyMetricsTable({
    rows,
    rowsPrev = [],
    loading,
    error,
    visibleMetrics = {},
    metricColumns = B2B_METRIC_COLUMNS,
    variant = "default",
}) {
    const visibleCols = getB2BVisibleColumns(metricColumns, visibleMetrics);
    const visibleCount = 1 + visibleCols.length;

    if (loading) {
        return isCobaltDaily(variant) ? (
            <div className="apex-daily-loading">
                <CobaltLoader
                    variant="block"
                    title="Loading daily metrics"
                    request="GET /api/b2b-dashboard"
                />
            </div>
        ) : (
            <div className="flex justify-center items-center min-h-[200px]">
                <div className="text-sm text-gray-500">Loading…</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={isCobaltDaily(variant) ? "apex-daily-error" : "text-red-500 text-center py-4"}>
                {error}
            </div>
        );
    }

    const max = rows?.length ? computeB2BRowMax(rows) : {};
    const totals = rows?.length ? computeB2BTotals(rows) : null;
    const prevTotals = rowsPrev?.length ? computeB2BTotals(rowsPrev) : null;
    const diff = rows?.length ? computeB2BDifference(rows, rowsPrev) : null;
    const indexData = rows?.length ? computeB2BIndex(rows, rowsPrev) : null;

    return (
        <div className={dailyTableWrapClass(variant)}>
            <table className={dailyTableClass(variant)} style={dailyTableStyle(variant)}>
                <B2BDailyMetricsTableHeader
                    variant={variant}
                    visibleMetrics={visibleMetrics}
                    metricColumns={metricColumns}
                />
                <tbody className={isCobaltDaily(variant) ? undefined : "text-[12px]"}>
                    {!rows?.length ? (
                        <tr>
                            <td colSpan={visibleCount} className={dailyEmptyCellClass(variant)}>
                                No data for selected range.
                            </td>
                        </tr>
                    ) : (
                        <>
                            {rows.map((row, idx) => (
                                <tr key={row.date} className={dailyRowClass(variant, "data", idx)}>
                                    <td className={dailyCellClass(variant)}>{row.date}</td>
                                    {visibleCols.map((col) => (
                                        <td
                                            key={col.key}
                                            className={dailyCellClass(
                                                variant,
                                                getB2BGroupStartFlag(visibleCols, col.key)
                                            )}
                                            style={getB2BCellStyle(col.key, row[col.key], max)}
                                        >
                                            {formatB2BCellValue(col.key, row[col.key], col)}
                                        </td>
                                    ))}
                                </tr>
                            ))}

                            {totals && (
                                <SummaryRow
                                    label="Total"
                                    values={totals}
                                    visibleCols={visibleCols}
                                    variant={variant}
                                    rowType="total"
                                />
                            )}

                            {prevTotals && rowsPrev?.length > 0 && (
                                <SummaryRow
                                    label="Previous Period"
                                    values={prevTotals}
                                    visibleCols={visibleCols}
                                    variant={variant}
                                    rowType="lastPeriod"
                                />
                            )}

                            {indexData && rowsPrev?.length > 0 && (
                                <tr className={dailyRowClass(variant, "index")}>
                                    <td className={dailyCellClass(variant)}>Index</td>
                                    {visibleCols.map((col) => {
                                        const groupStart = getB2BGroupStartFlag(
                                            visibleCols,
                                            col.key
                                        );
                                        const cell = indexData[col.key];
                                        if (!cell || cell.index == null) {
                                            return (
                                                <td
                                                    key={col.key}
                                                    className={dailyMutedCellClass(
                                                        variant,
                                                        groupStart
                                                    )}
                                                >
                                                    —
                                                </td>
                                            );
                                        }
                                        return (
                                            <td
                                                key={col.key}
                                                className={dailyCellClass(variant, groupStart)}
                                            >
                                                {cell.formatted}
                                            </td>
                                        );
                                    })}
                                </tr>
                            )}

                            {diff && rowsPrev?.length > 0 && (
                                <tr className={dailyRowClass(variant, "difference")}>
                                    <td className={dailyCellClass(variant)}>Difference</td>
                                    {visibleCols.map((col) => {
                                        const groupStart = getB2BGroupStartFlag(
                                            visibleCols,
                                            col.key
                                        );
                                        const cell = diff[col.key];
                                        if (!cell || cell.diff === 0) {
                                            return (
                                                <td
                                                    key={col.key}
                                                    className={dailyMutedCellClass(
                                                        variant,
                                                        groupStart
                                                    )}
                                                >
                                                    —
                                                </td>
                                            );
                                        }
                                        return (
                                            <td
                                                key={col.key}
                                                className={dailyCellClass(variant, groupStart)}
                                            >
                                                {cell.formatted}
                                            </td>
                                        );
                                    })}
                                </tr>
                            )}
                        </>
                    )}
                </tbody>
            </table>
        </div>
    );
}
