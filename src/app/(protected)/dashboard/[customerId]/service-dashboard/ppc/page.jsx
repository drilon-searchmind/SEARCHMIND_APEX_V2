

"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import MetricCard from "@/components/dashboard/MetricCard";
import GraphCard from "@/components/dashboard/GraphCard";
import Spinner from "@/components/ui/Spinner";
import { FiDollarSign, FiTrendingUp, FiBarChart2, FiPieChart, FiShoppingCart, FiEye, FiMousePointer, FiPercent, FiArrowDownRight } from "react-icons/fi";
import { useCustomers } from "@/hooks/useCustomers";
import dayjs from "dayjs";

const METRIC_OPTIONS = [
  { key: "conversion_value", label: "Conv. Value", icon: FiDollarSign },
  { key: "ad_spend", label: "Adspend", icon: FiTrendingUp },
  { key: "roas", label: "ROAS", icon: FiBarChart2 },
  { key: "aov", label: "AOV", icon: FiPieChart },
  { key: "conversions", label: "Conversions", icon: FiShoppingCart },
  { key: "impressions", label: "Impressions", icon: FiEye },
  { key: "clicks", label: "Clicks", icon: FiMousePointer },
  { key: "ctr", label: "CTR", icon: FiPercent },
  { key: "cpc", label: "CPC", icon: FiArrowDownRight },
  { key: "conv_rate", label: "Conv Rate", icon: FiPercent },
];

export default function GoogleAdsPPCPage() {
  const params = useParams();
  const { customers } = useCustomers();
  const customer = customers.find((c) => c._id === params.customerId);

  // Date range state
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const defaultEnd = `${yyyy}-${mm}-${dd}`;
  const defaultStart = `${yyyy}-${mm}-01`;
  const [dateRange, setDateRange] = useState({ startDate: defaultStart, endDate: defaultEnd });

  // Handlers for DateRangePicker (controlled)
  const handleDateRangeApply = ({ startDate, endDate }) => {
    setDateRange({ startDate, endDate });
  };
  const handleStartDateChange = (newStart) => {
    setDateRange((dr) => ({ ...dr, startDate: newStart }));
  };
  const handleEndDateChange = (newEnd) => {
    setDateRange((dr) => ({ ...dr, endDate: newEnd }));
  };

  // Google Ads data state
  const [metricsByDate, setMetricsByDate] = useState([]);
  const [topCampaigns, setTopCampaigns] = useState([]);
  const [campaignsByDate, setCampaignsByDate] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState("conversion_value");

  useEffect(() => {
    if (!customer) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
        // Fetch customer settings for Google Ads customer ID
        const res = await fetch(`${baseUrl}/api/customers/${customer._id}`);
        if (!res.ok) throw new Error("Failed to fetch customer settings");
        const settings = (await res.json()).CustomerSettings || {};
        const { googleAdsCustomerId } = settings;
        if (!googleAdsCustomerId) throw new Error("Missing Google Ads customer ID");

        // Fetch all Google Ads data via API route
        const apiUrl = `/api/google-ppc-dashboard?customerId=${encodeURIComponent(googleAdsCustomerId)}&startDate=${encodeURIComponent(dateRange.startDate)}&endDate=${encodeURIComponent(dateRange.endDate)}`;
        const ppcRes = await fetch(apiUrl);
        if (!ppcRes.ok) throw new Error("Failed to fetch Google Ads PPC dashboard metrics");
        const metrics = await ppcRes.json();
        setMetricsByDate(metrics.metrics_by_date || []);
        setTopCampaigns(metrics.top_campaigns || []);
        setCampaignsByDate(metrics.campaigns_by_date || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [customer, dateRange]);

  // Metrics cards (aggregate for period)
  const metrics = useMemo(() => {
    if (!metricsByDate.length) return [];
    const agg = (key) => {
      if (key === "conversion_value") {
        return metricsByDate.reduce((sum, row) => sum + (row.conversions_value || 0), 0);
      }
      if (key === "conversions") {
        return metricsByDate.reduce((sum, row) => sum + (row.conversions || 0), 0);
      }
      if (key === "aov") {
        const totalValue = metricsByDate.reduce((sum, row) => sum + (row.conversions_value || 0), 0);
        const totalConv = metricsByDate.reduce((sum, row) => sum + (row.conversions || 0), 0);
        return totalConv > 0 ? totalValue / totalConv : null;
      }
      if (key === "roas") {
        const totalSpend = metricsByDate.reduce((sum, row) => sum + (row.ad_spend || 0), 0);
        const totalValue = metricsByDate.reduce((sum, row) => sum + (row.conversions_value || 0), 0);
        return totalSpend > 0 ? totalValue / totalSpend : null;
      }
      if (key === "ctr") {
        const totalImpr = metricsByDate.reduce((sum, row) => sum + (row.impressions || 0), 0);
        const totalClicks = metricsByDate.reduce((sum, row) => sum + (row.clicks || 0), 0);
        return totalImpr > 0 ? totalClicks / totalImpr : null;
      }
      if (key === "cpc") {
        const totalSpend = metricsByDate.reduce((sum, row) => sum + (row.ad_spend || 0), 0);
        const totalClicks = metricsByDate.reduce((sum, row) => sum + (row.clicks || 0), 0);
        return totalClicks > 0 ? totalSpend / totalClicks : null;
      }
      if (key === "conv_rate") {
        const totalClicks = metricsByDate.reduce((sum, row) => sum + (row.clicks || 0), 0);
        const totalConv = metricsByDate.reduce((sum, row) => sum + (row.conversions || 0), 0);
        return totalClicks > 0 ? totalConv / totalClicks : null;
      }
      // Default: sum
      return metricsByDate.reduce((sum, row) => sum + (row[key] || 0), 0);
    };
    return METRIC_OPTIONS.map(opt => ({
      label: opt.label,
      value: agg(opt.key),
    }));
  }, [metricsByDate]);

  // Graph data for selected metric
  const chartCategories = metricsByDate.map(row => row.date);
  const chartSeries = [{
    name: METRIC_OPTIONS.find(opt => opt.key === selectedMetric)?.label || "Metric",
    data: metricsByDate.map(row => {
      let val;
      if (selectedMetric === "conversion_value") val = row.conversions_value;
      else val = row[selectedMetric];
      if (typeof val === 'number' && !isNaN(val)) {
        return Number(val.toFixed(2));
      }
      return val ?? null;
    }),
  }];
  const chartOptions = {
    chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Outfit, sans-serif' },
    xaxis: { categories: chartCategories },
    yaxis: {},
    colors: ["#406969"],
    stroke: { width: 2, curve: 'smooth' },
    fill: { type: 'solid', opacity: 1 },
    grid: { borderColor: '#e5e7eb', strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
    dataLabels: { enabled: false },
    tooltip: { theme: 'light' },
  };

  // Top campaigns table: sort by clicks desc
  const topCampaignsTable = useMemo(() => {
    if (!topCampaigns.length) return [];
    return topCampaigns;
  }, [topCampaigns]);

  return (
    <div className="w-full">
      <DashboardHeading
        title="Google Ads PPC Dashboard"
        label={customer ? customer.customerName : ""}
        right={
          <DateRangePicker
            onApply={handleDateRangeApply}
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            onStartDateChange={handleStartDateChange}
            onEndDateChange={handleEndDateChange}
          />
        }
      />

      {/* Metrics Cards Section */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 w-full mb-8">
        {loading ? (
          <div className="col-span-5 text-center"><Spinner size={40} color="#406969" /></div>
        ) : error ? (
          <div className="col-span-5 text-center text-red-500">{error}</div>
        ) : (
          metrics.map((metric, idx) => {
            const Icon = METRIC_OPTIONS.find(opt => opt.label === metric.label)?.icon;
            const isActive = selectedMetric === METRIC_OPTIONS[idx].key;
            return (
              <div
                key={idx}
                onClick={() => setSelectedMetric(METRIC_OPTIONS[idx].key)}
                style={{ cursor: 'pointer' }}
              >
                <MetricCard
                  label={metric.label}
                  value={
                    metric.value !== null && metric.value !== undefined
                      ? (typeof metric.value === "number" && !isNaN(metric.value)
                        ? (metric.label === "Conv. Value" || metric.label === "Adspend" || metric.label === "AOV" ? metric.value.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })
                          : metric.label === "CTR" || metric.label === "Conv Rate" ? `${(metric.value * 100).toFixed(2)}%`
                          : metric.label === "ROAS" ? metric.value.toFixed(2)
                          : metric.value.toLocaleString())
                        : metric.value)
                      : "-"
                  }
                  icon={Icon ? <Icon size={22} color={isActive ? '#fff' : undefined} /> : null}
                  isActive={isActive}
                />
              </div>
            );
          })
        )}
      </div>

      {/* Graph Section */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <span className="font-semibold">Metric:</span>
          <div className="flex gap-2">
            {METRIC_OPTIONS.map(opt => (
              <button
                key={opt.key}
                className={`px-3 py-1 rounded text-xs font-medium border transition-colors duration-150 ${selectedMetric === opt.key ? 'bg-white text-[var(--color-primary-searchmind)] border-[var(--color-primary-searchmind)] shadow-sm' : 'text-gray-500 border-gray-200 hover:text-[var(--color-primary-searchmind)]'}`}
                onClick={() => setSelectedMetric(opt.key)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-64"><Spinner size={40} color="#406969" /></div>
        ) : (
          <GraphCard title={METRIC_OPTIONS.find(opt => opt.key === selectedMetric)?.label || "Metric"} chartOptions={chartOptions} chartSeries={chartSeries} />
        )}
      </div>

      {/* Top Campaigns Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Top Performance Campaigns</h3>
        {loading ? (
          <div className="flex justify-center items-center min-h-[120px]"><Spinner size={40} color="#406969" /></div>
        ) : error ? (
          <div className="text-red-500 text-center">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left border-collapse" style={{ fontSize: '12px' }}>
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-1.5 font-semibold text-gray-700">Campaign</th>
                  <th className="px-3 py-1.5 font-semibold text-gray-700">Clicks</th>
                  <th className="px-3 py-1.5 font-semibold text-gray-700">Impressions</th>
                  <th className="px-3 py-1.5 font-semibold text-gray-700">CTR</th>
                </tr>
              </thead>
              <tbody className="text-[12px]">
                {topCampaignsTable.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-gray-400">No campaign data for selected range.</td></tr>
                ) : topCampaignsTable.map((row, idx) => {
                  const max = {
                    clicks: Math.max(...topCampaignsTable.map(r => Number(r.clicks) || 0)),
                    impressions: Math.max(...topCampaignsTable.map(r => Number(r.impressions) || 0)),
                    ctr: Math.max(...topCampaignsTable.map(r => Number(r.ctr) || 0)),
                  };
                  return (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-3 py-2 whitespace-nowrap">{row.campaign_name}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ ...(row.clicks > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.clicks / max.clicks)})` } : {}) }}>{row.clicks}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ ...(row.impressions > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.impressions / max.impressions)})` } : {}) }}>{row.impressions}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ ...(row.ctr > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.ctr / max.ctr)})` } : {}) }}>{row.ctr ? `${(Number(row.ctr) * 100).toFixed(2)}%` : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}