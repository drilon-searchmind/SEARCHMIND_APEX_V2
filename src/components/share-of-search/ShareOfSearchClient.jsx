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
import CobaltLoader from "@/components/ui/CobaltLoader";
import { useCustomers } from "@/hooks/useCustomers";
import { getCobaltChartBaseOptions } from "@/lib/charts/cobaltChartTheme";
import { cn } from "@/lib/utils";
import {
    getCountrySelectOptions,
    isWorldwideGeoValue,
    matchCountryOption,
} from "@/lib/countrySelectOptions";

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

const CHART_COLORS = ["#213b34", "#3d6b5e", "#5c756a", "#7a9489", "#2d4a42", "#a8bdb6", "#60a5fa"];

const COUNTRY_SELECT_STYLES = {
    control: (base, state) => ({
        ...base,
        minHeight: 40,
        borderRadius: 6,
        borderColor: state.isFocused ? "#213b34" : "#a8bdb6",
        boxShadow: state.isFocused ? "0 0 0 1px #213b34" : "none",
        fontSize: "0.875rem",
        backgroundColor: "#ffffff",
        "&:hover": { borderColor: "#d4ddd9" },
    }),
    menu: (base) => ({ ...base, zIndex: 50, backgroundColor: "#ffffff" }),
    option: (base, state) => ({
        ...base,
        fontSize: "0.875rem",
        backgroundColor: state.isSelected
            ? "#213b34"
            : state.isFocused
              ? "#e2e9e6"
              : "#ffffff",
        color: state.isSelected ? "#f4f7f6" : "#213b34",
    }),
    singleValue: (base) => ({ ...base, color: "#213b34" }),
    input: (base) => ({ ...base, color: "#213b34" }),
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

/** Per month: each series value becomes integer % of the sum of selected series that month. */
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
            s.data[j] = sum > 0 ? Math.round((v / sum) * 100) : 0;
        }
    }
    return out;
}


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
    /** stacked area (default) vs overlapping lines */
    const [chartVisualMode, setChartVisualMode] = useState("stacked");

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

        const stacked = chartVisualMode === "stacked";
        const formatYAxis = (val) =>
            isShare
                ? `${Math.round(Number(val))}%`
                : typeof val === "number" && val >= 1000
                  ? `${Math.round(val / 1000)}k`
                  : String(Math.round(Number(val) || 0));
        const formatTooltipY = (val) =>
            isShare
                ? `${Math.round(Number(val))}%`
                : typeof val === "number"
                  ? Math.round(val).toLocaleString()
                  : val;

        const cobaltBase = getCobaltChartBaseOptions();
        const options = {
            ...cobaltBase,
            chart: {
                ...cobaltBase.chart,
                toolbar: { show: false },
                zoom: { enabled: false },
                stacked,
            },
            stroke: { width: 2, curve: "smooth" },
            ...(stacked
                ? {
                      fill: { type: "solid", opacity: 0.72 },
                  }
                : {}),
            markers: { size: stacked ? 0 : 2, hover: { size: stacked ? 5 : 6 } },
            xaxis: {
                ...cobaltBase.xaxis,
                categories,
            },
            legend: { ...cobaltBase.legend, position: "top" },
            colors: seriesColors,
            dataLabels: { enabled: false },
            yaxis: {
                ...cobaltBase.yaxis,
                min: isShare ? 0 : undefined,
                max: isShare ? 100 : undefined,
                labels: {
                    ...cobaltBase.yaxis?.labels,
                    formatter: formatYAxis,
                },
            },
            tooltip: {
                ...cobaltBase.tooltip,
                y: {
                    formatter: formatTooltipY,
                },
            },
        };
        return { chartSeries: series, chartOptions: options, chartTitle: title };
    }, [categories, brandLineSeries, selectedChartKeys, chartDisplayMode, chartVisualMode, metricsRows]);

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
            countryCode: isWorldwideGeoValue(geoLabel) ? null : geoLabel,
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
        <div id="ShareOfSearchPage" className="cobalt-perf w-full apex-sos-stack" data-theme="cobalt">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
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
                        variant="cobalt"
                        usePortal
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

            <section className="apex-sos-setup">
                <div>
                    <label className="apex-sos-field__label">Brands</label>
                    <div className="apex-sos-brand-list">
                        {brands.map((b) => (
                            <span key={b} className="apex-sos-brand-chip">
                                {b}
                                <button
                                    type="button"
                                    className="apex-sos-brand-chip__remove"
                                    onClick={() => removeBrand(b)}
                                    aria-label={`Remove ${b}`}
                                >
                                    <FiTrash2 className="w-3.5 h-3.5" />
                                </button>
                            </span>
                        ))}
                    </div>
                    <div className="apex-sos-add-row">
                        <input
                            type="text"
                            className="apex-sos-input"
                            placeholder="Add brand name…"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    addBrand();
                                }
                            }}
                        />
                        <button
                            type="button"
                            className="apex-sos-btn apex-sos-btn--primary apex-sos-btn--icon"
                            onClick={addBrand}
                            aria-label="Add brand"
                        >
                            <FiPlus className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="apex-sos-setup__row">
                    <div className="flex-1 min-w-0">
                        <label className="apex-sos-field__label" htmlFor="sos-country">
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
                    <div className="apex-sos-setup__actions">
                        <button
                            type="button"
                            className="apex-sos-btn"
                            disabled={loading || (brands.length === 0 && !draft.trim())}
                            onClick={clearBrands}
                        >
                            Clear
                        </button>
                        <button
                            type="button"
                            className="apex-sos-btn apex-sos-btn--primary"
                            disabled={loading || brands.length === 0}
                            onClick={fetchMetrics}
                        >
                            <FiRefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                            Fetch data
                        </button>
                    </div>
                </div>

                {error && <p className="apex-sos-alert">{error}</p>}
            </section>

            {metricsRows && metricsRows.length > 0 && (
                <>
                    <section>
                        <h3 className="apex-sos-section__label">Brand metrics</h3>
                        <div className="apex-sos-kpi-grid">
                        {chartDisplayMode === "volume" && (
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={() => toggleChartKey("__total__")}
                                onKeyDown={(e) =>
                                    (e.key === "Enter" || e.key === " ") && toggleChartKey("__total__")
                                }
                                className="apex-sos-kpi-card"
                            >
                                <MetricCard
                                    variant="cobalt"
                                    label="Total search volume"
                                    value={totalVolume.toLocaleString()}
                                    icon={<FiLayers />}
                                    isActive={selectedChartKeys.includes("__total__")}
                                    comparisonMethod={null}
                                    hideIconBackdrop
                                    className="h-full"
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
                                className="apex-sos-kpi-card"
                            >
                                <MetricCard
                                    variant="cobalt"
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
                                    className="h-full"
                                />
                            </div>
                        ))}
                        </div>
                    </section>

                    <section>
                        <h3 className="apex-sos-section__label">Trend chart</h3>
                        <div className="apex-sos-chart-block">
                        <div className="apex-sos-tab-group">
                            <button
                                type="button"
                                className={cn("apex-sos-tab", chartDisplayMode === "share" && "is-active")}
                                onClick={() => handleChartModeChange("share")}
                            >
                                Share of search
                            </button>
                            <button
                                type="button"
                                className={cn("apex-sos-tab", chartDisplayMode === "volume" && "is-active")}
                                onClick={() => handleChartModeChange("volume")}
                            >
                                Search volume
                            </button>
                            <span className="apex-sos-tab-divider hidden sm:block" aria-hidden />
                            <button
                                type="button"
                                className={cn("apex-sos-tab", chartVisualMode === "stacked" && "is-active")}
                                onClick={() => setChartVisualMode("stacked")}
                            >
                                Stacked
                            </button>
                            <button
                                type="button"
                                className={cn("apex-sos-tab", chartVisualMode === "lines" && "is-active")}
                                onClick={() => setChartVisualMode("lines")}
                            >
                                Lines
                            </button>
                        </div>
                        {loading ? (
                            <div className="apex-sos-chart-empty">
                                <CobaltLoader variant="inline" title="Loading chart data" />
                            </div>
                        ) : chartSeries.length > 0 ? (
                            <GraphCard
                                variant="cobalt"
                                key={`sos-chart-${chartVisualMode}`}
                                title={chartTitle}
                                chartType={chartVisualMode === "stacked" ? "area" : "line"}
                                chartOptions={chartOptions}
                                chartSeries={chartSeries}
                                height={360}
                                hideChartToggle
                            />
                        ) : (
                            <p className="apex-sos-chart-empty">
                                Select at least one metric to show the chart.
                            </p>
                        )}
                        </div>
                    </section>

                    <section className="apex-sos-table-panel">
                        <div className="apex-sos-table-panel__head">
                            <h3 className="apex-sos-table-panel__title">Results</h3>
                            <p className="apex-sos-table-panel__subtitle">
                                Keyword Planner volumes and share for the selected period.
                            </p>
                        </div>
                        <div className="apex-sos-table-wrap">
                        <table className="apex-sos-table">
                            <thead>
                                <tr>
                                    <th>Brand</th>
                                    <th>Keyword (API)</th>
                                    <th className="is-num">Volume in range</th>
                                    <th className="is-num">Share</th>
                                </tr>
                            </thead>
                            <tbody>
                                {metricsRows.map((r) => (
                                    <tr key={r.brand}>
                                        <td className="is-brand">{r.brand}</td>
                                        <td className="is-muted">{r.apiKeywordText}</td>
                                        <td className="is-num">
                                            {Number(r.volumeInRange || 0).toLocaleString()}
                                        </td>
                                        <td className="is-num">{r.sharePct}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    </section>
                </>
            )}

            <section className="apex-sos-table-panel">
                <div className="apex-sos-table-panel__head">
                    <h2 className="apex-sos-table-panel__title">History</h2>
                    <p className="apex-sos-table-panel__subtitle">
                        Previously saved searches. Load one to restore settings and results, or delete it.
                    </p>
                </div>
                {historyLoading ? (
                    <div className="apex-sos-loading">
                        <CobaltLoader variant="inline" title="Loading history" />
                    </div>
                ) : history.length === 0 ? (
                    <p className="apex-sos-empty">No saved searches yet. Fetch data to create one.</p>
                ) : (
                    <div className="apex-sos-table-wrap">
                        <table className="apex-sos-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Brands</th>
                                    <th>Country</th>
                                    <th>Period</th>
                                    <th className="is-num">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((h) => (
                                    <tr key={String(h._id)}>
                                        <td className="whitespace-nowrap">
                                            {h.createdAt
                                                ? dayjs(h.createdAt).format("YYYY-MM-DD HH:mm")
                                                : "—"}
                                        </td>
                                        <td>{(h.brands || []).join(", ")}</td>
                                        <td>{h.geoLabel}</td>
                                        <td className="is-muted whitespace-nowrap">
                                            {h.startDate} → {h.endDate}
                                        </td>
                                        <td className="is-num">
                                            <div className="apex-sos-table__actions">
                                                <button
                                                    type="button"
                                                    className="apex-sos-btn apex-sos-btn--sm"
                                                    onClick={() => reuseSnapshot(h)}
                                                >
                                                    <FiRotateCcw className="w-3.5 h-3.5" />
                                                    Load
                                                </button>
                                                <button
                                                    type="button"
                                                    className="apex-sos-btn apex-sos-btn--sm apex-sos-btn--danger"
                                                    disabled={deletingId === String(h._id)}
                                                    onClick={() => deleteSnapshot(h._id)}
                                                >
                                                    {deletingId === String(h._id) ? (
                                                        <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <FiTrash2 className="w-3.5 h-3.5" />
                                                    )}
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
