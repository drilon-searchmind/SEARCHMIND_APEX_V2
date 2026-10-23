/**
 * Derived insights for the Email (Klaviyo) dashboard. Pure functions over the report rows.
 * Estimates are simple proportional projections and are labelled as such in the UI.
 */

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function mergeRows(a, b) {
    if (!a) return b ? { ...b } : null;
    if (!b) return { ...a };
    const recipients = n(a.recipients) + n(b.recipients);
    const opens = n(a.opens) + n(b.opens);
    const clicks = n(a.clicks) + n(b.clicks);
    return {
        ...a,
        recipients,
        opens,
        clicks,
        conversions: n(a.conversions) + n(b.conversions),
        conversion_value: n(a.conversion_value) + n(b.conversion_value),
        unsubscribes: n(a.unsubscribes) + n(b.unsubscribes),
        open_rate: recipients > 0 ? opens / recipients : null,
        click_rate: recipients > 0 ? clicks / recipients : null,
    };
}

export function sumRows(rows) {
    return (rows || []).reduce((acc, r) => mergeRows(acc, r), null);
}

/** Ratios for one report row (a period total, a campaign or a flow). Rates are fractions. */
export function emRates(row) {
    if (!row) return null;
    const recipients = n(row.recipients);
    const opens = n(row.opens);
    const clicks = n(row.clicks);
    const conversions = n(row.conversions);
    const revenue = n(row.conversion_value);
    return {
        revenue,
        conversions,
        recipients,
        opens,
        clicks,
        unsubscribes: n(row.unsubscribes),
        openRate: recipients > 0 ? opens / recipients : null,
        clickRate: recipients > 0 ? clicks / recipients : null,
        ctor: opens > 0 ? clicks / opens : null,
        convRate: recipients > 0 ? conversions / recipients : null,
        rpe: recipients > 0 ? revenue / recipients : null,
        aov: conversions > 0 ? revenue / conversions : null,
        unsubPerK: recipients > 0 ? (n(row.unsubscribes) / recipients) * 1000 : null,
    };
}

/** Four steps from sent to ordered, each with the share that made it from the step before. */
export function funnelSteps(row) {
    if (!row) return [];
    const steps = [
        { id: "sent", label: "Emails sent", value: n(row.recipients) },
        { id: "opened", label: "Opened", value: n(row.opens) },
        { id: "clicked", label: "Clicked", value: n(row.clicks) },
        { id: "ordered", label: "Ordered", value: n(row.conversions) },
    ];
    return steps.map((s, i) => ({
        ...s,
        ofSent: steps[0].value > 0 ? s.value / steps[0].value : null,
        fromPrev: i > 0 && steps[i - 1].value > 0 ? s.value / steps[i - 1].value : null,
    }));
}

/**
 * Status against the group's own revenue per email (campaigns against campaigns, flows against
 * flows), never an outside benchmark. Sends under 1% of the group's volume are low volume.
 */
export function rpeStatus(row, groupRpe, groupRecipients) {
    const r = emRates(row);
    if (!groupRpe || groupRecipients <= 0 || r.recipients / groupRecipients < 0.01) {
        return { id: "low", label: "Low volume", tone: "neutral" };
    }
    const ratio = (r.rpe ?? 0) / groupRpe;
    if (ratio >= 1.25) return { id: "winner", label: "Winner", tone: "ok" };
    if (ratio >= 0.75) return { id: "solid", label: "Solid", tone: "ok" };
    if (ratio >= 0.4) return { id: "soft", label: "Soft", tone: "warn" };
    return { id: "weak", label: "Weak", tone: "bad" };
}

/** Group totals plus the median revenue per email, used as the reference for the upside estimate. */
export function groupStats(rows) {
    const list = rows || [];
    const recipients = list.reduce((s, r) => s + n(r.recipients), 0);
    const revenue = list.reduce((s, r) => s + n(r.conversion_value), 0);
    const unsubs = list.reduce((s, r) => s + n(r.unsubscribes), 0);
    const rpes = list.filter((r) => n(r.recipients) > 0).map((r) => n(r.conversion_value) / n(r.recipients)).sort((a, b) => a - b);
    const median = rpes.length ? (rpes.length % 2 ? rpes[(rpes.length - 1) / 2] : (rpes[rpes.length / 2 - 1] + rpes[rpes.length / 2]) / 2) : null;
    return {
        recipients,
        revenue,
        rpe: recipients > 0 ? revenue / recipients : null,
        medianRpe: median,
        unsubPerK: recipients > 0 ? (unsubs / recipients) * 1000 : null,
    };
}

/**
 * Estimate: revenue if every campaign below the median revenue per email had matched the median
 * at its own volume. Audience and offer differ between sends, so this is an upper bound.
 */
export function campaignUpside(campaigns) {
    const stats = groupStats(campaigns);
    if (!stats.medianRpe) return null;
    let extra = 0;
    let count = 0;
    for (const c of campaigns) {
        const recipients = n(c.recipients);
        if (recipients < 1000) continue;
        const rpe = n(c.conversion_value) / recipients;
        if (rpe < stats.medianRpe) {
            extra += (stats.medianRpe - rpe) * recipients;
            count += 1;
        }
    }
    return count > 0 ? { extra, count, medianRpe: stats.medianRpe } : null;
}
