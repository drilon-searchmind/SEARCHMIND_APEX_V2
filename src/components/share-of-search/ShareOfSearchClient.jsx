"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import dayjs from "dayjs";
import Select from "react-select";
import {
    FiPlus,
    FiRefreshCw,
    FiTrash2,
    FiRotateCcw,
    FiTrendingUp,
    FiLayers,
} from "react-icons/fi";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import GraphCard from "@/components/dashboard/GraphCard";
import MetricCard from "@/components/dashboard/MetricCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/Spinner";
import { useCustomers } from "@/hooks/useCustomers";
import { cn } from "@/lib/utils";
import { getCountrySelectOptions, matchCountryOption } from "@/lib/countrySelectOptions";

const MONTH_OF_YEAR = {
    JANUARY: 1,
    FEBRUARY: 2,
    MARCH: 3,
    APRIL: 4,
    MAY: 5,
    JUNE: 6,
    JULY: 7,
    AUGUST: 8,
    SEPTEMBER: 9,
    OCTOBER: 10,
    NOVEMBER: 11,
    DECEMBER: 12,
};

const CHART_COLORS = ["#406969", "#C6ED62", "#60a5fa", "#94a3b8", "#6ee7b7", "#a78bfa", "#f472b6"];

const COUNTRY_SELECT_STYLES = {
    control: (base, state) => ({
        ...base,
        minHeight: 36,
        borderRadius: 6,
        borderColor: state.isFocused ? "#406969" : "#e5e7eb",
        boxShadow: state.isFocused ? "0 0 0 1px #406969" : "none",
        fontSize: "0.875rem",
        backgroundColor: "white",
        "&:hover": { borderColor: "#d1d5db" },
    }),
    menu: (base) => ({ ...base, zIndex: 50 }),
    option: (base, state) => ({
        ...base,
        fontSize: "0.875rem",
        backgroundColor: state.isSelected ? "#1E2B2B" : state.isFocused ? "#f3f4f6" : "white",
        color: state.isSelected ? "white" : "#111827",
    }),
    singleValue: (base) => ({ ...base, color: "#111827" }),
    input: (base) => ({ ...base, color: "#111827" }),
};

function parseMonthKey(m) {
    if (!m) return null;
    const y = Number(m.year);
    let mon = m.month;
    if (typeof mon === "string") mon = MONTH_OF_YEAR[mon.toUpperCase()];
    if (!y || !mon) return null;
    return `${y}-${String(mon).padStart(2, "0")}`;
}

function monthKeysInRange(startDate, endDate) {
    const keys = [];
    let d = dayjs(startDate).startOf("month");
    const end = dayjs(endDate).endOf("month");
    while (!d.isAfter(end, "month")) {
        keys.push(d.format("YYYY-MM"));
        d = d.add(1, "month");
    }
    return keys;
}

function categoryLabel(ym) {
    return dayjs(`${ym}-01`).format("MMM YYYY");
}

function seriesForBrand(row, monthKeys) {
    const map = new Map();
    const msv = row.monthlySearchVolumes || row.monthly_search_volumes || [];
    for (const m of msv) {
        const k = parseMonthKey(m);
        if (k) map.set(k, Number(m.monthlySearches ?? m.monthly_searches ?? 0));
    }
    let data = monthKeys.map((k) => map.get(k) ?? 0);
    const sum = data.reduce((a, b) => a + b, 0);
    const vol = Number(row.volumeInRange || 0);
    if (sum === 0 && vol > 0 && monthKeys.length > 0) {
        const per = Math.round(vol / monthKeys.length);
        data = monthKeys.map(() => per);
    }
    return data;
}

function totalSeriesByMonth(brandSeries) {
    if (!brandSeries.length) return [];
    const len = brandSeries[0].data.length;
    const out = new Array(len).fill(0);
    for (const s of brandSeries) {
        for (let i = 0; i < len; i++) {
            out[i] += Number(s.data[i] || 0);
        }
    }
    return out;
}

/** Per month: each series value becomes % of the sum of selected series that month (2 decimals). */
function toSharePercentSeries(series) {
    if (!series.length) return [];
    const len = series[0].data.length;
    const out = series.map((s) => ({
        name: s.name,
        data: s.data.map((v) => Math.max(0, Number(v) || 0)),
    }));
    for (let j = 0; j < len; j++) {
        let sum = 0;
        for (const s of out) sum += s.data[j];
        for (const s of out) {
            const v = s.data[j];
            s.data[j] = sum > 0 ? Math.round((v / sum) * 1000) / 10 : 0;
        }
    }
    return out;
}

const METRIC_CARD_MIN_HEIGHT = "min-h-[200px] h-[200px]";

function formatSharePctValue(val) {
    if (val == null || val === "" || Number.isNaN(Number(val))) return "—";
    return `${Number(val).toFixed(2)}%`;
}

/** DateRangePicker presets only for Share of Search */
function getShareOfSearchDatePresets() {
    return [
        {
            label: "This year",
            getRange: () => {
                const end = dayjs().subtract(1, "day");
                let start = dayjs().startOf("year");
                if (start.isAfter(end)) start = end;
                return { start, end };
            },
        },
        {
            label: "Last Year",
            getRange: () => ({
                start: dayjs().subtract(1, "year").startOf("year"),
                end: dayjs().subtract(1, "year").endOf("year"),
            }),
        },
        ...[2, 3, 4, 5].map((n) => ({
            label: `${n} Years (From today)`,
            getRange: () => {
                const end = dayjs().subtract(1, "day");
                const start = end.subtract(n, "year");
                return { start, end };
            },
        })),
    ];
}

function getDefaultChartKeys(rows, mode) {
    if (!rows?.length) return [];
    if (mode === "share") return rows.map((r) => r.brand);
    return ["__total__", ...rows.map((r) => r.brand)];
}

export default function ShareOfSearchClient() {
    const params = useParams();
    const customerId = params?.customerId;
    const { customers } = useCustomers();
    const customer = customers.find((c) => String(c._id) === String(customerId));

    const countryOptions = useMemo(() => getCountrySelectOptions(), []);
    const shareOfSearchDatePresets = useMemo(() => getShareOfSearchDatePresets(), []);

    const today = new Date();
    const defaultEnd = dayjs(today).subtract(1, "day");
    const defaultStart = defaultEnd.subtract(11, "month").startOf("month");
    const defaultRange = {
        startDate: defaultStart.format("YYYY-MM-DD"),
        endDate: defaultEnd.format("YYYY-MM-DD"),
    };

    const [tempRange, setTempRange] = useState(defaultRange);
    const [appliedRange, setAppliedRange] = useState(defaultRange);
    const [brands, setBrands] = useState([]);
    const [draft, setDraft] = useState("");
    const [geoLabel, setGeoLabel] = useState("DK");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [metricsRows, setMetricsRows] = useState(null);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [selectedChartKeys, setSelectedChartKeys] = useState([]);
    const [chartDisplayMode, setChartDisplayMode] = useState("share");

    const countryValue = useMemo(() => {
        return (
            matchCountryOption(geoLabel, countryOptions) ||
            countryOptions.find((o) => o.value === "DK") ||
            countryOptions[0]
        );
    }, [countryOptions, geoLabel]);

    const loadHistory = useCallback(async () => {
        if (!customerId) return;
        setHistoryLoading(true);
        try {
            const res = await fetch(`/api/share-of-search/${customerId}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Could not load history");
            setHistory(data.items || []);
        } catch (e) {
            console.error(e);
        } finally {
            setHistoryLoading(false);
        }
    }, [customerId]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    const handleApplyRange = ({ startDate, endDate }) => {
        setAppliedRange({ startDate, endDate });
    };

    const addBrand = () => {
        const b = draft.trim();
        if (!b) return;
        setBrands((prev) => (prev.includes(b) ? prev : [...prev, b]));
        setDraft("");
    };

    const removeBrand = (b) => {
        setBrands((prev) => prev.filter((x) => x !== b));
    };

    const clearBrands = () => {
        setBrands([]);
        setDraft("");
        setMetricsRows(null);
        setSelectedChartKeys([]);
        setError(null);
    };

    const handleChartModeChange = (mode) => {
        setChartDisplayMode(mode);
        if (mode === "share") {
            setSelectedChartKeys((prev) => {
                const next = prev.filter((k) => k !== "__total__");
                if (next.length === 0 && metricsRows?.length) {
                    return metricsRows.map((r) => r.brand);
                }
                return next.length ? next : prev;
            });
        }
    };

    const toggleChartKey = (key) => {
        if (chartDisplayMode === "share" && key === "__total__") return;
        setSelectedChartKeys((prev) => {
            if (prev.includes(key)) {
                if (prev.length <= 1) return prev;
                return prev.filter((k) => k !== key);
            }
            return [...prev, key];
        });
    };

    const fetchMetrics = async () => {
        if (!customerId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/share-of-search/${customerId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    brands,
                    geoLabel,
                    startDate: appliedRange.startDate,
                    endDate: appliedRange.endDate,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Request failed");
            const rows = data.metrics?.rows || [];
            setMetricsRows(rows);
            setSelectedChartKeys(getDefaultChartKeys(rows, chartDisplayMode));
            await loadHistory();
        } catch (e) {
            setError(e.message || "Something went wrong");
            setMetricsRows(null);
            setSelectedChartKeys([]);
        } finally {
            setLoading(false);
        }
    };

    const reuseSnapshot = (h) => {
        setBrands([...(h.brands || [])]);
        const matched = matchCountryOption(h.geoLabel, countryOptions);
        setGeoLabel(matched?.value ?? (h.geoLabel || "DK"));
        const r = { startDate: h.startDate, endDate: h.endDate };
        setTempRange(r);
        setAppliedRange(r);
        setMetricsRows(h.rows || []);
        setSelectedChartKeys(getDefaultChartKeys(h.rows || [], chartDisplayMode));
        setError(null);
    };

    const deleteSnapshot = async (snapshotId) => {
        if (!customerId || !snapshotId) return;
        if (!window.confirm("Delete this saved search from history?")) return;
        setDeletingId(String(snapshotId));
        try {
            const res = await fetch(
                `/api/share-of-search/${customerId}?snapshotId=${encodeURIComponent(snapshotId)}`,
                { method: "DELETE" }
            );
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Delete failed");
            await loadHistory();
        } catch (e) {
            setError(e.message || "Could not delete");
        } finally {
            setDeletingId(null);
        }
    };

    const monthKeys = useMemo(
        () => monthKeysInRange(appliedRange.startDate, appliedRange.endDate),
        [appliedRange.startDate, appliedRange.endDate]
    );
    const categories = useMemo(() => monthKeys.map(categoryLabel), [monthKeys]);

    const brandLineSeries = useMemo(() => {
        if (!metricsRows?.length || !monthKeys.length) return [];
        return metricsRows.map((row) => ({
            name: row.brand,
            data: seriesForBrand(row, monthKeys),
        }));
    }, [metricsRows, monthKeys]);

    const brandColorByBrand = useMemo(() => {
        const m = new Map();
        (metricsRows || []).forEach((r, i) => {
            m.set(r.brand, CHART_COLORS[i % CHART_COLORS.length]);
        });
        return m;
    }, [metricsRows]);

    const { chartSeries, chartOptions, chartTitle } = useMemo(() => {
        if (!categories.length) {
            return { chartSeries: [], chartOptions: {}, chartTitle: "" };
        }

        let volumeSeries = [];
        if (chartDisplayMode === "volume" && selectedChartKeys.includes("__total__")) {
            volumeSeries.push({
                name: "Total",
                data: totalSeriesByMonth(brandLineSeries),
            });
        }
        for (const s of brandLineSeries) {
            if (selectedChartKeys.includes(s.name)) {
                volumeSeries.push({ name: s.name, data: [...s.data] });
            }
        }

        let series = volumeSeries;
        if (chartDisplayMode === "share") {
            series = toSharePercentSeries(volumeSeries.filter((s) => s.name !== "Total"));
        }

        const isShare = chartDisplayMode === "share";
        const title = isShare
            ? series.length === 1
                ? `${series[0].name} share over time`
                : "Share of search over time"
            : series.length === 1
              ? `${series[0].name} over time`
              : "Search volume over time";

        const seriesColors = series.map((s) => {
            if (s.name === "Total") return "#94a3b8";
            const idx = metricsRows?.findIndex((r) => r.brand === s.name) ?? -1;
            return CHART_COLORS[(idx >= 0 ? idx : 0) % CHART_COLORS.length];
        });

        const options = {
            chart: {
                toolbar: { show: false },
                zoom: { enabled: false },
            },
            stroke: { width: 2, curve: "smooth" },
            markers: { size: 0, hover: { size: 5 } },
            xaxis: { categories },
            legend: { position: "top" },
            colors: seriesColors,
            dataLabels: { enabled: false },
            yaxis: {
                min: isShare ? 0 : undefined,
                max: isShare ? 100 : undefined,
                labels: {
                    formatter: (val) =>
                        isShare
                            ? `${Math.round(Number(val))}%`
                            : typeof val === "number" && val >= 1000
                              ? `${Math.round(val / 1000)}k`
                              : String(val ?? ""),
                },
            },
            tooltip: {
                y: {
                    formatter: (val) =>
                        isShare
                            ? `${typeof val === "number" ? val.toFixed(1) : val}%`
                            : typeof val === "number"
                              ? val.toLocaleString()
                              : val,
                },
            },
        };
        return { chartSeries: series, chartOptions: options, chartTitle: title };
    }, [categories, brandLineSeries, selectedChartKeys, chartDisplayMode, metricsRows]);

    const totalVolume = useMemo(
        () => (metricsRows || []).reduce((s, r) => s + Number(r.volumeInRange || 0), 0),
        [metricsRows]
    );

    const shareOfSearchAiSnapshot = useMemo(() => {
        if (!metricsRows?.length) {
            return {
                dashboard: "Share of Search",
                status: "no_data",
                hint: "No Keyword Planner results loaded. Add brands, choose country and dates, then click Fetch data.",
            };
        }
        return {
            dashboard: "Share of Search",
            dataSource: "Google Ads Keyword Planner (historical search volumes)",
            country: countryValue?.label || geoLabel,
            countryCode: geoLabel,
            period: {
                startDate: appliedRange.startDate,
                endDate: appliedRange.endDate,
            },
            chartView:
                chartDisplayMode === "share"
                    ? "Share of search (percentage of compared brands)"
                    : "Search volume (absolute)",
            totalSearchVolumeInPeriod: totalVolume,
            brandsAnalyzed: metricsRows.map((r) => ({
                brand: r.brand,
                keywordPlanText: r.apiKeywordText,
                shareOfSearchPercent: r.sharePct,
                volumeInPeriod: r.volumeInRange,
                sharePctPreviousPeriod: r.sharePctPreviousPeriod,
                sharePctLastYear: r.sharePctLastYear,
            })),
            fieldGuide: {
                shareOfSearchPercent:
                    "Each brand's % of the sum of all listed brands' volumes in the period (not entire market).",
                sharePctPreviousPeriod: "Same share metric for the prior equal-length period.",
                sharePctLastYear: "Same share metric for dates one calendar year earlier.",
            },
        };
    }, [
        metricsRows,
        appliedRange.startDate,
        appliedRange.endDate,
        chartDisplayMode,
        geoLabel,
        countryValue,
        totalVolume,
    ]);

    return (
        <div className="pb-10">
            <DashboardHeading
                title="Share of Search"
                label={customer?.customerName || "Customer"}
                customerId={customerId}
                dateRange={appliedRange}
                comparisonMethod="Last Period"
                showPdfExport={false}
                showAnalyzeWithAi
                dashboardType="share-of-search"
                dataSnapshot={shareOfSearchAiSnapshot}
                loading={loading}
                right={
                    <DateRangePicker
                        onApply={handleApplyRange}
                        startDate={tempRange.startDate}
                        endDate={tempRange.endDate}
                        onStartDateChange={(v) => setTempRange((r) => ({ ...r, startDate: v }))}
                        onEndDateChange={(v) => setTempRange((r) => ({ ...r, endDate: v }))}
                        loading={loading}
                        showComparisonMethodToggler={false}
                        customPresets={shareOfSearchDatePresets}
                    />
                }
            />

            <div className="border border-gray-200 rounded-xl bg-white p-4 md:p-6 mb-8 space-y-4">
                <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Brands</label>
                    <div className="flex gap-2 flex-wrap">
                        {brands.map((b) => (
                            <span
                                key={b}
                                className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-lg bg-gray-100 text-sm text-gray-800"
                            >
                                {b}
                                <button
                                    type="button"
                                    className="p-0.5 rounded hover:bg-gray-200 text-gray-500"
                                    onClick={() => removeBrand(b)}
                                    aria-label={`Remove ${b}`}
                                >
                                    <FiTrash2 className="w-3.5 h-3.5" />
                                </button>
                            </span>
                        ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                        <Input
                            placeholder="Add brand name…"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    addBrand();
                                }
                            }}
                            className="flex-1"
                        />
                        <Button
                            type="button"
                            size="icon"
                            className="shrink-0 bg-[var(--color-primary-searchmind)] hover:opacity-90 text-white"
                            onClick={addBrand}
                            aria-label="Add brand"
                        >
                            <FiPlus className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                    <div className="flex-1 min-w-0">
                        <label className="text-sm font-medium text-gray-700 block mb-1" htmlFor="sos-country">
                            Country
                        </label>
                        <Select
                            inputId="sos-country"
                            instanceId="sos-country"
                            options={countryOptions}
                            value={countryValue}
                            onChange={(opt) => setGeoLabel(opt?.value ?? "DK")}
                            isSearchable
                            isClearable={false}
                            placeholder="Search country…"
                            styles={COUNTRY_SELECT_STYLES}
                            className="text-sm"
                        />
                    </div>
                                       <div className="flex flex-wrap gap-2 sm:ml-auto">
                        <Button
                            type="button"
                            variant="outline"
                            className="gap-2"
                            disabled={loading || (brands.length === 0 && !draft.trim())}
                            onClick={clearBrands}
                        >
                            Clear
                        </Button>
                        <Button
                            type="button"
                            className="gap-2 bg-[var(--color-primary-searchmind)] hover:opacity-90 text-white"
                            disabled={loading || brands.length === 0}
                            onClick={fetchMetrics}
                        >
                            {loading ? <Spinner size={18} color="white" /> : <FiRefreshCw className="w-4 h-4" />}
                            Fetch data
                        </Button>
                    </div>
                </div>

                {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                        {error}
                    </p>
                )}
            </div>

            {metricsRows && metricsRows.length > 0 && (
                <>
                    <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-stretch">
                        {chartDisplayMode === "volume" && (
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={() => toggleChartKey("__total__")}
                                onKeyDown={(e) =>
                                    (e.key === "Enter" || e.key === " ") && toggleChartKey("__total__")
                                }
                                className="cursor-pointer h-[200px]"
                            >
                                <MetricCard
                                    label="Total search volume"
                                    value={totalVolume.toLocaleString()}
                                    icon={<FiLayers />}
                                    isActive={selectedChartKeys.includes("__total__")}
                                    comparisonMethod={null}
                                    hideIconBackdrop
                                    className={cn("h-full", METRIC_CARD_MIN_HEIGHT)}
                                />
                            </div>
                        )}
                        {metricsRows.map((row) => (
                            <div
                                key={row.brand}
                                role="button"
                                tabIndex={0}
                                onClick={() => toggleChartKey(row.brand)}
                                onKeyDown={(e) =>
                                    (e.key === "Enter" || e.key === " ") && toggleChartKey(row.brand)
                                }
                                className="cursor-pointer h-[200px]"
                            >
                                <MetricCard
                                    label={
                                        <span className="flex items-center gap-2 min-w-0">
                                            <span
                                                className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
                                                style={{
                                                    backgroundColor:
                                                        brandColorByBrand.get(row.brand) ??
                                                        CHART_COLORS[0],
                                                }}
                                                aria-hidden
                                            />
                                            <span className="truncate">{row.brand}</span>
                                        </span>
                                    }
                                    value={`${row.sharePct}%`}
                                    subCaption={
                                        <div className="flex flex-col gap-1 leading-snug">
                                            <span>
                                                volume:{" "}
                                                {Number(row.volumeInRange || 0).toLocaleString()}
                                            </span>
                                            <span>
                                                SoS % last period:{" "}
                                                {formatSharePctValue(row.sharePctPreviousPeriod)}
                                            </span>
                                            <span>
                                                SoS % last year:{" "}
                                                {formatSharePctValue(row.sharePctLastYear)}
                                            </span>
                                        </div>
                                    }
                                    icon={<FiTrendingUp />}
                                    isActive={selectedChartKeys.includes(row.brand)}
                                    comparisonMethod={null}
                                    hideIconBackdrop
                                    className={cn("h-full", METRIC_CARD_MIN_HEIGHT)}
                                />
                            </div>
                        ))}
                    </div>

                    <div className="w-full mb-8">
                        <div className="flex flex-wrap gap-2 mb-3">
                            <button
                                type="button"
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors duration-150",
                                    chartDisplayMode === "share"
                                        ? "bg-[var(--color-primary-searchmind)] text-white border-[var(--color-primary-searchmind)]"
                                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                                )}
                                onClick={() => handleChartModeChange("share")}
                            >
                                Share of search
                            </button>
                            <button
                                type="button"
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors duration-150",
                                    chartDisplayMode === "volume"
                                        ? "bg-[var(--color-primary-searchmind)] text-white border-[var(--color-primary-searchmind)]"
                                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                                )}
                                onClick={() => handleChartModeChange("volume")}
                            >
                                Search volume
                            </button>
                        </div>
                        {loading ? (
                            <div className="flex items-center justify-center h-64">
                                <Spinner size={40} color="#406969" />
                            </div>
                        ) : chartSeries.length > 0 ? (
                            <GraphCard
                                title={chartTitle}
                                chartType="line"
                                chartOptions={chartOptions}
                                chartSeries={chartSeries}
                                height={360}
                                hideChartToggle
                            />
                        ) : (
                            <p className="text-sm text-gray-500">Select at least one metric to show the chart.</p>
                        )}
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-gray-200 mb-10">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 text-left text-gray-600">
                                <tr>
                                    <th className="px-3 py-2 font-medium">Brand</th>
                                    <th className="px-3 py-2 font-medium">Keyword (API)</th>
                                    <th className="px-3 py-2 font-medium text-right">Volume in range</th>
                                    <th className="px-3 py-2 font-medium text-right">Share</th>
                                </tr>
                            </thead>
                            <tbody>
                                {metricsRows.map((r) => (
                                    <tr key={r.brand} className="border-t border-gray-100">
                                        <td className="px-3 py-2 text-gray-900">{r.brand}</td>
                                        <td className="px-3 py-2 text-gray-600">{r.apiKeywordText}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {Number(r.volumeInRange || 0).toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">{r.sharePct}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            <section className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <h2 className="text-base font-semibold text-gray-900">History</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Previously saved searches. Load one to restore settings and results, or delete it.
                    </p>
                </div>
                <div className="p-4">
                    {historyLoading ? (
                        <div className="flex justify-center py-8">
                            <Spinner />
                        </div>
                    ) : history.length === 0 ? (
                        <p className="text-sm text-gray-500">No saved searches yet. Fetch data to create one.</p>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-left text-gray-600">
                                    <tr>
                                        <th className="px-3 py-2 font-medium">Date</th>
                                        <th className="px-3 py-2 font-medium">Brands</th>
                                        <th className="px-3 py-2 font-medium">Country</th>
                                        <th className="px-3 py-2 font-medium">Period</th>
                                        <th className="px-3 py-2 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((h) => (
                                        <tr key={String(h._id)} className="border-t border-gray-100">
                                            <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                                                {h.createdAt
                                                    ? dayjs(h.createdAt).format("YYYY-MM-DD HH:mm")
                                                    : "—"}
                                            </td>
                                            <td className="px-3 py-2 text-gray-700">
                                                {(h.brands || []).join(", ")}
                                            </td>
                                            <td className="px-3 py-2 text-gray-700">{h.geoLabel}</td>
                                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                                                {h.startDate} → {h.endDate}
                                            </td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap">
                                                <div className="inline-flex items-center gap-2 justify-end">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="gap-1"
                                                        onClick={() => reuseSnapshot(h)}
                                                    >
                                                        <FiRotateCcw className="w-3.5 h-3.5" />
                                                        Load
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                                                        disabled={deletingId === String(h._id)}
                                                        onClick={() => deleteSnapshot(h._id)}
                                                    >
                                                        {deletingId === String(h._id) ? (
                                                            <Spinner size={14} />
                                                        ) : (
                                                            <FiTrash2 className="w-3.5 h-3.5" />
                                                        )}
                                                        Delete
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
