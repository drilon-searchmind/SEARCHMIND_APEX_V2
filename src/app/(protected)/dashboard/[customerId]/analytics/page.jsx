"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import Spinner from "@/components/ui/Spinner";
import MetricCards from "./components/MetricCards";
import TimeseriesChart from "./components/TimeseriesChart";
import TableCard from "./components/TableCard";
import ActiveUsersCard from "./components/ActiveUsersCard";
import AcquisitionChannelsChart from "./components/AcquisitionChannelsChart";
import SessionsByDeviceChart from "./components/SessionsByDeviceChart";

function defaultRange() {
    // Date range state
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');

    // If today is the 1st of the month, use 1st as both start and end
    // Otherwise, use 1st as start and yesterday as end
    const isFirstOfMonth = today.getDate() === 1;
    const defaultStart = `${yyyy}-${mm}-01`;
    const defaultEnd = isFirstOfMonth ? `${yyyy}-${mm}-01` : `${yyyy}-${mm}-${String(today.getDate() - 1).padStart(2, '0')}`;
    
    return {
        startDate: defaultStart,
        endDate: defaultEnd,
    };
}

function yyyymmddToIso(d) {
    if (!d) return d;
    if (d.includes("-")) return d;
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

function yyyymmToLabel(yyyymm) {
    if (!yyyymm || yyyymm.length !== 6) return yyyymm;
    const y = Number(yyyymm.slice(0, 4));
    const m = Number(yyyymm.slice(4, 6));
    const d = new Date(Date.UTC(y, m - 1, 1));
    return d.toLocaleString(undefined, { month: 'short' });
}

function mapReportToRows(json) {
    if (!json?.rows?.length) return [];
    const dimHeaders = json.dimensionHeaders?.map((h) => h.name) || [];
    const metHeaders = json.metricHeaders?.map((h) => h.name) || [];
    return json.rows.map((row) => {
        const dimObj = {};
        row.dimensionValues?.forEach((v, i) => {
            dimObj[dimHeaders[i]] = v.value;
        });
        const metObj = {};
        row.metricValues?.forEach((v, i) => {
            const key = metHeaders[i];
            const num = Number(v.value);
            metObj[key] = isNaN(num) ? v.value : num;
        });
        return { ...dimObj, ...metObj };
    });
}

export default function AnalyticsPage() {
    const params = useParams();
    const customerId = params.customerId;

    const defaultRangeValue = defaultRange();
    const [tempRange, setTempRange] = useState(defaultRangeValue);
    const [appliedRange, setAppliedRange] = useState(defaultRangeValue);
    const [selectedKeys, setSelectedKeys] = useState(["totalUsers"]);

    // Ensure at least one metric is always selected
    useEffect(() => {
        if (selectedKeys.length === 0) {
            setSelectedKeys(["totalUsers"]);
        }
    }, [selectedKeys]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [ga4PropertyId, setGa4PropertyId] = useState("");
    const [timeseries, setTimeseries] = useState([]);
    const [channels, setChannels] = useState([]);
    const [pages, setPages] = useState([]);
    const [acqCategories, setAcqCategories] = useState([]);
    const [acqSeries, setAcqSeries] = useState([]);
    const [deviceData, setDeviceData] = useState([]);

    const handleDateRangeApply = ({ startDate, endDate }) => {
        setAppliedRange({ startDate, endDate });
    };

    useEffect(() => {
        async function fetchCustomer() {
            if (!customerId) return;
            try {
                const res = await fetch(`/api/customers/${customerId}`);
                if (!res.ok) throw new Error('Failed to fetch customer');
                const data = await res.json();
                setGa4PropertyId(data?.CustomerSettings?.ga4PropertyId || "");
            } catch {
                setGa4PropertyId("");
            }
        }
        fetchCustomer();
    }, [customerId]);

    const fetchAll = useCallback(async () => {
        if (!ga4PropertyId) {
            // No property configured; clear data and skip fetch
            setTimeseries([]);
            setChannels([]);
            setPages([]);
            setError("");
            setAcqCategories([]);
            setAcqSeries([]);
            setDeviceData([]);
            return;
        }
        setLoading(true);
        setError("");
        try {
            const qs = (params) =>
                Object.entries(params)
                    .filter(([, v]) => v != null && v !== "")
                    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
                    .join("&");

            // Timeseries
            const tRes = await fetch(`/api/ga4?${qs({
                startDate: appliedRange.startDate,
                endDate: appliedRange.endDate,
                metrics: ["totalUsers", "screenPageViews", "bounceRate", "averageSessionDuration"].join(","),
                dimensions: "date",
                propertyId: ga4PropertyId,
                customerId,
            })}`);
            const tJson = await tRes.json();
            if (!tRes.ok) throw new Error(tJson?.error || "GA4 timeseries failed");
            const tRows = (tJson?.rows?.length ? mapReportToRows(tJson) : []).map((r) => ({
                date: yyyymmddToIso(r.date),
                totalUsers: Number(r.totalUsers) || 0,
                screenPageViews: Number(r.screenPageViews) || 0,
                bounceRate: Number(r.bounceRate) || 0,
                averageSessionDuration: Number(r.averageSessionDuration) || 0,
            }));

            // Top channels
            const cRes = await fetch(`/api/ga4?${qs({
                startDate: appliedRange.startDate,
                endDate: appliedRange.endDate,
                metrics: ["sessions", "totalUsers"].join(","),
                dimensions: "sessionDefaultChannelGroup",
                limit: 10,
                propertyId: ga4PropertyId,
            })}`);
            const cJson = await cRes.json();
            if (!cRes.ok) throw new Error(cJson?.error || "GA4 channels failed");
            const cRowsRaw = mapReportToRows(cJson);
            const cRows = cRowsRaw
                .map((r) => ({
                    source: r.sessionDefaultChannelGroup || "(not set)",
                    visitors: Number(r.totalUsers) || 0,
                    sessions: Number(r.sessions) || 0,
                }))
                .sort((a, b) => b.visitors - a.visitors)
                .slice(0, 5);

            // Top pages
            const pRes = await fetch(`/api/ga4?${qs({
                startDate: appliedRange.startDate,
                endDate: appliedRange.endDate,
                metrics: "screenPageViews",
                dimensions: "pageTitle",
                limit: 10,
                propertyId: ga4PropertyId,
                customerId,
            })}`);
            const pJson = await pRes.json();
            if (!pRes.ok) throw new Error(pJson?.error || "GA4 pages failed");
            const pRows = mapReportToRows(pJson)
                .map((r) => ({ source: r.pageTitle || "(not set)", pageviews: Number(r.screenPageViews) || 0 }))
                .sort((a, b) => b.pageviews - a.pageviews)
                .slice(0, 5);

            setTimeseries(tRows);
            setChannels(cRows);
            setPages(pRows);

            // Acquisition channels by month (stacked)
            const acqRes = await fetch(`/api/ga4?${qs({
                startDate: appliedRange.startDate,
                endDate: appliedRange.endDate,
                metrics: "sessions",
                dimensions: "yearMonth,sessionDefaultChannelGroup",
                limit: 1000,
                propertyId: ga4PropertyId,
                customerId,
            })}`);
            const acqJson = await acqRes.json();
            if (!acqRes.ok) throw new Error(acqJson?.error || "GA4 acquisition channels failed");
            const acqRows = mapReportToRows(acqJson);
            // Build month order
            const months = Array.from(new Set(acqRows.map(r => r.yearMonth))).sort();
            // Aggregate per channel per month
            const normalizeChannel = (n) => {
                if (!n) return "(not set)";
                if (n.toLowerCase().includes("social")) return "Social";
                return n;
            };
            const channelsSet = new Set(["Direct", "Referral", "Organic Search", "Social"]);
            // Ensure known channels exist
            const totalsByChannel = {};
            const mapByChannelMonth = {};
            months.forEach(m => { mapByChannelMonth[m] = {}; });
            acqRows.forEach(r => {
                const ch = normalizeChannel(r.sessionDefaultChannelGroup);
                const m = r.yearMonth;
                const v = Number(r.sessions) || 0;
                mapByChannelMonth[m][ch] = (mapByChannelMonth[m][ch] || 0) + v;
                totalsByChannel[ch] = (totalsByChannel[ch] || 0) + v;
            });
            const categories = months.map(yyyymmToLabel);
            const seriesOrder = ["Direct", "Referral", "Organic Search", "Social"]; // fixed order like mock
            const acqSer = seriesOrder.map(name => ({
                name,
                data: months.map(m => mapByChannelMonth[m][name] || 0),
            }));
            setAcqCategories(categories);
            setAcqSeries(acqSer);

            // Sessions by device (donut)
            const devRes = await fetch(`/api/ga4?${qs({
                startDate: appliedRange.startDate,
                endDate: appliedRange.endDate,
                metrics: "sessions",
                dimensions: "deviceCategory",
                limit: 100,
                propertyId: ga4PropertyId,
                customerId,
            })}`);
            const devJson = await devRes.json();
            if (!devRes.ok) throw new Error(devJson?.error || "GA4 devices failed");
            const devRows = mapReportToRows(devJson);
            const deviceOrder = ["desktop", "mobile", "tablet"];
            const mapDev = Object.fromEntries(devRows.map(r => [String(r.deviceCategory).toLowerCase(), Number(r.sessions) || 0]));
            const deviceDataArr = [
                { label: "Desktop", value: mapDev.desktop || 0 },
                { label: "Mobile", value: mapDev.mobile || 0 },
                { label: "Tablet", value: mapDev.tablet || 0 },
            ];
            setDeviceData(deviceDataArr);
        } catch (e) {
            setError(e?.message || "Unexpected error");
            setTimeseries([]);
            setChannels([]);
            setPages([]);
            setAcqCategories([]);
            setAcqSeries([]);
            setDeviceData([]);
        } finally {
            setLoading(false);
        }
    }, [appliedRange.startDate, appliedRange.endDate, ga4PropertyId, customerId]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const totals = useMemo(() => {
        if (!timeseries.length) return {};
        const sum = (key) => timeseries.reduce((a, b) => a + (Number(b[key]) || 0), 0);
        const avg = (key) => (timeseries.length ? sum(key) / timeseries.length : 0);
        return {
            totalUsers: sum("totalUsers"),
            screenPageViews: sum("screenPageViews"),
            bounceRate: avg("bounceRate"),
            averageSessionDuration: avg("averageSessionDuration"),
        };
    }, [timeseries]);

    return (
        <div className="w-full">
            <DashboardHeading
                title="Analytics"
                label={`Property ID: ${ga4PropertyId}` || 'No property set'}
                customerId={customerId}
                dateRange={appliedRange}
                loading={loading}
                dashboardType="analytics"
                dataSnapshot={{
                    timeseries,
                    channels,
                    pages,
                    acqCategories,
                    acqSeries,
                    deviceData,
                    totals,
                    selectedKeys,
                    ga4PropertyId
                }}
                right={
                    <DateRangePicker
                        onApply={handleDateRangeApply}
                        startDate={tempRange.startDate}
                        endDate={tempRange.endDate}
                        onStartDateChange={(d) => setTempRange((r) => ({ ...r, startDate: d }))}
                        onEndDateChange={(d) => setTempRange((r) => ({ ...r, endDate: d }))}
                    />
                }
            />

            {loading ? (
                <div className="flex justify-center items-center h-64"><Spinner size={48} /></div>
            ) : error ? (
                <div className="text-red-500 text-center py-8">{error}</div>
            ) : (
                <>
                    <MetricCards totals={totals} selectedKeys={selectedKeys} onSelect={setSelectedKeys} />
                    <div className="mb-8">
                        <TimeseriesChart rows={timeseries} selectedKeys={selectedKeys} />
                    </div>

                    {/* Acquisition & Devices */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <AcquisitionChannelsChart categories={acqCategories} series={acqSeries} />
                        <SessionsByDeviceChart data={deviceData} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <TableCard
                            title="Top Channels"
                            columns={[{ key: "source", label: "Source" }, { key: "visitors", label: "Visitors", align: "right" }]}
                            rows={channels.map((r) => ({ source: r.source, visitors: r.visitors.toLocaleString("da-DK") }))}
                        />
                        <TableCard
                            title="Top Pages"
                            columns={[{ key: "source", label: "Source" }, { key: "pageviews", label: "Pageviews", align: "right" }]}
                            rows={pages.map((r) => ({ source: r.source, pageviews: r.pageviews.toLocaleString("da-DK") }))}
                        />
                        <ActiveUsersCard rows={timeseries} />
                    </div>
                    {!ga4PropertyId && (
                        <div className="mt-6 text-center text-gray-500 text-sm">Set GA4 Property ID in Config to view analytics.</div>
                    )}
                </>
            )}
        </div>
    );
}