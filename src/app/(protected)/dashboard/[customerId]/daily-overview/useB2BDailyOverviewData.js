import { useCallback, useEffect, useMemo, useState } from "react";
import { buildB2BDailyRows } from "@/lib/b2bDashboard/buildB2BDailyRows";
import {
    adSpendChannelsForDashboard,
    AD_SPEND_DAILY_COLUMN_KEYS,
} from "@/lib/mergeAdSpendDaily";
import { DEFAULT_B2B_VISIBLE_METRICS } from "./b2bMetricConfig";

function getPreviousPeriodRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - days + 1);
    const fmt = (d) => d.toISOString().slice(0, 10);
    return { startDate: fmt(prevStart), endDate: fmt(prevEnd) };
}

export function useB2BDailyOverviewData(customer, appliedDateRange, querySuffix = "") {
    const [rows, setRows] = useState([]);
    const [rowsPrev, setRowsPrev] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [visibleMarketingColumnKeys, setVisibleMarketingColumnKeys] = useState([]);

    const fetchData = useCallback(async () => {
        if (!customer?._id) return;
        setLoading(true);
        setError("");
        try {
            const prevRange = getPreviousPeriodRange(
                appliedDateRange.startDate,
                appliedDateRange.endDate
            );
            const qs = new URLSearchParams({
                startDate: appliedDateRange.startDate,
                endDate: appliedDateRange.endDate,
                compareStartDate: prevRange.startDate,
                compareEndDate: prevRange.endDate,
                source: "daily-overview",
            });
            const suffix = querySuffix?.replace(/^\?/, "") || "";
            if (suffix) {
                suffix.split("&").forEach((part) => {
                    const [k, v] = part.split("=");
                    if (k) qs.set(k, decodeURIComponent(v || ""));
                });
            }

            const res = await fetch(`/api/b2b-dashboard/${customer._id}?${qs.toString()}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || "Failed to load daily data");

            const currentRows = buildB2BDailyRows(json.current);
            const prevRows = json.comparison ? buildB2BDailyRows(json.comparison) : [];

            setRows(currentRows);
            setRowsPrev(prevRows);

            const visibleChannels = adSpendChannelsForDashboard(
                { ...(customer.CustomerSettings || {}), customerType: customer.customerType },
                json.current,
                json.comparison
            );
            setVisibleMarketingColumnKeys(
                visibleChannels.map((c) => c.dailyOverviewColumnKey).filter(Boolean)
            );
        } catch (e) {
            setError(e?.message || "Unexpected error");
            setRows([]);
            setRowsPrev([]);
        } finally {
            setLoading(false);
        }
    }, [customer, appliedDateRange, querySuffix]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const visibleColumnKeys = useMemo(() => {
        const base = DEFAULT_B2B_VISIBLE_METRICS.filter((key) => {
            if (AD_SPEND_DAILY_COLUMN_KEYS.includes(key)) {
                return visibleMarketingColumnKeys.includes(key);
            }
            return true;
        });
        return base;
    }, [visibleMarketingColumnKeys]);

    return {
        rows,
        rowsPrev,
        loading,
        error,
        visibleColumnKeys,
        ga4Configured: rows.length > 0 || !loading,
    };
}
