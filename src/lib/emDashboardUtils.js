/**
 * Email (Klaviyo) dashboard helpers — chart series, KPI aggregation, formatting.
 */

export const EM_CHART_METRIC_LABELS = {
    revenue: "Revenue",
    conversions: "Conversions",
    emails_sent: "Emails sent",
    opens: "Opens",
    clicks: "Clicks",
    open_rate: "Open rate",
    click_rate: "Click rate",
    unsubscribes: "Unsubscribes",
    rpe: "Revenue per email",
    conv_rate: "Conversion rate",
};

export function rowToEmMetric(row, key) {
    if (!row) return null;
    if (key === "revenue") return row.conversion_value ?? 0;
    if (key === "emails_sent") return row.recipients ?? 0;
    if (key === "open_rate") return row.open_rate ?? null;
    if (key === "click_rate") return row.click_rate ?? null;
    if (key === "rpe") {
        const rec = Number(row.recipients || 0);
        return rec > 0 ? Number(row.conversion_value || 0) / rec : null;
    }
    if (key === "conv_rate") {
        const rec = Number(row.recipients || 0);
        return rec > 0 ? Number(row.conversions || 0) / rec : null;
    }
    return row[key] ?? 0;
}

export function aggregateEmPeriodFromDaily(rows, key) {
    if (!rows?.length) return null;
    if (key === "open_rate") {
        const totalRecipients = rows.reduce((s, r) => s + (r.recipients ?? 0), 0);
        if (totalRecipients === 0) return null;
        const totalOpens = rows.reduce((s, r) => s + (r.opens ?? 0), 0);
        return totalOpens / totalRecipients;
    }
    if (key === "click_rate") {
        const totalRecipients = rows.reduce((s, r) => s + (r.recipients ?? 0), 0);
        if (totalRecipients === 0) return null;
        const totalClicks = rows.reduce((s, r) => s + (r.clicks ?? 0), 0);
        return totalClicks / totalRecipients;
    }
    if (key === "rpe") {
        const totalRecipients = rows.reduce((s, r) => s + (r.recipients ?? 0), 0);
        if (totalRecipients === 0) return null;
        const totalRevenue = rows.reduce((s, r) => s + (r.conversion_value ?? 0), 0);
        return totalRevenue / totalRecipients;
    }
    if (key === "conv_rate") {
        const totalRecipients = rows.reduce((s, r) => s + (r.recipients ?? 0), 0);
        if (totalRecipients === 0) return null;
        const totalConv = rows.reduce((s, r) => s + (r.conversions ?? 0), 0);
        return totalConv / totalRecipients;
    }
    return rows.reduce((s, r) => s + (rowToEmMetric(r, key) ?? 0), 0);
}

export function getEmDailyMetricValue(row, key) {
    const val = rowToEmMetric(row, key);
    if (val === null || val === undefined) return null;
    if (key === "open_rate" || key === "click_rate" || key === "conv_rate") {
        return Number(val) * 100;
    }
    if (key === "rpe") return Number(val);
    return Number(val);
}

export function normalizeSeriesValues(values) {
    if (!values?.length) return [];
    const nums = values.map((v) => (v == null || Number.isNaN(Number(v)) ? 0 : Number(v)));
    const max = Math.max(...nums, 0);
    if (max <= 0) return nums.map(() => 0);
    return nums.map((v) => (v / max) * 100);
}

export function formatEmKpiValue(key, value) {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    if (key === "revenue" || key === "rpe") {
        return `${Number(value).toLocaleString("da-DK", { minimumFractionDigits: 0, maximumFractionDigits: key === "rpe" ? 2 : 0 })} kr.`;
    }
    if (key === "open_rate" || key === "click_rate" || key === "conv_rate") {
        return `${(Number(value) * 100).toLocaleString("da-DK", { maximumFractionDigits: 1 })}%`;
    }
    if (key === "campaign_revenue_share" || key === "flow_revenue_share") {
        return `${Number(value).toLocaleString("da-DK", { maximumFractionDigits: 0 })}%`;
    }
    return Number(value).toLocaleString("da-DK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function channelSplitFromDaily(rows) {
    let campaignRevenue = 0;
    let flowRevenue = 0;
    let campaignRecipients = 0;
    let flowRecipients = 0;
    for (const row of rows || []) {
        campaignRevenue += Number(row.campaign_revenue || 0);
        flowRevenue += Number(row.flow_revenue || 0);
        campaignRecipients += Number(row.campaign_recipients || 0);
        flowRecipients += Number(row.flow_recipients || 0);
    }
    const totalRevenue = campaignRevenue + flowRevenue;
    return {
        campaign: {
            revenue: campaignRevenue,
            recipients: campaignRecipients,
            sharePct: totalRevenue > 0 ? (campaignRevenue / totalRevenue) * 100 : null,
        },
        flow: {
            revenue: flowRevenue,
            recipients: flowRecipients,
            sharePct: totalRevenue > 0 ? (flowRevenue / totalRevenue) * 100 : null,
        },
    };
}
