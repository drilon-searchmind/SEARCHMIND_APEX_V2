import { roundN, safeDiv } from "@/lib/performanceBriefDates";
import {
    getActionValue,
    getPurchaseConversions,
    getPurchaseRevenue,
} from "@/lib/facebookPsDashboardUtils";

const META_LEAD_ACTION_TYPES = [
    "lead",
    "onsite_conversion.lead_grouped",
    "contact",
    "schedule",
    "find_location",
];

const META_MICRO_ACTION_PATTERN =
    /(add_to_cart|kurv|view_content|page_?view|landing|initiate_checkout|klik|click|scroll|video|thruplay|watched|engagement|impression|reach|reaction|comment|save|share|follow|like|play|post_|page_|link_click|unique_click|outbound_click|onsite_web_app|app_install|messaging_|onsite_conversion\.(?!lead|purchase|contact|schedule|find_location))/i;

export function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

export function fmt(v, d = 1) {
    return num(v).toLocaleString("da-DK", { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** Action name determines intent; value only affects whether ROAS can be computed. */
export const CONVERSION_ACTION_PATTERNS = [
    [
        /(køb|kob|purchase|order|ordre|salg|sale|checkout|transaction|omni_purchase|revenue|omsætning|shopping|performance max|performance_max)/i,
        "sale",
    ],
    [
        /(lead|emne|kontakt|contact|formular|form|tilbud|quote|booking|book|ring|call|opkald|signup|tilmeld|nyhedsbrev|subscribe|download|ansøg|apply|besked|message|chat|schedule|find_location)/i,
        "lead",
    ],
    [
        /(add_to_cart|kurv|view_content|page_?view|landing|initiate_checkout|klik|click|scroll|video_?view|impression)/i,
        "micro",
    ],
];

export function classifyConversionAction(name) {
    const label = String(name || "");
    if (META_MICRO_ACTION_PATTERN.test(label)) return "micro";
    return CONVERSION_ACTION_PATTERNS.find(([re]) => re.test(label))?.[1] ?? "other";
}

function isMetaDuplicateAddEvent(actionType) {
    return /_add_/i.test(String(actionType || ""));
}

function filterMetaActions(actions = []) {
    return actions.filter((a) => !isMetaDuplicateAddEvent(a.action_type ?? a.name));
}

function getMetaLeadConversions(actions = []) {
    for (const type of META_LEAD_ACTION_TYPES) {
        const value = getActionValue(actions, type);
        if (value > 0) return value;
    }
    return 0;
}

/** Which Meta lead action type the account uses (matches firstActionValue on account insights). */
export function getPrimaryMetaLeadActionType(actions = []) {
    const filtered = filterMetaActions(actions);
    for (const type of META_LEAD_ACTION_TYPES) {
        if (getActionValue(filtered, type) > 0) return type;
    }
    return null;
}

/** Lead count from actions — optionally locked to the account's primary lead type. */
export function countMetaLeadsFromActions(actions = [], primaryLeadType = null) {
    const filtered = filterMetaActions(actions);
    if (primaryLeadType) {
        return getActionValue(filtered, primaryLeadType);
    }
    return getMetaLeadConversions(filtered);
}

function metaRowHasSaleAction(actions = []) {
    return filterMetaActions(actions).some(
        (a) => classifyConversionAction(a.action_type ?? a.name) === "sale"
    );
}

/**
 * Meta rows carry full Facebook action breakdowns — only count purchase + lead actions.
 */
function normalizeMetaPerformanceBriefRow(row, options = {}) {
    const { businessCategory = "ecommerce", metaPrimaryLeadType = null } = options;
    const actions = filterMetaActions(row.actions || row.conversionActions || []);
    const actionValues = row.action_values || [];
    const spend = num(row.spend);
    const rowLeads =
        businessCategory === "b2b"
            ? num(row.leads) ||
              (metaPrimaryLeadType
                  ? countMetaLeadsFromActions(actions, metaPrimaryLeadType)
                  : 0)
            : num(row.leads) ||
              countMetaLeadsFromActions(actions, metaPrimaryLeadType) ||
              getMetaLeadConversions(actions);

    if (businessCategory === "b2b") {
        if (rowLeads > 0) {
            return {
                intent: "lead",
                conv: rowLeads,
                value: 0,
                kpi: "CPA",
                unit: "leads",
                roas: null,
                cpa: spend ? spend / rowLeads : null,
                valueMissing: false,
            };
        }
        return {
            intent: null,
            conv: 0,
            value: 0,
            kpi: null,
            unit: "konv.",
            roas: null,
            cpa: null,
            valueMissing: false,
        };
    }

    if (!actions.length) {
        return normalizePerformanceBriefRow(row, { platform: "meta", businessCategory });
    }

    const purchases = getPurchaseConversions(actions);
    const revenue =
        getPurchaseRevenue(actionValues) > 0
            ? getPurchaseRevenue(actionValues)
            : num(row.revenue);
    const leads = rowLeads;
    const hasSale = purchases > 0 || metaRowHasSaleAction(actions);
    const hasLead = !hasSale && leads > 0;

    if (hasSale) {
        return {
            intent: "sale",
            conv: purchases,
            value: revenue,
            kpi: "ROAS",
            unit: "køb",
            roas: spend ? revenue / spend : null,
            cpa: null,
            valueMissing: purchases > 0 && revenue === 0,
        };
    }

    if (hasLead) {
        return {
            intent: "lead",
            conv: leads,
            value: 0,
            kpi: "CPA",
            unit: "leads",
            roas: null,
            cpa: spend ? spend / leads : null,
            valueMissing: false,
        };
    }

    return {
        intent: null,
        conv: 0,
        value: 0,
        kpi: null,
        unit: "konv.",
        roas: null,
        cpa: null,
        valueMissing: false,
    };
}

/**
 * Build conversion actions for a row when the API did not attach a breakdown.
 */
export function rowActionsFromRow(row, options = {}) {
    const { businessCategory = "ecommerce" } = options;
    const explicit = row?.conversionActions || row?.actions || [];
    if (explicit.length) return explicit;

    const actions = [];
    for (const av of row?.action_values || []) {
        const type = String(av.action_type || av.name || "").trim();
        if (!type) continue;
        actions.push({
            name: type,
            action_type: type,
            value: num(av.value),
            value_amount: num(av.value),
        });
    }
    if (actions.length) return actions;

    const rev = num(row.revenue ?? row.conversionValue ?? row.value);
    const conv = num(row.conversions);
    const rowLeads = num(row.leads);
    const label = `${row.type || ""} ${row.name || ""} ${row.channel || ""}`.toLowerCase();

    if (businessCategory === "b2b" && (rowLeads > 0 || conv > 0)) {
        actions.push({
            name: "lead",
            action_type: "lead",
            value: rowLeads > 0 ? rowLeads : conv,
        });
        return actions;
    }

    if (
        /(shopping|performance max|performance_max|pmax|katalog|catalog|dpa|produkt|purchase)/.test(
            label
        ) &&
        conv > 0
    ) {
        actions.push({ name: "purchase", action_type: "purchase", value: conv, value_amount: rev });
    } else if (rev > 0 && conv > 0) {
        actions.push({ name: "purchase", action_type: "purchase", value: conv, value_amount: rev });
    } else if (conv > 0) {
        if (/(lead|kontakt|form|booking|contact)/.test(label)) {
            actions.push({ name: "lead", action_type: "lead", value: conv });
        } else {
            actions.push({ name: "conversions", action_type: "conversions", value: conv });
        }
    }
    return actions;
}

/**
 * Normalize one campaign/ad/type row from its conversion actions.
 */
export function normalizePerformanceBriefRow(row, options = {}) {
    const { platform, businessCategory = "ecommerce" } = options;

    if (platform === "meta") {
        return normalizeMetaPerformanceBriefRow(row, options);
    }

    if (businessCategory === "b2b" && platform === "google") {
        const conv = num(row.conversions);
        const spend = num(row.spend);
        if (conv > 0) {
            return {
                intent: "lead",
                conv,
                value: 0,
                kpi: "CPA",
                unit: "leads",
                roas: null,
                cpa: spend ? spend / conv : null,
                valueMissing: false,
            };
        }
        return {
            intent: null,
            conv: 0,
            value: 0,
            kpi: null,
            unit: "konv.",
            roas: null,
            cpa: null,
            valueMissing: false,
        };
    }

    const actions = rowActionsFromRow(row, { businessCategory });
    const buckets = { sale: { conv: 0, value: 0 }, lead: { conv: 0 }, other: { conv: 0 } };

    for (const a of actions) {
        const kind = classifyConversionAction(a.name ?? a.action_type ?? "");
        if (kind === "micro") continue;
        const c = num(a.value ?? a.conversions);
        buckets[kind].conv += c;
        if (kind === "sale") {
            buckets.sale.value += num(a.value_amount ?? a.conversionValue ?? 0);
        }
    }

    const hasSale = actions.some(
        (a) => classifyConversionAction(a.name ?? a.action_type ?? "") === "sale"
    );
    const hasLead = actions.some(
        (a) => classifyConversionAction(a.name ?? a.action_type ?? "") === "lead"
    );

    let intent = hasSale ? "sale" : hasLead ? "lead" : null;
    if (!intent && businessCategory === "b2b" && buckets.lead.conv > 0) {
        intent = "lead";
    }
    if (!intent && businessCategory === "ecommerce" && buckets.sale.conv > 0) {
        intent = "sale";
    }

    const conv =
        intent === "sale"
            ? buckets.sale.conv
            : intent === "lead"
              ? buckets.lead.conv
              : 0;
    const value = buckets.sale.value;
    const spend = num(row.spend);

    return {
        intent,
        conv,
        value,
        kpi: intent === "sale" ? "ROAS" : intent === "lead" ? "CPA" : null,
        unit: intent === "sale" ? "køb" : intent === "lead" ? "leads" : "konv.",
        roas: intent === "sale" && spend ? value / spend : null,
        cpa: intent === "lead" && conv ? spend / conv : null,
        valueMissing: intent === "sale" && conv > 0 && value === 0,
    };
}

export function enrichPerformanceBriefRow(row, options = {}) {
    let normalized = normalizePerformanceBriefRow(row, options);

    const enriched = {
        ...row,
        intent: normalized.intent,
        kpi: normalized.kpi,
        unit: normalized.unit,
        valueMissing: normalized.valueMissing,
        conversions: normalized.conv,
        cpa:
            normalized.kpi === "CPA"
                ? roundN(normalized.cpa, 2)
                : row.cpa ?? roundN(safeDiv(row.spend, normalized.conv), 2),
    };

    if (normalized.kpi === "ROAS") {
        enriched.roas = roundN(normalized.roas ?? safeDiv(normalized.value, row.spend), 2);
        enriched.revenue = row.revenue ?? roundN(normalized.value, 2);
    } else {
        delete enriched.roas;
        delete enriched.revenue;
        delete enriched.conversionValue;
    }

    return enriched;
}

/**
 * Derive account intent from channel metrics and conversion action names.
 * @param {object|null} ch
 */
export function detectIntent(ch) {
    if (!ch) return null;

    const spend = num(ch.spend);
    const row = normalizePerformanceBriefRow({
        spend,
        revenue: num(ch.conversionValue ?? ch.revenue ?? ch.purchaseValue),
        conversions: num(ch.conversions),
        conversionActions: ch.conversionActions || ch.actions || ch.actionTypes || [],
    });

    if (row.intent === "sale") {
        const hasLead = rowActionsFromRow({
            conversionActions: ch.conversionActions || ch.actions || ch.actionTypes || [],
        }).some((a) => classifyConversionAction(a.name ?? a.action_type ?? "") === "lead");

        if (hasLead) {
            return {
                type: "hybrid",
                primaryKpi: null,
                unit: "konv.",
                basis: "Både salgs- og lead-handlinger — brug rækkens kpi",
            };
        }

        return {
            type: "ecommerce",
            primaryKpi: "ROAS",
            unit: "køb",
            basis: row.valueMissing
                ? "Salgs-handlinger registreret uden omsætningsværdi — tracking-fejl"
                : "Salgs-konverteringshandlinger",
            valueMissing: row.valueMissing,
        };
    }

    if (row.intent === "lead") {
        return {
            type: "leadgen",
            primaryKpi: "CPA",
            unit: "leads",
            basis: "Lead-/kontakthandlinger",
        };
    }

    if (spend > 0 && row.conv === 0) {
        return {
            type: "uklar",
            primaryKpi: null,
            unit: "konv.",
            basis: "Ingen registrerede konverteringer i perioden",
        };
    }

    return {
        type: "uklar",
        primaryKpi: null,
        unit: "konv.",
        basis: "Ingen målbar konverteringshandling på rækken",
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
    const rawActions = filterMetaActions(w.actions || channel?.conversionActions || []);
    const actionValues = w.action_values || [];

    if (rawActions.length) {
        const purchases = getPurchaseConversions(rawActions);
        const revenue = getPurchaseRevenue(actionValues);
        const leads = getMetaLeadConversions(rawActions);
        const actions = [];
        if (purchases > 0) {
            actions.push({
                name: "purchase",
                action_type: "purchase",
                value: purchases,
                value_amount: revenue,
            });
        }
        if (leads > 0) {
            actions.push({
                name: "lead",
                action_type: "lead",
                value: leads,
            });
        }
        if (actions.length) return actions;
    }

    const fallbackActions = [];
    const names = new Set();
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
    for (const name of names) {
        fallbackActions.push({
            name,
            action_type: name,
            value: name === "purchase" ? num(w.conversions) : num(w.leads),
            value_amount: name === "purchase" ? num(w.revenue) : 0,
        });
    }

    return fallbackActions;
}

function googleConversionActions(channel) {
    const actions = [];
    for (const row of [
        ...(channel?.campaignTypes || []),
        ...(channel?.campaigns || []),
    ]) {
        actions.push(...rowActionsFromRow(row));
    }

    if (!actions.length) {
        const w = channel?.last7 || {};
        if (num(w.revenue) > 0 && num(w.conversions) > 0) {
            actions.push({
                name: "purchase",
                action_type: "purchase",
                value: num(w.conversions),
                value_amount: num(w.revenue),
            });
        } else if (num(w.conversions) > 0) {
            actions.push({
                name: "lead",
                action_type: "lead",
                value: num(w.conversions),
            });
        }
    }

    return actions;
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

function applyBusinessCategoryBias(intent, channelInput, businessCategory, platformKey) {
    if (!intent || !channelInput) return intent;

    const revenue = num(channelInput.revenue ?? channelInput.conversionValue);
    const conversions = num(channelInput.conversions);
    const leads = platformKey === "meta" ? num(channelInput.leads) : conversions;

    if (businessCategory === "b2b") {
        // B2B customers are measured on leads/CPA — Google conversion value is not store revenue.
        return {
            type: "leadgen",
            primaryKpi: "CPA",
            unit: "leads",
            basis:
                revenue > 0 && intent.primaryKpi === "ROAS"
                    ? "B2B-kunde — leads/CPA er primær KPI (Google omsætningsværdi er ikke butiksomsætning)"
                    : "B2B-kunde — leads/CPA er primær KPI",
        };
    }

    if (businessCategory === "ecommerce") {
        if (revenue > 0 && intent.primaryKpi !== "CPA") {
            return {
                type: intent.type === "hybrid" ? "hybrid" : "ecommerce",
                primaryKpi: "ROAS",
                unit: "køb",
                basis:
                    intent.type === "hybrid"
                        ? "E-commerce-kunde med både salg og leads — brug rækkens kpi"
                        : "E-commerce-kunde — omsætning/ROAS er primær KPI",
                valueMissing: intent.valueMissing,
            };
        }
    }

    return intent;
}

export function detectAccountIntent(compact) {
    const businessCategory = compact?.customer?.businessCategory || "ecommerce";
    const metaInput = buildChannelIntentInput("meta", compact?.meta);
    const googleInput = buildChannelIntentInput("google", compact?.google);

    if (metaInput && compact?.meta?.last7) {
        metaInput.leads = num(compact.meta.last7.leads);
    }

    return {
        meta: metaInput
            ? applyBusinessCategoryBias(
                  detectIntent(metaInput),
                  metaInput,
                  businessCategory,
                  "meta"
              )
            : null,
        google: googleInput
            ? applyBusinessCategoryBias(
                  detectIntent(googleInput),
                  googleInput,
                  businessCategory,
                  "google"
              )
            : null,
    };
}

function rowSortScore(row) {
    if (row.kpi === "ROAS") return num(row.roas) * 1000 + num(row.spend) / 10000;
    if (row.kpi === "CPA") {
        const conv = num(row.conversions);
        return (conv ? -num(row.cpa) : 0) * 1000 + num(row.spend) / 10000;
    }
    return num(row.spend) / 1000;
}

export function rankTypes(rows, intent, options = {}) {
    const sorted = (rows || []).map((row) => {
        const base = { ...row, name: row.name || row.type };
        if (base.kpi != null) return base;
        return enrichPerformanceBriefRow(base, options);
    });

    sorted.sort((a, b) => rowSortScore(b) - rowSortScore(a));

    const hasRoas = sorted.some((r) => r.kpi === "ROAS");
    const hasCpa = sorted.some((r) => r.kpi === "CPA");
    let label = "rangeret på spend — effekt kan ikke måles";
    if (hasRoas && hasCpa) label = "rangeret pr. rækkes KPI (ROAS/CPA)";
    else if (hasRoas || intent?.primaryKpi === "ROAS") label = "rangeret på ROAS";
    else if (hasCpa || intent?.primaryKpi === "CPA") label = "rangeret på pris per lead";

    return { rows: sorted, label };
}

export function formatTypeLine(r, intent, totalSpend) {
    const name = r.name || r.type || "Ukendt";
    const share = totalSpend
        ? ` · ${Math.round((num(r.spend) / totalSpend) * 100)} % af spend`
        : r.spendSharePct != null
          ? ` · ${fmt(r.spendSharePct, 0)} % af spend`
          : "";
    const conv = num(r.conversions);
    const rowKpi = r.kpi ?? null;
    const unit = r.unit ?? (rowKpi === "CPA" ? "leads" : rowKpi === "ROAS" ? "køb" : "konv.");

    if (r.valueMissing) {
        return `${name}: køb registreret uden omsætningsværdi (tracking-fejl)${share} · ${conv} ${unit}`;
    }
    if (rowKpi === "ROAS") {
        return `${name}: ROAS ${fmt(r.roas)}${share} · ${conv} ${unit}`;
    }
    if (rowKpi === "CPA") {
        if (!conv) return `${name}: 0 leads${share} · ingen effekt i perioden`;
        return `${name}: ${fmt(r.cpa ?? safeDiv(r.spend, r.conversions), 0)} kr/lead${share} · ${conv} leads`;
    }
    return `${name}: ${fmt(r.spend, 0)} kr${share} · ingen målt konvertering`;
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

function enrichChannelRows(channel, key, intent, options = {}) {
    if (!Array.isArray(channel?.[key])) return;
    const totalSpend = channel[key].reduce((s, r) => s + num(r.spend), 0);
    const { rows } = rankTypes(channel[key], intent, options);
    channel[key] = rows.map((row) => ({
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
    const businessCategory = enriched?.customer?.businessCategory || "ecommerce";

    if (enriched.meta?.configured && !enriched.meta?.error) {
        const metaPrimaryLeadType = getPrimaryMetaLeadActionType(enriched.meta?.last7?.actions);
        const metaOpts = { platform: "meta", businessCategory, metaPrimaryLeadType };
        enrichChannelRows(enriched.meta, "adTypes", accountIntent.meta, metaOpts);
        enrichChannelRows(enriched.meta, "campaigns", accountIntent.meta, metaOpts);
    }
    if (enriched.google?.configured && !enriched.google?.error) {
        const googleOpts = { platform: "google", businessCategory };
        enrichChannelRows(enriched.google, "campaignTypes", accountIntent.google, googleOpts);
        enrichChannelRows(enriched.google, "campaigns", accountIntent.google, googleOpts);
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
