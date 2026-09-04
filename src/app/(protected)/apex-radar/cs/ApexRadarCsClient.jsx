"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FiAlertCircle, FiAlertTriangle, FiChevronDown, FiChevronUp, FiPlus, FiRefreshCw, FiSend, FiTrash2 } from "react-icons/fi";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { APEX_RADAR_CS_HREF } from "@/lib/apexRadarChannels";
import {
    APEX_RADAR_CS_CONFIG_WARNING_TITLE,
    APEX_RADAR_CS_KPI_LABELS,
    APEX_RADAR_CS_PERIOD_LABELS,
    APEX_RADAR_CS_PLATFORM_KPIS,
    APEX_RADAR_CS_PLATFORM_LABELS,
    APEX_RADAR_CS_PLATFORMS,
    isCsCustomerMissingService,
} from "@/lib/apexRadarCsConstants";
import { evaluateCsAlerts, csPctChange } from "@/lib/apexRadarCsRules";
import { formatApexRadarCsSlackPreview } from "@/lib/apexRadarCsSlackPreview";

const SKIP_REASON_LABELS = {
    no_google_ads_customer_id: "Google Ads account not configured",
    google_ads_not_configured: "Google Ads API credentials missing",
    no_facebook_ad_account: "Meta ad account not configured",
    facebook_token_missing: "Facebook token missing",
    no_search_console_property: "Search Console property not configured",
    no_klaviyo_key: "Klaviyo API key not configured",
    no_merchant_center_id: "Merchant Center not configured",
    no_prior_snapshot: "No prior-day Merchant snapshot yet",
    merchant_error: "Merchant Center lookup failed",
    not_configured: "Not configured",
    platform_error: "Platform error",
    no_window: "Not enough data for this period",
};

function fmtNum(n, digits = 0) {
    if (n == null || !Number.isFinite(Number(n))) return "—";
    return new Intl.NumberFormat(undefined, {
        maximumFractionDigits: digits,
        minimumFractionDigits: 0,
    }).format(Number(n));
}

function fmtPct(n) {
    if (n == null || !Number.isFinite(Number(n))) return "—";
    const v = Number(n);
    const sign = v > 0 ? "+" : "";
    return `${sign}${v.toFixed(1)}%`;
}

function kpiAlertSeverity(alerts, platformKey, kpi) {
    const hits = (alerts || []).filter((a) => a.platform === platformKey && a.kpi === kpi);
    if (!hits.length) return null;
    return hits.some((a) => a.severity === "critical") ? "critical" : "warning";
}

function ruleIsAlerting(alerts, ruleId) {
    return (alerts || []).some((a) => a.ruleId === ruleId);
}

function kpiCardClassName(severity, hasData) {
    const base = "apex-radar-cs-kpi";
    if (severity === "critical") return `${base} is-alert-critical`;
    if (severity === "warning") return `${base} is-alert-warning`;
    if (hasData) return `${base} is-ok`;
    return base;
}

function kpiDigits(kpi) {
    if (kpi === "spend" || kpi === "revenue") return 0;
    if (kpi === "conversions" || kpi === "flow_mails") return 1;
    return 0;
}

function mrkdwnToNodes(text) {
    const parts = String(text || "").split(/(\*[^*]+\*|`[^`]+`)/g);
    return parts.map((part, i) => {
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
            return <strong key={i}>{part.slice(1, -1)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
            return <code key={i}>{part.slice(1, -1)}</code>;
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
    });
}

function SlackPreview({
    preview,
    skipReason,
    channelName,
    alertCount = 0,
    sending = false,
    sendFeedback = null,
    onSend,
    sendDisabled = false,
}) {
    const blocks = preview?.blocks || [];
    const dest = channelName ? `#${String(channelName).replace(/^#/, "")}` : null;
    return (
        <section className="apex-radar-panel apex-radar-cs-preview" aria-labelledby="apex-radar-cs-preview-heading">
            <div className="apex-radar-alerts-panel__head">
                <div>
                    <h2 id="apex-radar-cs-preview-heading" className="apex-radar-section__title">
                        Message preview
                    </h2>
                    <p className="apex-radar-section__subtitle">
                        Preview of the message that will post
                        {dest ? (
                            <>
                                {" "}
                                to <span className="font-medium text-[var(--color-ink-2)]">{dest}</span>
                            </>
                        ) : (
                            " once a channel is assigned"
                        )}
                        .
                    </p>
                </div>
                <div className="apex-radar-alerts-panel__actions">
                    <button
                        type="button"
                        className="apex-radar-alerts-panel__slack-btn"
                        onClick={onSend}
                        disabled={sendDisabled || sending || skipReason === "no_slack_channel"}
                        title={
                            skipReason === "no_slack_channel"
                                ? "Assign a Slack channel first"
                                : "Send the preview message to the assigned Slack channel"
                        }
                    >
                        {sending ? (
                            <FiSend className="h-3.5 w-3.5 animate-pulse" aria-hidden />
                        ) : (
                            <FiSend className="h-3.5 w-3.5" aria-hidden />
                        )}
                        {sending ? "Sending…" : "Send alerts to Slack"}
                    </button>
                    <span
                        className={`apex-radar-alerts-panel__count${alertCount ? " has-alerts" : ""}`}
                        aria-label={`${alertCount} active alert${alertCount === 1 ? "" : "s"}`}
                    >
                        {alertCount}
                    </span>
                </div>
            </div>
            {skipReason === "no_slack_channel" ? (
                <div className="apex-radar-alerts-panel__feedback is-error" role="status">
                    Assign a Slack channel above before messages can be posted.
                </div>
            ) : null}
            {sendFeedback ? (
                <div
                    className={`apex-radar-alerts-panel__feedback is-${sendFeedback.type}`}
                    role="status"
                >
                    {sendFeedback.message}
                </div>
            ) : null}
            <div className="apex-radar-cs-preview__slack">
                {blocks.map((block, i) => {
                    if (block.type === "header") {
                        return (
                            <p key={i} className="apex-radar-cs-preview__header">
                                {block.text?.text}
                            </p>
                        );
                    }
                    if (block.type === "context") {
                        return (
                            <p key={i} className="apex-radar-cs-preview__context">
                                {mrkdwnToNodes(block.elements?.[0]?.text || "")}
                            </p>
                        );
                    }
                    if (block.type === "divider") {
                        return <hr key={i} className="apex-radar-cs-preview__divider" />;
                    }
                    if (block.type === "section") {
                        return (
                            <div key={i} className="apex-radar-cs-preview__section">
                                {String(block.text?.text || "")
                                    .split("\n")
                                    .map((line, li) => (
                                        <p key={li}>{mrkdwnToNodes(line)}</p>
                                    ))}
                            </div>
                        );
                    }
                    return null;
                })}
            </div>
        </section>
    );
}

function KpiSnapshot({ platformKey, platform, rules = [], alerts = [] }) {
    const kpis = APEX_RADAR_CS_PLATFORM_KPIS[platformKey] || [];
    if (!platform?.configured) {
        return null;
    }
    if (platform.error) {
        return <p className="apex-radar-alert">{platform.error}</p>;
    }
    return (
        <div className="apex-radar-cs-kpi-grid">
            {kpis.map((kpi) => {
                const defaultRule = rules.find(
                    (r) => r.kind === "default" && r.platform === platformKey && r.kpi === kpi
                );
                const period = defaultRule?.period || "dod";
                const severity = kpiAlertSeverity(alerts, platformKey, kpi);
                if (kpi === "merchant_approved") {
                    const m = platform.merchant || {};
                    const drop = csPctChange(m.approved, m.priorApproved);
                    const hasData = !m.skipReason;
                    return (
                        <div
                            key={kpi}
                            className={kpiCardClassName(severity, hasData)}
                            title={severity ? "Alert triggered for this KPI" : undefined}
                        >
                            <span className="apex-radar-cs-kpi__label">{APEX_RADAR_CS_KPI_LABELS[kpi]}</span>
                            <span className="apex-radar-cs-kpi__value">{fmtNum(m.approved)}</span>
                            <span className="apex-radar-cs-kpi__prior">
                                {m.skipReason
                                    ? SKIP_REASON_LABELS[m.skipReason] || m.skipReason
                                    : `vs ${fmtNum(m.priorApproved)} (${fmtPct(drop)})`}
                            </span>
                        </div>
                    );
                }
                const window = platform.kpis?.[kpi]?.[period] || platform.kpis?.[kpi]?.dod || platform.kpis?.[kpi]?.wow;
                const hasData = window?.current != null || window?.prior != null;
                return (
                    <div
                        key={kpi}
                        className={kpiCardClassName(severity, hasData)}
                        title={severity ? "Alert triggered for this KPI" : undefined}
                    >
                        <span className="apex-radar-cs-kpi__label">
                            {APEX_RADAR_CS_KPI_LABELS[kpi]} · {APEX_RADAR_CS_PERIOD_LABELS[period] || period}
                        </span>
                        <span className="apex-radar-cs-kpi__value">{fmtNum(window?.current, kpiDigits(kpi))}</span>
                        <span className="apex-radar-cs-kpi__prior">
                            vs {fmtNum(window?.prior, kpiDigits(kpi))} ({fmtPct(window?.pctChange)})
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

function RuleRow({ rule, onChange, onDelete, disabled, isAlerting = false }) {
    const [dropDraft, setDropDraft] = useState(rule.dropPct);

    useEffect(() => {
        setDropDraft(rule.dropPct);
    }, [rule.dropPct]);

    return (
        <div
            className={`apex-radar-cs-rule${rule.enabled ? "" : " is-off"}${isAlerting ? " is-alerting" : ""}`}
        >
            <label className="apex-radar-cs-rule__toggle">
                <input
                    type="checkbox"
                    checked={rule.enabled !== false}
                    disabled={disabled}
                    onChange={(e) => onChange({ ...rule, enabled: e.target.checked })}
                />
                <span>{rule.kind === "default" ? "Default" : "Custom"}</span>
            </label>
            <span className="apex-radar-cs-rule__kpi">{APEX_RADAR_CS_KPI_LABELS[rule.kpi] || rule.kpi}</span>
            <select
                className="apex-radar-cs-rule__period"
                value={rule.period}
                disabled={disabled}
                onChange={(e) => onChange({ ...rule, period: e.target.value })}
                aria-label="Period"
            >
                <option value="dod">{APEX_RADAR_CS_PERIOD_LABELS.dod}</option>
                <option value="wow">{APEX_RADAR_CS_PERIOD_LABELS.wow}</option>
            </select>
            <label className="apex-radar-cs-rule__pct">
                <input
                    type="number"
                    min={1}
                    max={100}
                    value={dropDraft}
                    disabled={disabled}
                    onChange={(e) => setDropDraft(e.target.value)}
                    onBlur={() => {
                        const n = Number(dropDraft);
                        if (Number.isFinite(n) && n !== rule.dropPct) {
                            onChange({ ...rule, dropPct: n });
                        } else {
                            setDropDraft(rule.dropPct);
                        }
                    }}
                    aria-label="Drop percent"
                />
                <span>% drop</span>
            </label>
            {rule.kind === "custom" ? (
                <button
                    type="button"
                    className="apex-radar-cs-rule__delete"
                    disabled={disabled}
                    onClick={onDelete}
                    aria-label="Delete custom alert"
                >
                    <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
            ) : (
                <span className="apex-radar-cs-rule__locked">Kept</span>
            )}
        </div>
    );
}

function MissingServiceNotice({ platformKey, skipReason }) {
    const label = APEX_RADAR_CS_PLATFORM_LABELS[platformKey] || platformKey;
    const customerMissing = isCsCustomerMissingService({ configured: false, skipReason });
    return (
        <div className="apex-radar-cs-missing" role="status" title={APEX_RADAR_CS_CONFIG_WARNING_TITLE}>
            <FiAlertTriangle className="apex-radar-cs-missing__icon" aria-hidden />
            <div>
                <p className="apex-radar-cs-missing__title">
                    {customerMissing
                        ? `This customer does not have ${label}`
                        : `${label} is not available`}
                </p>
                <p className="apex-radar-cs-missing__hint">
                    {customerMissing
                        ? APEX_RADAR_CS_CONFIG_WARNING_TITLE
                        : SKIP_REASON_LABELS[skipReason] || APEX_RADAR_CS_CONFIG_WARNING_TITLE}
                </p>
            </div>
        </div>
    );
}

function PlatformCard({
    platformKey,
    platform,
    rules,
    alerts = [],
    isOpen = false,
    onToggle,
    onRuleChange,
    onAddCustom,
    onDeleteCustom,
    saving,
}) {
    const [newKpi, setNewKpi] = useState(APEX_RADAR_CS_PLATFORM_KPIS[platformKey]?.[0] || "conversions");
    const [newPeriod, setNewPeriod] = useState("dod");
    const [newDrop, setNewDrop] = useState(70);
    const defaults = rules.filter((r) => r.kind === "default" && r.platform === platformKey);
    const custom = rules.filter((r) => r.kind === "custom" && r.platform === platformKey);
    const kpis = APEX_RADAR_CS_PLATFORM_KPIS[platformKey] || [];
    const missing = !platform?.configured;
    const platformAlerts = alerts.filter((a) => a.platform === platformKey);
    const panelId = `apex-radar-cs-platform-${platformKey}`;

    return (
        <section
            className={`apex-radar-panel apex-radar-cs-accordion-item${
                isOpen ? " is-open" : ""
            }${platformAlerts.length ? " has-alerts" : ""}`}
        >
            <button
                type="button"
                className="apex-radar-cs-accordion-trigger"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={onToggle}
            >
                <span className="apex-radar-cs-accordion-title">
                    {APEX_RADAR_CS_PLATFORM_LABELS[platformKey]}
                    {missing ? (
                        <FiAlertTriangle
                            className="apex-radar-cs-platform-title__warn"
                            aria-label="Integration not configured"
                            title={APEX_RADAR_CS_CONFIG_WARNING_TITLE}
                        />
                    ) : null}
                </span>
                <span className="apex-radar-cs-accordion-meta">
                    {platformAlerts.length > 0 ? (
                        <span className="apex-radar-cs-accordion-badge" aria-label={`${platformAlerts.length} active alerts`}>
                            {platformAlerts.length}
                        </span>
                    ) : null}
                    <span className="apex-radar-cs-accordion-chevron" aria-hidden>
                        {isOpen ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
                    </span>
                </span>
            </button>
            <div id={panelId} className="apex-radar-cs-accordion-panel" hidden={!isOpen}>
                <div className="apex-radar-cs-accordion-panel__inner">
                    {missing ? (
                        <MissingServiceNotice platformKey={platformKey} skipReason={platform?.skipReason} />
                    ) : (
                        <>
                            <KpiSnapshot
                                platformKey={platformKey}
                                platform={platform}
                                rules={rules}
                                alerts={alerts}
                            />
                            <details className="apex-radar-cs-details">
                                <summary className="apex-radar-cs-details__summary">
                                    Default alerts
                                    <span className="apex-radar-cs-details__count">{defaults.length}</span>
                                </summary>
                                <div className="apex-radar-cs-details__body">
                                    {defaults.map((rule) => (
                                        <RuleRow
                                            key={rule.id}
                                            rule={rule}
                                            disabled={saving}
                                            isAlerting={ruleIsAlerting(alerts, rule.id)}
                                            onChange={(next) => onRuleChange(next)}
                                        />
                                    ))}
                                </div>
                            </details>
                            <div className="apex-radar-cs-rules">
                                <p className="apex-radar-field-label">Custom alerts</p>
                                {custom.length === 0 ? (
                                    <p className="apex-radar-field-hint">None yet. Add a KPI and period below.</p>
                                ) : (
                                    custom.map((rule) => (
                                        <RuleRow
                                            key={rule.id}
                                            rule={rule}
                                            disabled={saving}
                                            isAlerting={ruleIsAlerting(alerts, rule.id)}
                                            onChange={(next) => onRuleChange(next)}
                                            onDelete={() => onDeleteCustom(rule.id)}
                                        />
                                    ))
                                )}
                                <div className="apex-radar-cs-add">
                                    <select
                                        value={newKpi}
                                        onChange={(e) => setNewKpi(e.target.value)}
                                        aria-label="KPI"
                                    >
                                        {kpis.map((kpi) => (
                                            <option key={kpi} value={kpi}>
                                                {APEX_RADAR_CS_KPI_LABELS[kpi]}
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        value={newPeriod}
                                        onChange={(e) => setNewPeriod(e.target.value)}
                                        aria-label="Period"
                                    >
                                        <option value="dod">DoD</option>
                                        <option value="wow">WoW</option>
                                    </select>
                                    <input
                                        type="number"
                                        min={1}
                                        max={100}
                                        value={newDrop}
                                        onChange={(e) => setNewDrop(Number(e.target.value))}
                                        aria-label="Drop percent"
                                    />
                                    <button
                                        type="button"
                                        className="apex-perf-btn apex-perf-btn--ghost"
                                        disabled={saving}
                                        onClick={() =>
                                            onAddCustom({
                                                platform: platformKey,
                                                kpi: newKpi,
                                                period: newPeriod,
                                                dropPct: newDrop,
                                            })
                                        }
                                    >
                                        <FiPlus className="h-3.5 w-3.5" aria-hidden />
                                        Add
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}

export default function ApexRadarCsClient({ customerId }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [saveError, setSaveError] = useState(null);
    const [customer, setCustomer] = useState(null);
    const [platforms, setPlatforms] = useState(null);
    const [rules, setRules] = useState([]);
    const [slackChannelId, setSlackChannelId] = useState("");
    const [slackChannelName, setSlackChannelName] = useState("");
    const [channels, setChannels] = useState([]);
    const [channelsLoading, setChannelsLoading] = useState(false);
    const [channelsLoaded, setChannelsLoaded] = useState(false);
    const [channelQuery, setChannelQuery] = useState("");
    const [channelsError, setChannelsError] = useState(null);
    const [dateRange, setDateRange] = useState(null);
    const [slackSending, setSlackSending] = useState(false);
    const [slackSendFeedback, setSlackSendFeedback] = useState(null);
    const [openPlatforms, setOpenPlatforms] = useState(() => new Set());
    const openPlatformsInitialized = useRef(false);

    const loadOverview = useCallback(async () => {
        if (!customerId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/apex-radar/cs/overview?customerId=${encodeURIComponent(customerId)}`
            );
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to load CS overview");
            setCustomer(data.customer);
            setPlatforms(data.platforms);
            setRules(data.rules || []);
            setSlackChannelId(data.slack?.channelId || "");
            setSlackChannelName(data.slack?.channelName || "");
            setDateRange(data.dateRange || null);
        } catch (e) {
            setError(e.message || "Failed to load CS overview");
        } finally {
            setLoading(false);
        }
    }, [customerId]);

    const loadChannels = useCallback(async () => {
        if (channelsLoaded || channelsLoading) return;
        setChannelsLoading(true);
        setChannelsError(null);
        try {
            const res = await fetch("/api/apex-radar/cs/slack-channels");
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to list Slack channels");
            setChannels(data.channels || []);
            setChannelsLoaded(true);
        } catch (e) {
            setChannelsError(e.message || "Failed to list Slack channels");
        } finally {
            setChannelsLoading(false);
        }
    }, [channelsLoaded, channelsLoading]);

    useEffect(() => {
        setPlatforms(null);
        setCustomer(null);
        setRules([]);
        setError(null);
        setSlackSendFeedback(null);
        setOpenPlatforms(new Set());
        openPlatformsInitialized.current = false;
        loadOverview();
    }, [loadOverview]);

    const alerts = useMemo(() => {
        if (!platforms || !customer) return [];
        return evaluateCsAlerts(platforms, rules, customer);
    }, [platforms, rules, customer]);

    useEffect(() => {
        if (!platforms || openPlatformsInitialized.current) return;
        openPlatformsInitialized.current = true;
        const next = new Set();
        for (const key of APEX_RADAR_CS_PLATFORMS) {
            if (alerts.some((a) => a.platform === key)) next.add(key);
        }
        setOpenPlatforms(next);
    }, [platforms, alerts]);

    const togglePlatform = useCallback((platformKey) => {
        setOpenPlatforms((prev) => {
            const next = new Set(prev);
            if (next.has(platformKey)) next.delete(platformKey);
            else next.add(platformKey);
            return next;
        });
    }, []);

    const slackPreview = useMemo(
        () =>
            formatApexRadarCsSlackPreview({
                alerts,
                customerName: customer?.customerName,
                channelName: slackChannelName,
            }),
        [alerts, customer, slackChannelName]
    );

    const persistRules = useCallback(
        async (nextRules, slackPatch = null) => {
            if (!customerId) return;
            setSaving(true);
            setSaveError(null);
            try {
                const body = {
                    defaultOverrides: nextRules
                        .filter((r) => r.kind === "default")
                        .map((r) => ({
                            ruleId: r.ruleId || r.id,
                            enabled: r.enabled !== false,
                            period: r.period,
                            dropPct: r.dropPct,
                        })),
                    customRules: nextRules
                        .filter((r) => r.kind === "custom")
                        .map((r) => ({
                            id: r.id,
                            platform: r.platform,
                            kpi: r.kpi,
                            period: r.period,
                            dropPct: r.dropPct,
                            enabled: r.enabled !== false,
                        })),
                };
                if (slackPatch) {
                    body.slackChannelId = slackPatch.id;
                    body.slackChannelName = slackPatch.name;
                }
                const res = await fetch(
                    `/api/apex-radar/cs/settings?customerId=${encodeURIComponent(customerId)}`,
                    {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ...body, customerId }),
                    }
                );
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || "Failed to save settings");
                if (data.settings?.rules) setRules(data.settings.rules);
            } catch (e) {
                setSaveError(e.message || "Failed to save");
            } finally {
                setSaving(false);
            }
        },
        [customerId]
    );

    const handleRuleChange = (next) => {
        const nextRules = rules.map((r) => (r.id === next.id ? next : r));
        setRules(nextRules);
        persistRules(nextRules);
    };

    const handleDeleteCustom = (id) => {
        const nextRules = rules.filter((r) => r.id !== id);
        setRules(nextRules);
        persistRules(nextRules);
    };

    const handleAddCustom = ({ platform, kpi, period, dropPct }) => {
        const next = {
            id: crypto.randomUUID(),
            ruleId: undefined,
            kind: "custom",
            platform,
            kpi,
            period,
            dropPct: Number(dropPct) || 70,
            enabled: true,
        };
        const nextRules = [...rules, next];
        setRules(nextRules);
        persistRules(nextRules);
    };

    const handleSlackChange = (channelId) => {
        const ch = channels.find((c) => c.id === channelId);
        const name = ch?.name || "";
        setSlackChannelId(channelId);
        setSlackChannelName(name);
        persistRules(rules, { id: channelId, name });
    };

    const filteredChannels = useMemo(() => {
        const q = channelQuery.trim().toLowerCase();
        if (!q) return channels;
        return channels.filter((c) => c.name.toLowerCase().includes(q));
    }, [channels, channelQuery]);

    const handleSendSlack = useCallback(async () => {
        if (!customerId || !slackChannelId) return;
        setSlackSending(true);
        setSlackSendFeedback(null);
        try {
            const res = await fetch("/api/apex-radar/cs/slack/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerId,
                    alerts,
                    customerName: customer?.customerName,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || "Failed to send Slack message");
            }

            const channelLabel = data.channelName ? `#${data.channelName}` : `#${slackChannelName}`;
            const alertLabel =
                data.alertCount === 1 ? "1 alert" : `${data.alertCount ?? alerts.length} alerts`;
            setSlackSendFeedback({
                type: "success",
                message: `Posted ${alertLabel} to ${channelLabel}.`,
            });
        } catch (e) {
            setSlackSendFeedback({
                type: "error",
                message: e.message || "Could not send Slack message.",
            });
        } finally {
            setSlackSending(false);
        }
    }, [customerId, slackChannelId, slackChannelName, alerts, customer?.customerName]);

    return (
        <div className="apex-radar-stack">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="CS · Client Strategists"
                label={customer?.customerName || "CS"}
                showAnalyzeWithAi={false}
                showPdfExport={false}
                dateRange={dateRange || undefined}
                loading={loading}
            />

            <div className="apex-radar-panel apex-radar-panel--padded">
                <div className="apex-radar-cs-toolbar">
                    <div>
                        <h1 className="apex-radar-section__title">Slack destination</h1>
                        <p className="apex-radar-section__subtitle">
                            Assign this customer to a Slack channel, then send alerts manually from the preview below.
                        </p>
                    </div>
                    <div className="apex-radar-cs-toolbar__actions">
                    <button
                        type="button"
                        className="apex-radar-alerts-panel__slack-btn"
                        onClick={() => loadOverview()}
                        disabled={loading || saving}
                    >
                        <FiRefreshCw className={`h-3.5 w-3.5${loading ? " animate-spin" : ""}`} aria-hidden />
                        Refresh
                    </button>
                    <Link href={APEX_RADAR_CS_HREF} className="apex-perf-btn apex-perf-btn--ghost">
                        Change customer
                    </Link>
                    </div>
                </div>
                <div className="apex-radar-form apex-radar-cs-slack-form">
                    <label className="apex-radar-field-label" htmlFor="cs-slack-search">
                        Filter channels
                    </label>
                    <input
                        id="cs-slack-search"
                        type="search"
                        value={channelQuery}
                        onChange={(e) => setChannelQuery(e.target.value)}
                        placeholder="Search channel name"
                    />
                    <label className="apex-radar-field-label" htmlFor="cs-slack-channel">
                        Slack channel
                    </label>
                    <select
                        id="cs-slack-channel"
                        value={slackChannelId}
                        onFocus={loadChannels}
                        onChange={(e) => handleSlackChange(e.target.value)}
                        disabled={saving || loading || channelsLoading}
                    >
                        <option value="">
                            {channelsLoading
                                ? "Loading channels…"
                                : channelsLoaded
                                  ? "Select a channel"
                                  : "Select a channel (loads list on focus)"}
                        </option>
                        {slackChannelId &&
                        !filteredChannels.some((c) => c.id === slackChannelId) ? (
                            <option value={slackChannelId}>
                                #{slackChannelName || slackChannelId}
                            </option>
                        ) : null}
                        {filteredChannels.map((c) => (
                            <option key={c.id} value={c.id}>
                                #{c.name}
                                {c.isPrivate ? " (private)" : ""}
                                {c.isMember ? "" : " — bot not a member"}
                            </option>
                        ))}
                    </select>
                    {channelsError ? <p className="apex-radar-alert mt-2">{channelsError}</p> : null}
                    {saveError ? <p className="apex-radar-alert mt-2">{saveError}</p> : null}
                </div>
            </div>

            {error ? <div className="apex-radar-alert">{error}</div> : null}

            {loading && !platforms ? (
                <CobaltLoader variant="block" title="Loading CS metrics" />
            ) : platforms ? (
                <div className="apex-radar-cs-platforms apex-radar-cs-accordion">
                    {APEX_RADAR_CS_PLATFORMS.map((key) => (
                        <PlatformCard
                            key={key}
                            platformKey={key}
                            platform={platforms?.[key]}
                            rules={rules}
                            alerts={alerts}
                            isOpen={openPlatforms.has(key)}
                            onToggle={() => togglePlatform(key)}
                            saving={saving}
                            onRuleChange={handleRuleChange}
                            onAddCustom={handleAddCustom}
                            onDeleteCustom={handleDeleteCustom}
                        />
                    ))}
                </div>
            ) : null}

            <SlackPreview
                preview={slackPreview}
                skipReason={slackChannelId ? null : "no_slack_channel"}
                channelName={slackChannelName}
                alertCount={alerts.length}
                sending={slackSending}
                sendFeedback={slackSendFeedback}
                onSend={handleSendSlack}
                sendDisabled={loading || saving}
            />

            {alerts.length > 0 ? (
                <ul className="apex-radar-alerts-list apex-radar-panel">
                    {alerts.map((alert) => (
                        <li
                            key={alert.id}
                            className={`apex-radar-alerts-item is-${alert.severity || "warning"}`}
                        >
                            <div className="apex-radar-alerts-item__icon" aria-hidden>
                                {alert.severity === "critical" ? (
                                    <FiAlertCircle className="h-4 w-4" />
                                ) : (
                                    <FiAlertTriangle className="h-4 w-4" />
                                )}
                            </div>
                            <div className="apex-radar-alerts-item__main min-w-0">
                                <div className="apex-radar-alerts-item__meta">
                                    <span className="apex-radar-alerts-item__customer">{alert.platformLabel}</span>
                                    <span className="apex-radar-alerts-item__type">{alert.kpiLabel}</span>
                                </div>
                                <p className="apex-radar-alerts-item__title">{alert.title}</p>
                                <p className="apex-radar-alerts-item__message">{alert.message}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}
