import { roundN, safeDiv } from "@/lib/performanceBriefDates";

export function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

export function fmt(v, d = 1) {
    return num(v).toLocaleString("da-DK", { minimumFractionDigits: d, maximumFractionDigits: d });
}

const SALE = /(purchase|køb|omnistore|order|ecommerce|checkout|transaction|shopping|performance max)/;
const LEAD =
    /(lead|kontakt|contact|form|formular|tilbud|quote|booking|book|call|opkald|signup|tilmeld|download|ansøg|schedule|find_location)/;
const MICRO = /(add_to_cart|view_content|page_view|landing_page|klik|click|scroll)/;

/**
 * Derive account intent from channel metrics and conversion action names.
 * @param {object|null} ch
 */
export function detectIntent(ch) {
    if (!ch) return null;

    const conv = num(ch.conversions);
    const value = num(ch.conversionValue ?? ch.revenue ?? ch.purchaseValue);
    const spend = num(ch.spend);
    const names = (ch.conversionActions || ch.actionTypes || []).map((a) =>
        String(a.name ?? a.type ?? a).toLowerCase()
    );

    const hasSaleAction = names.some((n) => SALE.test(n) && !MICRO.test(n));
    const hasLeadAction = names.some((n) => LEAD.test(n));
    const hasRealValue = value > 0 && conv > 0;
    const assignedValue =
        hasRealValue &&
        ch.valuePerConversionVariance != null &&
        num(ch.valuePerConversionVariance) < 0.01;

    if (conv === 0 && spend > 0) {
        return {
            type: "uklar",
            primaryKpi: null,
            unit: "konv.",
            basis: "Ingen registrerede konverteringer i perioden",
        };
    }
    if (hasSaleAction && hasRealValue && !assignedValue) {
        if (hasLeadAction) {
            return {
                type: "hybrid",
                primaryKpi: "ROAS",
                unit: "konv.",
                basis: "Både salgs- og lead-handlinger med reel værdi",
            };
        }
        return {
            type: "ecommerce",
            primaryKpi: "ROAS",
            unit: "køb",
            basis: "Purchase-konverteringer med reel omsætningsværdi",
        };
    }
    if (hasLeadAction || !hasRealValue || assignedValue) {
        return {
            type: "leadgen",
            primaryKpi: "CPA",
            unit: "leads",
            basis: assignedValue
                ? "Konstant værdi pr. konvertering — tildelt leadværdi, ikke omsætning"
                : "Lead-/kontakthandlinger uden reel omsætningsværdi",
        };
    }
    return {
        type: "uklar",
        primaryKpi: null,
        unit: "konv.",
        basis: "Konverteringsopsætningen kan ikke aflæses entydigt",
    };
}

function computeValuePerConversionVariance(channel, platformKey) {
    const w = channel?.last7 || {};
    const rows = [...(channel?.campaigns || []), ...(channel?.adTypes || channel?.campaignTypes || [])]
        .filter((r) => num(r.conversions) > 0 && num(r.revenue) > 0)
        .map((r) => num(r.revenue) / num(r.conversions));

    if (rows.length >= 2) {
        const mean = rows.reduce((a, b) => a + b, 0) / rows.length;
        if (mean <= 0) return null;
        const variance = rows.reduce((s, r) => s + (r - mean) ** 2, 0) / rows.length;
        return variance / (mean * mean);
    }

    const purchases = num(w.conversions);
    const leads = num(w.leads);
    const conv = platformKey === "meta" && purchases === 0 && leads > 0 ? leads : num(w.conversions);
    const rev = num(w.revenue);

    if (conv > 0 && rev > 0 && platformKey === "meta" && purchases === 0 && leads > 0) {
        return 0;
    }
    if (conv > 0 && rev > 0 && rows.length === 1) {
        return 0;
    }
    return null;
}

function metaConversionActions(channel) {
    const w = channel?.last7 || {};
    const names = new Set();

    for (const action of channel?.conversionActions || []) {
        const name = String((action?.name ?? action?.type ?? action) || "").trim();
        if (name) names.add(name);
    }

    if (num(w.conversions) > 0) names.add("purchase");
    if (num(w.leads) > 0) {
        names.add("lead");
        names.add("contact");
    }
    if (channel?.accountType === "lead") names.add("lead");
    if (channel?.accountType === "ecommerce") names.add("purchase");
    if (channel?.accountType === "hybrid") {
        names.add("purchase");
        names.add("lead");
    }

    for (const c of channel?.campaigns || []) {
        if (/\b(dpa|katalog|catalog|shop|produkt)/i.test(String(c.name || ""))) {
            names.add("purchase");
        }
    }

    return [...names].map((name) => ({ name }));
}

function googleConversionActions(channel) {
    const w = channel?.last7 || {};
    const names = new Set();

    for (const t of channel?.campaignTypes || []) {
        const label = String(t.type || "").toLowerCase();
        if (/shopping|performance max/.test(label)) names.add("purchase");
        if (/søgning|search|demand gen|display|video/.test(label) && num(w.revenue) === 0) {
            names.add("lead");
        }
    }

    if (num(w.revenue) > 0 && num(w.conversions) > 0) names.add("purchase");
    if (num(w.conversions) > 0 && num(w.revenue) === 0) names.add("lead");
    if (!names.size && num(w.conversions) > 0) names.add("conversions");

    return [...names].map((name) => ({ name }));
}

export function buildChannelIntentInput(platformKey, channel) {
    if (!channel?.configured || channel?.error) return null;

    const w = channel.last7 || {};
    const purchases = num(w.conversions);
    const leads = num(w.leads);
    const conversions =
        platformKey === "meta" && purchases === 0 && leads > 0 ? leads : num(w.conversions);

    return {
        spend: num(w.spend),
        conversions,
        conversionValue: num(w.revenue),
        revenue: num(w.revenue),
        conversionActions:
            platformKey === "meta"
                ? metaConversionActions(channel)
                : googleConversionActions(channel),
        valuePerConversionVariance: computeValuePerConversionVariance(channel, platformKey),
    };
}

export function detectAccountIntent(compact) {
    const metaInput = buildChannelIntentInput("meta", compact?.meta);
    const googleInput = buildChannelIntentInput("google", compact?.google);
    return {
        meta: metaInput ? detectIntent(metaInput) : null,
        google: googleInput ? detectIntent(googleInput) : null,
    };
}

export function rankTypes(rows, intent) {
    const sorted = (rows || []).map((row) => ({
        ...row,
        name: row.name || row.type,
        cpa: row.cpa ?? safeDiv(row.spend, row.conversions),
    }));

    if (intent?.primaryKpi === "ROAS") {
        sorted.sort((a, b) => num(b.roas) - num(a.roas));
        return { rows: sorted, label: "rangeret på ROAS" };
    }
    if (intent?.primaryKpi === "CPA") {
        sorted.sort((a, b) => {
            const ac = num(a.conversions);
            const bc = num(b.conversions);
            if (!ac && !bc) return num(b.spend) - num(a.spend);
            if (!ac) return 1;
            if (!bc) return -1;
            return num(a.cpa) - num(b.cpa);
        });
        return { rows: sorted, label: "rangeret på pris per lead" };
    }
    sorted.sort((a, b) => num(b.spend) - num(a.spend));
    return { rows: sorted, label: "rangeret på spend — effekt kan ikke måles" };
}

export function formatTypeLine(r, intent, totalSpend) {
    const name = r.name || r.type || "Ukendt";
    const share = totalSpend
        ? ` · ${Math.round((num(r.spend) / totalSpend) * 100)} % af spend`
        : r.spendSharePct != null
          ? ` · ${fmt(r.spendSharePct, 0)} % af spend`
          : "";
    const conv = num(r.conversions);

    if (intent?.primaryKpi === "ROAS") {
        return `${name}: ROAS ${fmt(r.roas)}${share} · ${conv} ${intent.unit}`;
    }
    if (intent?.primaryKpi === "CPA") {
        if (!conv) return `${name}: 0 leads${share} · ingen effekt i perioden`;
        return `${name}: ${fmt(r.cpa ?? safeDiv(r.spend, r.conversions), 0)} kr/lead${share} · ${conv} leads`;
    }
    return `${name}: ${fmt(r.spend, 0)} kr${share} · effekt ikke målbar`;
}

export function stripRoas(node) {
    if (Array.isArray(node)) return node.forEach(stripRoas);
    if (node && typeof node === "object") {
        delete node.roas;
        delete node.conversionValue;
        delete node.revenue;
        Object.values(node).forEach(stripRoas);
    }
}

function enrichChannelTypes(channel, typesKey, intent) {
    if (!Array.isArray(channel?.[typesKey])) return;
    const totalSpend = channel[typesKey].reduce((s, r) => s + num(r.spend), 0);
    const { rows } = rankTypes(channel[typesKey], intent);
    channel[typesKey] = rows.map((row) => ({
        ...row,
        spendSharePct: row.spendSharePct ?? roundN(safeDiv(row.spend, totalSpend) * 100, 1),
    }));
}

/**
 * Attach accountIntent, re-rank type rows, and strip ROAS from non-ecommerce channels.
 * @param {object} compact
 */
export function applyPerformanceBriefIntent(compact) {
    const accountIntent = detectAccountIntent(compact);
    const enriched = JSON.parse(JSON.stringify(compact));
    enriched.accountIntent = accountIntent;

    if (enriched.meta?.configured && !enriched.meta?.error) {
        enrichChannelTypes(enriched.meta, "adTypes", accountIntent.meta);
        if (accountIntent.meta?.primaryKpi !== "ROAS") {
            stripRoas(enriched.meta);
        }
    }
    if (enriched.google?.configured && !enriched.google?.error) {
        enrichChannelTypes(enriched.google, "campaignTypes", accountIntent.google);
        if (accountIntent.google?.primaryKpi !== "ROAS") {
            stripRoas(enriched.google);
        }
    }

    return { compact: enriched, accountIntent };
}

function platformPayloadSlice(platformKey, channel) {
    if (!channel?.configured || channel?.error) return channel;

    if (platformKey === "meta") {
        return {
            accountType: channel.accountType,
            dataSource: channel.dataSource,
            last7: channel.last7,
            adTypes: channel.adTypes,
            campaigns: channel.campaigns,
            adsForAnalysis: channel.adsForAnalysis,
        };
    }

    return {
        dataSource: channel.dataSource,
        last7: channel.last7,
        campaignTypes: channel.campaignTypes,
        campaigns: channel.campaigns,
    };
}

/**
 * Build Claude payload with pre-computed accountIntent.
 * @param {object} compact
 * @param {string[]} fallbackOptimizations
 */
export function buildClaudePayload(compact, fallbackOptimizations = []) {
    return {
        customer: compact.customer,
        windows: compact.windows,
        accountIntent: compact.accountIntent || detectAccountIntent(compact),
        meta: platformPayloadSlice("meta", compact.meta),
        google: platformPayloadSlice("google", compact.google),
        heuristicOptimizations: fallbackOptimizations,
    };
}
