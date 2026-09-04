import {
    APEX_RADAR_CS_DEFAULT_RULES,
    APEX_RADAR_CS_DEFAULT_RULE_IDS,
    APEX_RADAR_CS_KPI_LABELS,
    APEX_RADAR_CS_PERIOD_LABELS,
    APEX_RADAR_CS_PLATFORM_LABELS,
    clampCsDropPct,
    isValidCsKpiForPlatform,
    isValidCsPeriod,
    isValidCsPlatform,
} from "@/lib/apexRadarCsConstants";

function asPlainSettings(doc) {
    if (!doc) {
        return {
            slackChannelId: "",
            slackChannelName: "",
            defaultOverrides: [],
            customRules: [],
        };
    }
    const raw = typeof doc.toObject === "function" ? doc.toObject() : doc;
    return {
        slackChannelId: String(raw.slackChannelId || ""),
        slackChannelName: String(raw.slackChannelName || "").replace(/^#/, ""),
        defaultOverrides: Array.isArray(raw.defaultOverrides) ? raw.defaultOverrides : [],
        customRules: Array.isArray(raw.customRules) ? raw.customRules : [],
    };
}

/**
 * Merge code defaults with per-customer overrides + custom rules.
 * @param {object} [settingsDoc]
 * @returns {object[]}
 */
export function mergeCsRules(settingsDoc) {
    const settings = asPlainSettings(settingsDoc);
    const overrideById = new Map();
    for (const row of settings.defaultOverrides) {
        const ruleId = String(row?.ruleId || "");
        if (!APEX_RADAR_CS_DEFAULT_RULE_IDS.has(ruleId)) continue;
        overrideById.set(ruleId, row);
    }

    const defaults = APEX_RADAR_CS_DEFAULT_RULES.map((seed) => {
        const ov = overrideById.get(seed.ruleId) || {};
        const period = isValidCsPeriod(ov.period) ? ov.period : seed.period;
        const dropPct = clampCsDropPct(ov.dropPct ?? seed.dropPct, seed.dropPct);
        const enabled = ov.enabled === false ? false : true;
        return {
            id: seed.ruleId,
            ruleId: seed.ruleId,
            kind: "default",
            platform: seed.platform,
            kpi: seed.kpi,
            period,
            dropPct,
            enabled,
        };
    });

    const custom = [];
    const seen = new Set(defaults.map((r) => r.id));
    for (const row of settings.customRules) {
        const id = String(row?.id || "").trim();
        if (!id || seen.has(id) || APEX_RADAR_CS_DEFAULT_RULE_IDS.has(id)) continue;
        if (!isValidCsPlatform(row.platform) || !isValidCsKpiForPlatform(row.platform, row.kpi)) continue;
        if (!isValidCsPeriod(row.period)) continue;
        seen.add(id);
        custom.push({
            id,
            ruleId: id,
            kind: "custom",
            platform: row.platform,
            kpi: row.kpi,
            period: row.period,
            dropPct: clampCsDropPct(row.dropPct, 70),
            enabled: row.enabled !== false,
        });
    }

    return [...defaults, ...custom];
}

export function serializeCsSettings(doc) {
    const settings = asPlainSettings(doc);
    return {
        slackChannelId: settings.slackChannelId,
        slackChannelName: settings.slackChannelName,
        defaultOverrides: settings.defaultOverrides.map((row) => ({
            ruleId: String(row.ruleId || ""),
            enabled: row.enabled !== false,
            period: isValidCsPeriod(row.period) ? row.period : undefined,
            dropPct: row.dropPct != null ? clampCsDropPct(row.dropPct) : undefined,
        })),
        customRules: mergeCsRules(settings).filter((r) => r.kind === "custom"),
        rules: mergeCsRules(settings),
    };
}

/**
 * Percent change from prior → current. Null when the change is not defined (missing / zero prior with non-zero current).
 */
export function csPctChange(current, prior) {
    if (current == null || prior == null) return null;
    const cur = Number(current);
    const prev = Number(prior);
    if (!Number.isFinite(cur) || !Number.isFinite(prev)) return null;
    if (prev === 0) return cur === 0 ? 0 : null;
    return ((cur - prev) / prev) * 100;
}

export function csRuleMeetsDrop(pctChange, dropPct) {
    if (pctChange == null || !Number.isFinite(pctChange)) return false;
    const threshold = clampCsDropPct(dropPct, 70);
    return pctChange <= -threshold;
}

function comparisonForRule(platformMetrics, rule) {
    const platform = platformMetrics?.[rule.platform];
    if (!platform) {
        return { skipReason: "platform_missing" };
    }
    if (platform.configured === false) {
        return { skipReason: platform.skipReason || "not_configured" };
    }
    if (platform.error) {
        return { skipReason: "platform_error", error: platform.error };
    }

    if (rule.kpi === "merchant_approved") {
        const merchant = platform.merchant || {};
        if (merchant.skipReason) {
            return {
                skipReason: merchant.skipReason,
                current: merchant.approved ?? null,
                prior: merchant.priorApproved ?? null,
                currentWindow: merchant.date || null,
                priorWindow: merchant.priorDate || null,
            };
        }
        return {
            current: merchant.approved ?? null,
            prior: merchant.priorApproved ?? null,
            currentWindow: merchant.date || null,
            priorWindow: merchant.priorDate || null,
            pctChange: csPctChange(merchant.approved, merchant.priorApproved),
        };
    }

    const kpi = platform.kpis?.[rule.kpi];
    const window = kpi?.[rule.period];
    if (!window) {
        return { skipReason: "no_window" };
    }
    if (window.skipReason) {
        return {
            skipReason: window.skipReason,
            current: window.current ?? null,
            prior: window.prior ?? null,
            currentWindow: window.currentLabel || null,
            priorWindow: window.priorLabel || null,
        };
    }
    return {
        current: window.current ?? null,
        prior: window.prior ?? null,
        currentWindow: window.currentLabel || null,
        priorWindow: window.priorLabel || null,
        pctChange: window.pctChange ?? csPctChange(window.current, window.prior),
    };
}

function fmtNum(n, digits = 0) {
    if (n == null || !Number.isFinite(Number(n))) return "—";
    return new Intl.NumberFormat(undefined, {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
    }).format(Number(n));
}

function fmtPct(n) {
    if (n == null || !Number.isFinite(Number(n))) return "—";
    const v = Number(n);
    const sign = v > 0 ? "+" : "";
    return `${sign}${v.toFixed(1)}%`;
}

/**
 * @param {object} platformMetrics
 * @param {object[]} rules
 * @param {{ customerId: string, customerName: string }} customer
 */
export function evaluateCsAlerts(platformMetrics, rules, customer) {
    const alerts = [];
    for (const rule of rules || []) {
        if (!rule?.enabled) continue;
        const cmp = comparisonForRule(platformMetrics, rule);
        if (cmp.skipReason) continue;
        if (!csRuleMeetsDrop(cmp.pctChange, rule.dropPct)) continue;

        const platformLabel = APEX_RADAR_CS_PLATFORM_LABELS[rule.platform] || rule.platform;
        const kpiLabel = APEX_RADAR_CS_KPI_LABELS[rule.kpi] || rule.kpi;
        const periodLabel = APEX_RADAR_CS_PERIOD_LABELS[rule.period] || rule.period;
        const drop = Math.abs(Number(cmp.pctChange));

        alerts.push({
            id: `${customer.customerId}-${rule.id}`,
            ruleId: rule.id,
            kind: rule.kind,
            platform: rule.platform,
            kpi: rule.kpi,
            period: rule.period,
            dropPct: rule.dropPct,
            severity: drop >= 90 ? "critical" : "warning",
            title: `${kpiLabel} ${periodLabel} drop`,
            message: `${kpiLabel} fell ${fmtPct(cmp.pctChange)} (${fmtNum(cmp.current, rule.kpi === "spend" || rule.kpi === "revenue" ? 0 : 1)} vs ${fmtNum(cmp.prior, rule.kpi === "spend" || rule.kpi === "revenue" ? 0 : 1)}). Threshold is a ${rule.dropPct}% drop.`,
            current: cmp.current,
            prior: cmp.prior,
            pctChange: cmp.pctChange,
            currentWindow: cmp.currentWindow,
            priorWindow: cmp.priorWindow,
            customerId: customer.customerId,
            customerName: customer.customerName,
            platformLabel,
            kpiLabel,
            periodLabel,
        });
    }
    return alerts;
}
