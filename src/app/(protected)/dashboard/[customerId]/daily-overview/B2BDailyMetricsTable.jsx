"use client";

import Spinner from "@/components/ui/Spinner";
import { B2B_METRIC_COLUMNS, formatB2BCellValue } from "./b2bMetricConfig";
import B2BDailyMetricsTableHeader from "./B2BDailyMetricsTableHeader";
import {
    computeB2BRowMax,
    computeB2BTotals,
    computeB2BDifference,
    computeB2BIndex,
    getB2BVisibleColumns,
    getB2BBorderLClass,
    getB2BCellStyle,
} from "./b2bDailyUtils";

function SummaryRow({ label, values, visibleCols, className = "bg-gray-100 font-semibold border-t border-b border-gray-200" }) {
    return (
        <tr className={className}>
            <td className="px-3 py-2 whitespace-nowrap">{label}</td>
            {visibleCols.map((col) => (
                <td
                    key={col.key}
                    className={`px-3 py-2 whitespace-nowrap tabular-nums${getB2BBorderLClass(visibleCols, col.key)}`}
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
}) {
    const visibleCols = getB2BVisibleColumns(metricColumns, visibleMetrics);
    const visibleCount = 1 + visibleCols.length;

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[200px]">
                <Spinner size={40} color="#406969" />
            </div>
        );
    }

    if (error) {
        return <div className="text-red-500 text-center py-4">{error}</div>;
    }

    const max = rows?.length ? computeB2BRowMax(rows) : {};
    const totals = rows?.length ? computeB2BTotals(rows) : null;
    const prevTotals = rowsPrev?.length ? computeB2BTotals(rowsPrev) : null;
    const diff = rows?.length ? computeB2BDifference(rows, rowsPrev) : null;
    const indexData = rows?.length ? computeB2BIndex(rows, rowsPrev) : null;

    return (
        <div className="overflow-x-auto">
            <table
                className="min-w-full text-xs text-left border-collapse"
                style={{ fontSize: "12px" }}
            >
                <B2BDailyMetricsTableHeader
                    visibleMetrics={visibleMetrics}
                    metricColumns={metricColumns}
                />
                <tbody className="text-[12px]">
                    {!rows?.length ? (
                        <tr>
                            <td
                                colSpan={visibleCount}
                                className="text-center py-8 text-gray-400"
                            >
                                No data for selected range.
                            </td>
                        </tr>
                    ) : (
                        <>
                            {rows.map((row, idx) => (
                                <tr
                                    key={row.date}
                                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                                >
                                    <td className="px-3 py-2 whitespace-nowrap text-gray-800">
                                        {row.date}
                                    </td>
                                    {visibleCols.map((col) => (
                                        <td
                                            key={col.key}
                                            className={`px-3 py-2 whitespace-nowrap tabular-nums${getB2BBorderLClass(visibleCols, col.key)}`}
                                            style={getB2BCellStyle(
                                                col.key,
                                                row[col.key],
                                                max
                                            )}
                                        >
                                            {formatB2BCellValue(
                                                col.key,
                                                row[col.key],
                                                col
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}

                            {totals && (
                                <SummaryRow
                                    label="Total"
                                    values={totals}
                                    visibleCols={visibleCols}
                                />
                            )}

                            {prevTotals && rowsPrev?.length > 0 && (
                                <SummaryRow
                                    label="Previous Period"
                                    values={prevTotals}
                                    visibleCols={visibleCols}
                                    className="bg-gray-50 font-semibold border-t border-b border-gray-200"
                                />
                            )}

                            {indexData && rowsPrev?.length > 0 && (
                                <tr className="bg-slate-50/80 font-medium border-t border-b border-gray-200">
                                    <td className="px-3 py-2 whitespace-nowrap">Index</td>
                                    {visibleCols.map((col) => {
                                        const borderCls = getB2BBorderLClass(
                                            visibleCols,
                                            col.key
                                        );
                                        const cell = indexData[col.key];
                                        if (!cell || cell.index == null) {
                                            return (
                                                <td
                                                    key={col.key}
                                                    className={`px-3 py-2 whitespace-nowrap text-gray-500 tabular-nums${borderCls}`}
                                                >
                                                    —
                                                </td>
                                            );
                                        }
                                        return (
                                            <td
                                                key={col.key}
                                                className={`px-3 py-2 whitespace-nowrap tabular-nums${borderCls}`}
                                            >
                                                {cell.formatted}
                                            </td>
                                        );
                                    })}
                                </tr>
                            )}

                            {diff && rowsPrev?.length > 0 && (
                                <tr className="bg-amber-50/50 font-medium border-t border-b border-gray-200">
                                    <td className="px-3 py-2 whitespace-nowrap">Difference</td>
                                    {visibleCols.map((col) => {
                                        const borderCls = getB2BBorderLClass(
                                            visibleCols,
                                            col.key
                                        );
                                        const cell = diff[col.key];
                                        if (!cell || cell.diff === 0) {
                                            return (
                                                <td
                                                    key={col.key}
                                                    className={`px-3 py-2 whitespace-nowrap text-gray-500 tabular-nums${borderCls}`}
                                                >
                                                    —
                                                </td>
                                            );
                                        }
                                        return (
                                            <td
                                                key={col.key}
                                                className={`px-3 py-2 whitespace-nowrap tabular-nums${borderCls}`}
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
