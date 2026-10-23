/**
 * Deterministic demo data for the Email (Klaviyo) dashboard (illustrative, not real customer data).
 * Mirrors the three live parts the page loads one after another:
 *   summary: campaign totals + campaigns sent in the period
 *   flows:   per-flow totals for the period
 *   daily:   flow-series by day
 * Everything is derived from the same per-day, per-flow and per-send generators so the parts agree.
 */

import { eachDayInclusive, numHash } from "@/lib/demoAdMetrics";

const ORIGIN = Date.UTC(2025, 0, 1);

function dayIndex(date) {
    const t = new Date(`${date}T12:00:00.000Z`).getTime();
    return Math.max(0, Math.floor((t - ORIGIN) / 86400000));
}

function rnd(seed) {
    // numHash alone barely changes between neighbouring dates, so scramble it before use
    let h = numHash(seed);
    h ^= h >>> 16;
    h = Math.imul(h, 0x45d9f3b);
    h ^= h >>> 16;
    h = Math.imul(h, 0x45d9f3b);
    h ^= h >>> 16;
    return ((h >>> 0) % 10000) / 10000;
}

function wiggle(seed, spread) {
    return 1 + (rnd(seed) - 0.5) * 2 * spread;
}

/** [name, daily recipients, open rate, click rate, conversion rate per recipient, revenue per conversion, unsub per 1000] */
const FLOWS = [
    ["Abandoned Cart", 150, 0.46, 0.115, 0.034, 640, 0.6],
    ["Welcome Series", 95, 0.52, 0.098, 0.016, 520, 1.1],
    ["Browse Abandonment", 210, 0.34, 0.062, 0.009, 480, 0.9],
    ["Post-purchase Thank You", 120, 0.58, 0.075, 0.006, 430, 0.4],
    ["Winback 90 Days", 60, 0.22, 0.031, 0.004, 560, 3.2],
    ["Back in Stock", 40, 0.55, 0.14, 0.05, 590, 0.5],
];

/** [subject name, base recipients, open rate, click rate, conversion rate, revenue per conversion, unsub per 1000] */
const CAMPAIGN_TYPES = {
    newsletter: ["Newsletter", 11500, 0.33, 0.047, 0.0042, 520, 1.6],
    promo: ["Sale", 13500, 0.29, 0.058, 0.0068, 610, 2.4],
    launch: ["New arrivals", 12000, 0.36, 0.066, 0.0075, 650, 1.5],
    vip: ["VIP early access", 2400, 0.49, 0.112, 0.021, 720, 0.7],
    reengage: ["We miss you", 6500, 0.18, 0.019, 0.0016, 440, 4.4],
};

const PROMO_NAMES = ["Summer sale", "Weekend offer", "Free shipping week", "Bestsellers restock", "Last chance", "Gift guide", "Autumn collection"];

function flowDay(flow, date) {
    const [name, base, open, click, conv, aov, unsub] = flow;
    const key = `${name}|${date}`;
    const growth = 1 + dayIndex(date) * 0.00008;
    const recipients = Math.round(base * growth * wiggle(`r|${key}`, 0.14));
    const opens = Math.round(recipients * open * wiggle(`o|${key}`, 0.08));
    const clicks = Math.round(recipients * click * wiggle(`c|${key}`, 0.12));
    const conversions = Math.round(recipients * conv * wiggle(`v|${key}`, 0.22) * 10) / 10;
    const conversion_value = Math.round(conversions * aov * wiggle(`a|${key}`, 0.1));
    const unsubscribes = Math.round((recipients * unsub * wiggle(`u|${key}`, 0.3)) / 1000);
    return { recipients, opens, clicks, conversions, conversion_value, unsubscribes };
}

function finalize(row) {
    return {
        ...row,
        open_rate: row.recipients > 0 ? row.opens / row.recipients : null,
        click_rate: row.recipients > 0 ? row.clicks / row.recipients : null,
    };
}

function emptyRow() {
    return { recipients: 0, opens: 0, clicks: 0, conversions: 0, conversion_value: 0, unsubscribes: 0 };
}

function add(row, other) {
    for (const k of Object.keys(emptyRow())) row[k] += other[k] || 0;
    return row;
}

/** Campaigns for the range: a Tuesday newsletter, plus a promo, launch, VIP or re-engagement send now and then. */
function campaignsInRange(days) {
    const list = [];
    for (const date of days) {
        const dow = new Date(`${date}T12:00:00.000Z`).getUTCDay();
        const h = numHash(`send|${date}`);
        let type = null;
        let label = "";
        if (dow === 2) {
            type = "newsletter";
            label = `Newsletter, ${date.slice(5)}`;
        } else if (h % 9 === 0) {
            type = "promo";
            label = `${PROMO_NAMES[h % PROMO_NAMES.length]}, ${date.slice(5)}`;
        } else if (h % 23 === 1) {
            type = "launch";
            label = `New arrivals, ${date.slice(5)}`;
        } else if (h % 29 === 2) {
            type = "vip";
            label = `VIP early access, ${date.slice(5)}`;
        } else if (h % 37 === 3) {
            type = "reengage";
            label = `We miss you, ${date.slice(5)}`;
        }
        if (!type) continue;
        const [, base, open, click, conv, aov, unsub] = CAMPAIGN_TYPES[type];
        const key = `${type}|${date}`;
        const growth = 1 + dayIndex(date) * 0.00007;
        const recipients = Math.round(base * growth * wiggle(`r|${key}`, 0.12));
        const opens = Math.round(recipients * open * wiggle(`o|${key}`, 0.1));
        const clicks = Math.round(recipients * click * wiggle(`c|${key}`, 0.15));
        const conversions = Math.round(recipients * conv * wiggle(`v|${key}`, 0.25));
        const conversion_value = Math.round(conversions * aov * wiggle(`a|${key}`, 0.12));
        const unsubscribes = Math.max(1, Math.round((recipients * unsub * wiggle(`u|${key}`, 0.3)) / 1000));
        list.push(
            finalize({
                campaign_name: label,
                campaign_id: `cmp_demo_${type}_${date}`,
                send_date: date,
                recipients,
                opens,
                clicks,
                conversions,
                conversion_value,
                unsubscribes,
            })
        );
    }
    return list;
}

/** @param {'summary'|'flows'|'daily'} part */
export function getDemoEmPart(part, startDate, endDate) {
    const days = eachDayInclusive(startDate, endDate);

    if (part === "summary") {
        const campaigns = campaignsInRange(days);
        const totals = campaigns.reduce((acc, c) => add(acc, c), emptyRow());
        return {
            metrics_by_date: [finalize({ ...totals, date: startDate })],
            metrics_by_date_prev: [],
            top_campaigns: [...campaigns].sort((a, b) => b.recipients - a.recipients).slice(0, 100),
            flow_daily: [],
            hasDailySeries: false,
        };
    }

    if (part === "flows") {
        const top_flows = FLOWS.map((flow, i) => {
            const total = days.reduce((acc, d) => add(acc, flowDay(flow, d)), emptyRow());
            return finalize({ ...total, flow_id: `demo-flow-${i + 1}`, flow_name: flow[0], messages: i === 1 ? 4 : 2 + (i % 3) });
        }).sort((a, b) => b.conversion_value - a.conversion_value);
        const totals = top_flows.reduce((acc, f) => add(acc, f), emptyRow());
        return { flow_totals: finalize({ ...totals, date: startDate }), top_flows };
    }

    const flow_daily = days.map((date) => {
        const total = FLOWS.reduce((acc, f) => add(acc, flowDay(f, date)), emptyRow());
        return finalize({ ...total, date });
    });
    return { flow_daily, flow_totals: finalize({ ...flow_daily.reduce((a, r) => add(a, r), emptyRow()), date: startDate }), hasDailySeries: flow_daily.length > 1 };
}

/** Upcoming sends in the shape of /api/klaviyo-scheduled-campaigns. */
export function getDemoEmUpcoming(now = new Date()) {
    const at = (d, hour) => {
        const t = new Date(now.getTime() + d * 86400000);
        t.setUTCHours(hour, 0, 0, 0);
        return t.toISOString();
    };
    const campaigns = [
        { id: "demo-up-1", name: "VIP early access, autumn drop", status: "Scheduled", scheduledAt: at(2, 8), audiences: { included: ["VIP segment"], excluded: [] }, messages: [{ subject: "Early access to the autumn drop" }] },
        { id: "demo-up-2", name: "Newsletter, weekly", status: "Scheduled", scheduledAt: at(4, 9), audiences: { included: ["Newsletter"], excluded: ["Unengaged 90d"] }, messages: [{ subject: "This week at Demo Store" }] },
        { id: "demo-up-3", name: "Weekend offer", status: "Scheduled", scheduledAt: at(9, 7), audiences: { included: ["Newsletter", "Engaged 30d"], excluded: [] }, messages: [{ subject: "Weekend only: 20% on lighting" }] },
        { id: "demo-up-4", name: "Back in stock, bestseller", status: "Draft", scheduledAt: null, audiences: { included: ["Waitlist"], excluded: [] }, messages: [{ subject: "It is back in stock" }] },
    ];
    return {
        readOnly: true,
        generatedAt: now.toISOString(),
        truncated: false,
        summary: { total: campaigns.length, scheduled: 3, draft: 1, preparing: 0, byWeek: [] },
        campaigns,
    };
}
