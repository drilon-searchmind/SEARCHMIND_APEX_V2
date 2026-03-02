"use client";

import React from "react";
import { METRIC_COLUMNS } from "@/app/(protected)/dashboard/[customerId]/daily-overview/metricConfig";

const COLORS = {
  primary: "#1E2B2B",
  primaryLighter: "#406969",
  secondary: "#D6CDB6",
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray600: "#4b5563",
  gray900: "#111827",
};

const fmt = (n, decimals = 0) => {
  if (n == null || n === undefined) return "—";
  const num = Number(n);
  if (isNaN(num)) return "—";
  return num.toLocaleString("da-DK", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
};

const fmtCurrency = (n) => {
  if (n == null || n === undefined) return "—";
  const num = Number(n);
  if (isNaN(num)) return "—";
  return `${num.toLocaleString("da-DK", { maximumFractionDigits: 0, minimumFractionDigits: 0 })} kr`;
};

export default function PdfReportContent({
  title,
  label,
  dateRange = {},
  comparisonMethod,
  dataSnapshot = {},
  dashboardType = "other",
}) {
  const { startDate, endDate } = dateRange;
  const dateRangeStr = startDate && endDate ? `${startDate} – ${endDate}` : "";

  const renderMetricsTable = (metrics) => {
    if (!Array.isArray(metrics) || metrics.length === 0) return null;
    return (
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
        <thead>
          <tr style={{ backgroundColor: COLORS.gray100 }}>
            <th style={thStyle}>Metric</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Value</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${COLORS.gray200}` }}>
              <td style={tdStyle}>{m.label}</td>
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>
                {typeof m.value === "number"
                  ? m.value % 1 !== 0
                    ? fmt(m.value, 2)
                    : fmt(m.value)
                  : m.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const thStyle = { padding: "8px 12px", fontSize: 11, color: COLORS.gray600, fontWeight: 600 };
  const tdStyle = { padding: "8px 12px", fontSize: 12, color: COLORS.gray900 };

  const PERFORMANCE_METRIC_KEYS = [
    { key: "revenue", label: "Net Revenue" },
    { key: "total_sales", label: "Total Sales" },
    { key: "cogs", label: "COGS" },
    { key: "gross_profit", label: "Net Profit" },
    { key: "returns", label: "Refunds" },
    { key: "orders", label: "Orders" },
    { key: "cost", label: "Cost" },
    { key: "fixed_costs", label: "Fixed Costs" },
    { key: "variable_costs", label: "Variable Costs" },
    { key: "ebit_pct", label: "EBIT%" },
    { key: "roas", label: "Blended ROAS" },
    { key: "poas", label: "Blended POAS" },
    { key: "aov", label: "Net AOV" },
    { key: "cac", label: "Blended CAC" },
  ];

  const renderPerformanceDashboard = () => {
    const { metrics = [], metricsData = {} } = dataSnapshot;
    const metricsMap = Object.fromEntries((metrics || []).map((m) => [m.key, m]));
    const rows = PERFORMANCE_METRIC_KEYS.map(({ key, label }) => {
      const m = metricsMap[key];
      const raw = metricsData[key];
      let value = m?.value;
      if (value != null && value !== "" && value !== "-") return { label, value };
      if (raw != null && !isNaN(Number(raw))) {
        if (["revenue", "total_sales", "cogs", "gross_profit", "returns", "cost", "fixed_costs", "variable_costs", "aov", "cac"].includes(key)) {
          value = fmtCurrency(raw);
        } else if (["roas", "poas"].includes(key)) {
          value = fmt(raw, 2);
        } else if (key === "ebit_pct") {
          value = `${fmt(raw, 1)}%`;
        } else if (key === "orders") {
          value = fmt(raw, 0);
        }
      }
      return { label, value: value ?? "—" };
    });
    return renderMetricsTable(rows);
  };

  const renderPpcDashboard = () => {
    const { metricsByDate, topCampaigns } = dataSnapshot;
    const sections = [];

    if (metricsByDate?.length > 0) {
      const totalValue = metricsByDate.reduce((s, r) => s + (r.conversions_value || 0), 0);
      const totalSpend = metricsByDate.reduce((s, r) => s + (r.ad_spend || 0), 0);
      const totalConv = metricsByDate.reduce((s, r) => s + (r.conversions || 0), 0);
      const totalImpr = metricsByDate.reduce((s, r) => s + (r.impressions || 0), 0);
      const totalClicks = metricsByDate.reduce((s, r) => s + (r.clicks || 0), 0);

      const roas = totalSpend > 0 ? totalValue / totalSpend : null;
      const aov = totalConv > 0 ? totalValue / totalConv : null;
      const ctr = totalImpr > 0 ? totalClicks / totalImpr : null;
      const cpc = totalClicks > 0 ? totalSpend / totalClicks : null;
      const convRate = totalClicks > 0 ? totalConv / totalClicks : null;

      const metricRows = [
        { label: "Conv. Value", value: fmtCurrency(totalValue) },
        { label: "Adspend", value: fmtCurrency(totalSpend) },
        { label: "ROAS", value: roas != null ? fmt(roas, 2) : "—" },
        { label: "AOV", value: aov != null ? fmtCurrency(aov) : "—" },
        { label: "Conversions", value: fmt(totalConv) },
        { label: "Impressions", value: fmt(totalImpr) },
        { label: "Clicks", value: fmt(totalClicks) },
        { label: "CTR", value: ctr != null ? `${(ctr * 100).toFixed(2)}%` : "—" },
        { label: "CPC", value: cpc != null ? fmtCurrency(cpc) : "—" },
        { label: "Conv Rate", value: convRate != null ? `${(convRate * 100).toFixed(2)}%` : "—" },
      ];
      sections.push(<div key="metrics">{renderMetricsTable(metricRows)}</div>);
    }

    const topCampaignsSorted = [...(topCampaigns || [])].sort((a, b) => (b.clicks || 0) - (a.clicks || 0)).slice(0, 10);
    if (topCampaignsSorted.length > 0) {
      sections.push(
        <div key="campaigns" style={{ marginTop: 24 }}>
          <h3 style={h3Style}>Top Performance Campaigns</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 10 }}>
            <thead>
              <tr style={{ backgroundColor: COLORS.gray100 }}>
                <th style={thStyle}>Campaign</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Clicks</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Impressions</th>
                <th style={{ ...thStyle, textAlign: "right" }}>CTR</th>
              </tr>
            </thead>
            <tbody>
              {topCampaignsSorted.map((r, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${COLORS.gray200}` }}>
                  <td style={tdStyle}>{r.campaign_name || r.name || "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(r.clicks)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(r.impressions)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{r.ctr != null ? `${(Number(r.ctr) * 100).toFixed(2)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return sections.length ? sections : <p style={pStyle}>No PPC data available.</p>;
  };

  const renderPsDashboard = () => {
    const { fbMetricsByDate, fbTopCampaigns } = dataSnapshot;
    const sections = [];

    if (fbMetricsByDate?.length > 0) {
      const totalValue = fbMetricsByDate.reduce((s, r) => s + (r.conversion_value || 0), 0);
      const totalSpend = fbMetricsByDate.reduce((s, r) => s + (r.ad_spend || 0), 0);
      const totalConv = fbMetricsByDate.reduce((s, r) => s + (r.conversions || 0), 0);
      const totalImpr = fbMetricsByDate.reduce((s, r) => s + (r.impressions || 0), 0);
      const totalClicks = fbMetricsByDate.reduce((s, r) => s + (r.clicks || 0), 0);

      const roas = totalSpend > 0 ? totalValue / totalSpend : null;
      const aov = totalConv > 0 ? totalValue / totalConv : null;
      const ctr = totalImpr > 0 ? (totalClicks / totalImpr) * 100 : null;
      const cpc = totalClicks > 0 ? totalSpend / totalClicks : null;
      const cpm = totalImpr > 0 ? (totalSpend / totalImpr) * 1000 : null;

      const metricRows = [
        { label: "Conv. Value", value: fmtCurrency(totalValue) },
        { label: "Ad spend", value: fmtCurrency(totalSpend) },
        { label: "ROAS", value: roas != null ? fmt(roas, 2) : "—" },
        { label: "AOV", value: aov != null ? fmtCurrency(aov) : "—" },
        { label: "Conversions", value: fmt(totalConv) },
        { label: "Impressions", value: fmt(totalImpr) },
        { label: "Clicks", value: fmt(totalClicks) },
        { label: "CTR", value: ctr != null ? `${ctr.toFixed(2)}%` : "—" },
        { label: "CPC", value: cpc != null ? fmtCurrency(cpc) : "—" },
        { label: "CPM", value: cpm != null ? fmtCurrency(cpm) : "—" },
      ];
      sections.push(<div key="metrics">{renderMetricsTable(metricRows)}</div>);
    }

    const topCampaignsSorted = [...(fbTopCampaigns || [])].sort((a, b) => (b.clicks || 0) - (a.clicks || 0)).slice(0, 10);
    if (topCampaignsSorted.length > 0) {
      sections.push(
        <div key="campaigns" style={{ marginTop: 24 }}>
          <h3 style={h3Style}>Top Performance Campaigns</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 10 }}>
            <thead>
              <tr style={{ backgroundColor: COLORS.gray100 }}>
                <th style={thStyle}>Campaign</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Clicks</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Impressions</th>
                <th style={{ ...thStyle, textAlign: "right" }}>CTR</th>
              </tr>
            </thead>
            <tbody>
              {topCampaignsSorted.map((r, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${COLORS.gray200}` }}>
                  <td style={tdStyle}>{r.campaign_name || r.name || "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(r.clicks)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(r.impressions)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{r.ctr != null ? `${(Number(r.ctr) * 100).toFixed(2)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return sections.length ? sections : <p style={pStyle}>No PS data available.</p>;
  };

  const renderPnlReport = () => {
    const d = dataSnapshot;
    const sections = [];

    const netTurnoverRows = [
      { label: "Gross turnover", value: d.grossSales != null ? fmtCurrency(d.grossSales) : "—" },
      { label: "Discounts", value: d.discounts != null ? fmtCurrency(d.discounts) : "—" },
      { label: "Refunds", value: d.refunds != null ? fmtCurrency(d.refunds) : "—" },
      { label: "Delivery Fees", value: d.deliveryFees != null ? fmtCurrency(d.deliveryFees) : "—" },
      { label: "Taxes", value: d.taxes != null ? fmtCurrency(d.taxes) : "—" },
      { label: "Total Sales", value: d.totalSalesDisplay != null ? fmtCurrency(d.totalSalesDisplay) : "—" },
      { label: "Net Sales", value: d.totalSales != null ? fmtCurrency(d.totalSales) : "—" },
    ];
    sections.push(
      <div key="net-turnover" style={{ marginTop: 12 }}>
        <h3 style={h3Style}>Net turnover (turnover - discount & return)</h3>
        {renderMetricsTable(netTurnoverRows)}
      </div>
    );

    const db1Rows = [
      { label: "COGS", value: d.cogs != null ? fmtCurrency(d.cogs) : "—" },
      { label: "Total, DB1", value: d.db1 != null ? fmtCurrency(d.db1) : "—" },
    ];
    sections.push(
      <div key="db1" style={{ marginTop: 24 }}>
        <h3 style={h3Style}>DB1 (turnover - cost of goods sold)</h3>
        {renderMetricsTable(db1Rows)}
      </div>
    );

    const db2Rows = [
      { label: "Shipping", value: d.shipping != null ? fmtCurrency(d.shipping) : "—" },
      { label: "Transaction Costs", value: d.transactionCosts != null ? fmtCurrency(d.transactionCosts) : "—" },
      { label: "Total, DB2", value: d.db2 != null ? fmtCurrency(d.db2) : "—" },
    ];
    sections.push(
      <div key="db2" style={{ marginTop: 24 }}>
        <h3 style={h3Style}>DB2 (DB1 - direct selling costs)</h3>
        {renderMetricsTable(db2Rows)}
      </div>
    );

    const db3Rows = [
      { label: "Marketing Spend", value: d.marketingSpend != null ? fmtCurrency(d.marketingSpend) : "—" },
      { label: "Marketing Bureau", value: d.marketingBureau != null ? fmtCurrency(d.marketingBureau) : "—" },
      { label: "Marketing Tooling", value: d.marketingTooling != null ? fmtCurrency(d.marketingTooling) : "—" },
      { label: "Total, DB3", value: d.db3 != null ? fmtCurrency(d.db3) : "—" },
    ];
    sections.push(
      <div key="db3" style={{ marginTop: 24 }}>
        <h3 style={h3Style}>DB3 (DB2 - marketing costs)</h3>
        {renderMetricsTable(db3Rows)}
      </div>
    );

    const resultRows = [
      { label: "Fixed Expenses", value: d.fixedExpenses != null ? fmtCurrency(d.fixedExpenses) : "—" },
      { label: "Result", value: d.result != null ? fmtCurrency(d.result) : "—" },
    ];
    sections.push(
      <div key="result" style={{ marginTop: 24 }}>
        <h3 style={h3Style}>Result</h3>
        {renderMetricsTable(resultRows)}
      </div>
    );

    const roasRows = [
      { label: "Realized ROAS", value: d.realizedROAS != null ? fmt(d.realizedROAS, 2) : "—" },
      { label: "Breakeven ROAS", value: d.breakEvenROAS != null ? fmt(d.breakEvenROAS, 2) : "—" },
    ];
    sections.push(
      <div key="roas" style={{ marginTop: 24 }}>
        {renderMetricsTable(roasRows)}
      </div>
    );

    return sections;
  };

  const renderPaceReport = () => {
    const { paceAnalysis, conversionBudget, conversionPaceAnalysis } = dataSnapshot;
    const sections = [];

    const spendRows = [];
    if (paceAnalysis) {
      spendRows.push({ label: "Pace", value: paceAnalysis.pace != null ? fmt(paceAnalysis.pace, 2) : "—" });
      spendRows.push({ label: "Budget", value: paceAnalysis.budget != null ? fmtCurrency(paceAnalysis.budget) : "—" });
      spendRows.push({ label: "Actual Spend to Date", value: paceAnalysis.actualSpendToDate != null ? fmtCurrency(paceAnalysis.actualSpendToDate) : "—" });
      spendRows.push({ label: "Ideal Spend to Date", value: paceAnalysis.idealSpendToDate != null ? fmtCurrency(paceAnalysis.idealSpendToDate) : "—" });
      spendRows.push({ label: "Suggested Daily Adjustment", value: paceAnalysis.suggestedDailyAdjustment != null ? fmtCurrency(paceAnalysis.suggestedDailyAdjustment) : "—" });
      spendRows.push({ label: "Total Days", value: paceAnalysis.totalDays != null ? fmt(paceAnalysis.totalDays) : "—" });
    }
    if (spendRows.length > 0) {
      sections.push(
        <div key="spend" style={{ marginTop: 12 }}>
          <h3 style={h3Style}>Spend Pace</h3>
          {renderMetricsTable(spendRows)}
        </div>
      );
    }

    const revenueRows = [];
    const revBudget = conversionBudget ?? conversionPaceAnalysis?.budget;
    if (revBudget != null || conversionPaceAnalysis) {
      revenueRows.push({ label: "Revenue Target (Conversion Budget)", value: revBudget != null ? fmtCurrency(revBudget) : "—" });
      revenueRows.push({ label: "Actual Revenue to Date", value: conversionPaceAnalysis?.actualValueToDate != null ? fmtCurrency(conversionPaceAnalysis.actualValueToDate) : "—" });
      revenueRows.push({ label: "Total Days", value: conversionPaceAnalysis?.totalDays != null ? fmt(conversionPaceAnalysis.totalDays) : "—" });
    }
    if (revenueRows.length > 0) {
      sections.push(
        <div key="revenue" style={{ marginTop: 24 }}>
          <h3 style={h3Style}>Revenue Pace</h3>
          {renderMetricsTable(revenueRows)}
        </div>
      );
    }

    return sections.length ? sections : <p style={pStyle}>No pace data available.</p>;
  };

  const formatDailyCell = (row, key) => {
    const fixedExpense = row.fixedExpense ?? 0;
    const netProfit = (row.netRevenue ?? 0) - (row.cogs || 0);
    const valMap = {
      orders: row.orders,
      totalSales: row.totalSales,
      netRevenue: row.netRevenue,
      cogs: row.cogs,
      aov: row.aov,
      ppcCost: row.ppcCost,
      psCost: row.psCost,
      roas: row.roas,
      variableExpense: row.variableExpense,
      fixedExpenses: fixedExpense,
      poas: row.poas,
      netProfit,
    };
    const v = valMap[key];
    if (v == null || (typeof v === "number" && isNaN(v))) return "—";
    if (["totalSales", "netRevenue", "cogs", "aov", "ppcCost", "psCost", "variableExpense", "fixedExpenses", "netProfit"].includes(key)) {
      return fmtCurrency(v);
    }
    if (["roas", "poas"].includes(key)) return fmt(v, 2);
    return fmt(v);
  };

  const computeDailyTotals = (rows) => {
    if (!rows?.length) return null;
    const totalOrders = rows.reduce((s, r) => s + r.orders, 0);
    const totalNetRevenue = rows.reduce((s, r) => s + (r.netRevenue ?? 0), 0);
    const totalCogs = rows.reduce((s, r) => s + (r.cogs || 0), 0);
    const totalPpcCost = rows.reduce((s, r) => s + r.ppcCost, 0);
    const totalPsCost = rows.reduce((s, r) => s + r.psCost, 0);
    const totalCost = totalPpcCost + totalPsCost;
    const totalVariableExpense = rows.reduce((s, r) => s + (r.variableExpense || 0), 0);
    const totalFixedExpenses = rows.reduce((s, r) => s + (r.fixedExpense || 0), 0);
    const grossProfit = totalNetRevenue - totalCogs;
    return {
      orders: fmt(totalOrders),
      totalSales: fmtCurrency(rows.reduce((s, r) => s + (r.totalSales ?? 0), 0)),
      netRevenue: fmtCurrency(totalNetRevenue),
      cogs: fmtCurrency(totalCogs),
      aov: totalOrders > 0 ? fmtCurrency(totalNetRevenue / totalOrders) : "—",
      ppcCost: fmtCurrency(totalPpcCost),
      psCost: fmtCurrency(totalPsCost),
      roas: totalCost > 0 ? fmt(totalNetRevenue / totalCost, 2) : "—",
      variableExpense: fmtCurrency(totalVariableExpense),
      fixedExpenses: fmtCurrency(totalFixedExpenses),
      poas: totalCost > 0 ? fmt(grossProfit / totalCost, 2) : "—",
      netProfit: fmtCurrency(totalNetRevenue - totalCogs),
    };
  };

  const dailyThStyle = { padding: "3px 4px", fontSize: 8, color: COLORS.gray600, fontWeight: 600 };
  const dailyTdStyle = { padding: "3px 4px", fontSize: 8, color: COLORS.gray900 };

  const renderDailyTable = (rows, title, isFirst) => {
    if (!rows?.length) return null;
    const totals = computeDailyTotals(rows);
    return (
      <div key={title} style={{ marginTop: isFirst ? 12 : 24 }}>
        {title && <h3 style={{ ...h3Style, fontSize: 11 }}>{title}</h3>}
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6, fontSize: 8, tableLayout: "fixed" }}>
          <thead>
            <tr style={{ backgroundColor: COLORS.gray100 }}>
              <th style={dailyThStyle}>Date</th>
              {METRIC_COLUMNS.map(({ key, label }) => (
                <th key={key} style={{ ...dailyThStyle, textAlign: "right" }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${COLORS.gray200}` }}>
                <td style={dailyTdStyle}>{row.date || "—"}</td>
                {METRIC_COLUMNS.map(({ key }) => (
                  <td key={key} style={{ ...dailyTdStyle, textAlign: "right" }}>
                    {formatDailyCell(row, key)}
                  </td>
                ))}
              </tr>
            ))}
            {totals && (
              <tr style={{ backgroundColor: COLORS.gray100, fontWeight: 600 }}>
                <td style={dailyTdStyle}>Total</td>
                {METRIC_COLUMNS.map(({ key }) => (
                  <td key={key} style={{ ...dailyTdStyle, textAlign: "right" }}>
                    {totals[key]}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderDailyOverview = () => {
    const { dailyRows, lastYearRows } = dataSnapshot;
    const hasDaily = dailyRows && dailyRows.length > 0;
    const hasLastYear = lastYearRows && lastYearRows.length > 0;
    if (!hasDaily && !hasLastYear) return <p style={pStyle}>No daily data available.</p>;
    return (
      <>
        {hasDaily && renderDailyTable(dailyRows, "Daily Metrics", true)}
        {hasLastYear && renderDailyTable(lastYearRows, "Last Year Period", !hasDaily)}
      </>
    );
  };

  const renderEcommerce = () => {
    const { products, segmentation } = dataSnapshot;
    const sections = [];
    if (products?.length > 0) {
      sections.push(
        <div key="products" style={{ marginTop: 12 }}>
          <h3 style={h3Style}>Top Products</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 10 }}>
            <thead>
              <tr style={{ backgroundColor: COLORS.gray100 }}>
                <th style={thStyle}>Product</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Revenue</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Units</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Orders</th>
              </tr>
            </thead>
            <tbody>
              {products.slice(0, 15).map((p, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${COLORS.gray200}` }}>
                  <td style={tdStyle}>{p.title || "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{fmtCurrency(p.totalRevenue)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(p.unitsSold)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(p.ordersCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    if (segmentation) {
      const segRows = [
        { label: "NCA Orders", value: fmt(segmentation.firstOrdersCount) },
        { label: "NCA Net Revenue", value: fmtCurrency(segmentation.ncaNetRevenue) },
        { label: "Returning Orders", value: fmt((segmentation.totalOrders || 0) - (segmentation.firstOrdersCount || 0)) },
        { label: "Returning Revenue", value: fmtCurrency(segmentation.returningCustomerNetRevenue) },
        { label: "LTV 30 days", value: fmtCurrency(segmentation.ltv30) },
        { label: "LTV 90 days", value: fmtCurrency(segmentation.ltv90) },
      ];
      sections.push(
        <div key="seg" style={{ marginTop: 24 }}>
          <h3 style={h3Style}>Customer Segmentation</h3>
          {renderMetricsTable(segRows)}
        </div>
      );
    }
    return sections.length ? sections : <p style={pStyle}>No ecommerce data available.</p>;
  };

  const renderAnalytics = () => {
    const { totals, channels } = dataSnapshot;
    const rows = [];
    if (totals) {
      Object.entries(totals).forEach(([k, v]) => {
        if (v != null && typeof v === "number") rows.push({ label: k.replace(/([A-Z])/g, " $1").trim(), value: fmt(v, 2) });
      });
    }
    if (channels?.length > 0) {
      rows.push({ label: "Channels", value: channels.map((c) => c.name || c.channel).join(", ") });
    }
    return rows.length ? renderMetricsTable(rows) : renderGeneric();
  };

  const renderParentProperty = () => {
    const { metrics, tableRows } = dataSnapshot;
    const sections = [];
    if (metrics && typeof metrics === "object" && !Array.isArray(metrics)) {
      const m = metrics;
      const rows = [
        { label: "Combined Revenue", value: fmtCurrency(m.revenue) },
        { label: "Total Adspend", value: fmtCurrency(m.adspend) },
        { label: "Total Orders", value: fmt(m.orders) },
        { label: "Combined ROAS", value: m.roas != null ? fmt(m.roas, 2) : "—" },
        { label: "Spendshare", value: m.spendshare != null ? `${fmt(m.spendshare * 100, 1)}%` : "—" },
      ];
      sections.push(renderMetricsTable(rows));
    }
    if (tableRows?.length > 0) {
      sections.push(
        <div key="table" style={{ marginTop: 24 }}>
          <h3 style={h3Style}>Child Properties</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 10 }}>
            <thead>
              <tr style={{ backgroundColor: COLORS.gray100 }}>
                <th style={thStyle}>Property</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Revenue</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Adspend</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Orders</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.slice(0, 15).map((r, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${COLORS.gray200}` }}>
                  <td style={tdStyle}>{r.customerName || r.name || "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{fmtCurrency(r.revenue)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{fmtCurrency(r.adspend)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(r.orders)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return sections.length ? sections : renderGeneric();
  };

  const calcSeoCtr = (clicks, impressions) => {
    if (!impressions) return "—";
    return `${((clicks / impressions) * 100).toFixed(2)}%`;
  };

  const renderSeoDashboard = () => {
    const { totalClicks, totalImpressions, avgCtr, avgPosition, keywords = [], urls = [] } = dataSnapshot;
    const sections = [];

    const metricRows = [
      { label: "Clicks", value: totalClicks != null ? fmt(totalClicks) : "—" },
      { label: "Impressions", value: totalImpressions != null ? fmt(totalImpressions) : "—" },
      { label: "CTR", value: avgCtr != null ? (typeof avgCtr === "number" ? `${fmt(avgCtr, 2)}%` : `${avgCtr}%`) : "—" },
      { label: "Avg. Position", value: avgPosition != null ? fmt(avgPosition, 2) : "—" },
    ];
    sections.push(
      <div key="metrics" style={{ marginTop: 12 }}>
        {renderMetricsTable(metricRows)}
      </div>
    );

    const topKeywords = [...(keywords || [])].sort((a, b) => (b.clicks || 0) - (a.clicks || 0)).slice(0, 10);
    if (topKeywords.length > 0) {
      sections.push(
        <div key="keywords" style={{ marginTop: 24 }}>
          <h3 style={h3Style}>Top Keywords (Top 10)</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 10 }}>
            <thead>
              <tr style={{ backgroundColor: COLORS.gray100 }}>
                <th style={thStyle}>Keyword</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Clicks</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Impressions</th>
                <th style={{ ...thStyle, textAlign: "right" }}>CTR</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Avg. Position</th>
              </tr>
            </thead>
            <tbody>
              {topKeywords.map((row, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${COLORS.gray200}` }}>
                  <td style={tdStyle}>{row.keys?.[0] || "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{row.clicks != null ? fmt(row.clicks) : "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{row.impressions != null ? fmt(row.impressions) : "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{calcSeoCtr(row.clicks, row.impressions)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{row.position != null ? fmt(row.position, 2) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    const topUrls = [...(urls || [])].sort((a, b) => (b.clicks || 0) - (a.clicks || 0)).slice(0, 10);
    if (topUrls.length > 0) {
      sections.push(
        <div key="urls" style={{ marginTop: 24 }}>
          <h3 style={h3Style}>Top URLs (Top 10)</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 10 }}>
            <thead>
              <tr style={{ backgroundColor: COLORS.gray100 }}>
                <th style={thStyle}>URL</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Clicks</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Impressions</th>
                <th style={{ ...thStyle, textAlign: "right" }}>CTR</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Avg. Position</th>
              </tr>
            </thead>
            <tbody>
              {topUrls.map((row, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${COLORS.gray200}` }}>
                  <td style={tdStyle}>{row.keys?.[0] || "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{row.clicks != null ? fmt(row.clicks) : "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{row.impressions != null ? fmt(row.impressions) : "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{calcSeoCtr(row.clicks, row.impressions)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{row.position != null ? fmt(row.position, 2) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return sections.length ? sections : <p style={pStyle}>No SEO data available.</p>;
  };

  const renderGeneric = () => {
    const keys = Object.keys(dataSnapshot).filter((k) => !["dailyData", "dailySeries"].includes(k));
    if (keys.length === 0) return <p style={pStyle}>No data available for export.</p>;
    return (
      <div style={{ marginTop: 12 }}>
        <pre style={{ fontSize: 10, color: COLORS.gray900, whiteSpace: "pre-wrap", fontFamily: "Outfit, sans-serif" }}>
          {JSON.stringify(dataSnapshot, (_, v) => (typeof v === "object" && v !== null && Object.keys(v).length > 5 ? "[Object]" : v), 2)}
        </pre>
      </div>
    );
  };

  const h3Style = { fontSize: 14, fontWeight: 600, color: COLORS.primary, marginBottom: 4 };
  const pStyle = { fontSize: 12, color: COLORS.gray600, marginTop: 12 };

  const renderContent = () => {
    switch (dashboardType) {
      case "performance-dashboard":
        return renderPerformanceDashboard();
      case "ppc-dashboard":
        return renderPpcDashboard();
      case "ps-dashboard":
        return renderPsDashboard();
      case "pnl":
        return renderPnlReport();
      case "pace-report":
        return renderPaceReport();
      case "daily-overview":
        return renderDailyOverview();
      case "ecommerce":
        return renderEcommerce();
      case "analytics":
        return renderAnalytics();
      case "parent-property":
        return renderParentProperty();
      case "seo-dashboard":
        return renderSeoDashboard();
      default:
        return renderGeneric();
    }
  };

  return (
    <div
      id="pdf-report-content"
      style={{
        fontFamily: "Outfit, sans-serif",
        padding: 32,
        backgroundColor: "#fff",
        color: COLORS.gray900,
        minWidth: 600,
        maxWidth: 800,
      }}
    >
      <div style={{ borderBottom: `2px solid ${COLORS.primaryLighter}`, paddingBottom: 16, marginBottom: 24 }}>
        {label && (
          <span style={{ fontSize: 11, color: COLORS.gray600, display: "block", marginBottom: 4 }}>{label}</span>
        )}
        <h1 style={{ fontSize: 22, fontWeight: 700, color: COLORS.primary, margin: 0 }}>{title}</h1>
        {dateRangeStr && (
          <p style={{ fontSize: 12, color: COLORS.gray600, marginTop: 8, marginBottom: 0 }}>
            Period: {dateRangeStr}
            {comparisonMethod ? ` (vs ${comparisonMethod})` : ""}
          </p>
        )}
      </div>
      <div style={{ fontSize: 12 }}>{renderContent()}</div>
      <div style={{ marginTop: 32, fontSize: 10, color: COLORS.gray600 }}>
        Generated by Searchmind · {new Date().toLocaleDateString("da-DK")}
      </div>
    </div>
  );
}
