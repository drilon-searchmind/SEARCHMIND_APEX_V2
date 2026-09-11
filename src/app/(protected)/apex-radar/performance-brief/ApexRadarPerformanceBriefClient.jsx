"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiAlertTriangle, FiRefreshCw, FiSend } from "react-icons/fi";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { APEX_RADAR_PERFORMANCE_BRIEF_HREF } from "@/lib/apexRadarChannels";
import PerformanceBriefNavTabs from "./PerformanceBriefNavTabs";
import {
    PERFORMANCE_BRIEF_CONFIG_WARNING_TITLE,
    PERFORMANCE_BRIEF_PLATFORM_LABELS,
} from "@/lib/performanceBriefConstants";
import { formatPerformanceBriefSlack } from "@/lib/performanceBriefSlackPreview";
import {
    DEFAULT_SCHEDULE_DAY_OF_WEEK,
    DEFAULT_SCHEDULE_HOUR,
    SCHEDULE_DAY_OPTIONS,
    SCHEDULE_HOUR_OPTIONS,
    formatPerformanceBriefScheduleLabel,
} from "@/lib/performanceBriefSchedule";

const SKIP_REASON_LABELS = {
    no_google_ads_customer_id: "Google Ads account not configured",
    google_ads_not_configured: "Google Ads API credentials missing",
    no_facebook_ad_account: "Meta ad account not configured",
    facebook_token_missing: "Facebook token missing",
    not_configured: "Not configured",
};

const SLACK_EMOJI = {
    ":large_green_circle:": "🟢",
    ":large_yellow_circle:": "🟡",
    ":red_circle:": "🔴",
    ":white_circle:": "⚪",
    ":trophy:": "🏆",
    ":dart:": "🎯",
    ":fire:": "🔥",
};

function mrkdwnToNodes(text) {
    const parts = String(text || "").split(/(\*[^*]+\*|`[^`]+`|:[a-z0-9_+-]+:)/g);
    return parts.map((part, i) => {
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
            return <strong key={i}>{part.slice(1, -1)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
            return <code key={i}>{part.slice(1, -1)}</code>;
        }
        if (SLACK_EMOJI[part]) {
            return <span key={i}>{SLACK_EMOJI[part]}</span>;
        }
        if (/^:[a-z0-9_+-]+:$/.test(part)) {
            return (
                <span key={i} className="apex-radar-brief-emoji">
                    {part}
                </span>
            );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
    });
}

function tableCellText(cell) {
    if (!cell || typeof cell !== "object") return "";
    if (typeof cell.text === "string") return cell.text;
    if (cell.value != null) return String(cell.value);
    const sections = Array.isArray(cell.elements) ? cell.elements : [];
    return sections
        .flatMap((section) => (Array.isArray(section.elements) ? section.elements : []))
        .map((el) => {
            if (el?.type === "emoji") return SLACK_EMOJI[`:${el.name}:`] || el.unicode || "";
            return el?.text || "";
        })
        .join("");
}

function PreviewTable({ block }) {
    const rows = Array.isArray(block?.rows) ? block.rows : [];
    if (!rows.length) return null;
    const [header, ...body] = rows;
    return (
        <div className="apex-radar-brief-table-wrap">
            <table className="apex-radar-brief-table">
                <thead>
                    <tr>
                        {header.map((cell, i) => (
                            <th key={i}>{tableCellText(cell)}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {body.map((row, ri) => (
                        <tr key={ri}>
                            {row.map((cell, ci) => (
                                <td key={ci}>{tableCellText(cell)}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function SlackPreview({
    preview,
    skipReason,
    channelName,
    sending = false,
    sendFeedback = null,
    onSend,
    sendDisabled = false,
}) {
    const blocks = preview?.blocks || [];
    const dest = channelName ? `#${String(channelName).replace(/^#/, "")}` : null;
    return (
        <section
            className="apex-radar-panel apex-radar-cs-preview"
            aria-labelledby="apex-radar-brief-preview-heading"
        >
            <div className="apex-radar-alerts-panel__head">
                <div>
                    <h2 id="apex-radar-brief-preview-heading" className="apex-radar-section__title">
                        Message preview
                    </h2>
                    <p className="apex-radar-section__subtitle">
                        Preview of the weekly brief that will post
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
                        disabled={sendDisabled || sending || skipReason === "no_slack_channel" || !preview}
                        title={
                            skipReason === "no_slack_channel"
                                ? "Assign a Slack channel first"
                                : "Send the brief to the assigned Slack channel"
                        }
                    >
                        {sending ? (
                            <FiSend className="h-3.5 w-3.5 animate-pulse" aria-hidden />
                        ) : (
                            <FiSend className="h-3.5 w-3.5" aria-hidden />
                        )}
                        {sending ? "Sending…" : "Send brief to Slack"}
                    </button>
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
            {!preview ? (
                <p className="apex-radar-empty px-4 py-6">Generate a brief to see the Slack preview.</p>
            ) : (
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
                        if (block.type === "table") {
                            return <PreviewTable key={i} block={block} />;
                        }
                        return null;
                    })}
                </div>
            )}
        </section>
    );
}

function PlatformStatus({ label, platform, accountIntent, businessCategory }) {
    if (!platform) return null;
    if (!platform.configured) {
        return (
            <div className="apex-radar-cs-missing" role="status">
                <FiAlertTriangle className="apex-radar-cs-missing__icon" aria-hidden />
                <div>
                    <p className="apex-radar-cs-missing__title">{label} is not configured</p>
                    <p className="apex-radar-cs-missing__hint">
                        {SKIP_REASON_LABELS[platform.skipReason] || PERFORMANCE_BRIEF_CONFIG_WARNING_TITLE}
                    </p>
                </div>
            </div>
        );
    }
    if (platform.error) {
        return <p className="apex-radar-alert">{platform.error}</p>;
    }
    const w7 = platform.last7 || {};
    const isB2b = businessCategory === "b2b" || accountIntent?.primaryKpi === "CPA";
    const leadCount = w7.leads ?? w7.conversions;
    return (
        <div className="apex-radar-cs-kpi-grid">
            <div className="apex-radar-cs-kpi is-ok">
                <span className="apex-radar-cs-kpi__label">Spend 7d</span>
                <span className="apex-radar-cs-kpi__value">
                    {new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(w7.spend || 0)}
                </span>
            </div>
            {isB2b ? (
                <>
                    <div className="apex-radar-cs-kpi is-ok">
                        <span className="apex-radar-cs-kpi__label">Leads 7d</span>
                        <span className="apex-radar-cs-kpi__value">
                            {leadCount != null
                                ? new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(
                                      leadCount
                                  )
                                : "—"}
                        </span>
                    </div>
                    <div className="apex-radar-cs-kpi is-ok">
                        <span className="apex-radar-cs-kpi__label">CPA 7d</span>
                        <span className="apex-radar-cs-kpi__value">
                            {w7.cpl != null || w7.cpa != null
                                ? new Intl.NumberFormat("da-DK", {
                                      maximumFractionDigits: 0,
                                  }).format(w7.cpl ?? w7.cpa)
                                : "—"}
                        </span>
                    </div>
                </>
            ) : (
                <>
                    <div className="apex-radar-cs-kpi is-ok">
                        <span className="apex-radar-cs-kpi__label">ROAS 7d</span>
                        <span className="apex-radar-cs-kpi__value">
                            {w7.roas != null
                                ? new Intl.NumberFormat("da-DK", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                  }).format(w7.roas)
                                : "—"}
                        </span>
                    </div>
                    <div className="apex-radar-cs-kpi is-ok">
                        <span className="apex-radar-cs-kpi__label">Conv. 7d</span>
                        <span className="apex-radar-cs-kpi__value">
                            {w7.conversions != null
                                ? new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 }).format(
                                      w7.conversions
                                  )
                                : "—"}
                        </span>
                    </div>
                </>
            )}
        </div>
    );
}

export default function ApexRadarPerformanceBriefClient({ customerId }) {
    const [settingsLoading, setSettingsLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [saveError, setSaveError] = useState(null);
    const [customerName, setCustomerName] = useState("");
    const [customer, setCustomer] = useState(null);
    const [windows, setWindows] = useState(null);
    const [meta, setMeta] = useState(null);
    const [google, setGoogle] = useState(null);
    const [accountIntent, setAccountIntent] = useState(null);
    const [narrative, setNarrative] = useState(null);
    const [claude, setClaude] = useState(null);
    const [slackChannelId, setSlackChannelId] = useState("");
    const [slackChannelName, setSlackChannelName] = useState("");
    const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState(DEFAULT_SCHEDULE_DAY_OF_WEEK);
    const [scheduleHour, setScheduleHour] = useState(DEFAULT_SCHEDULE_HOUR);
    const [channels, setChannels] = useState([]);
    const [channelsLoading, setChannelsLoading] = useState(false);
    const [channelsLoaded, setChannelsLoaded] = useState(false);
    const [channelQuery, setChannelQuery] = useState("");
    const [channelsError, setChannelsError] = useState(null);
    const [slackSending, setSlackSending] = useState(false);
    const [slackSendFeedback, setSlackSendFeedback] = useState(null);

    const loadSettings = useCallback(async () => {
        if (!customerId) return;
        const res = await fetch(
            `/api/apex-radar/performance-brief/settings?customerId=${encodeURIComponent(customerId)}`
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to load settings");
        setCustomerName(data.customerName || "");
        setSlackChannelId(data.settings?.slackChannelId || "");
        setSlackChannelName(data.settings?.slackChannelName || "");
        setScheduleDayOfWeek(
            data.settings?.scheduleDayOfWeek ?? DEFAULT_SCHEDULE_DAY_OF_WEEK
        );
        setScheduleHour(data.settings?.scheduleHour ?? DEFAULT_SCHEDULE_HOUR);
    }, [customerId]);

    const generateBrief = useCallback(async () => {
        if (!customerId) return;
        setGenerating(true);
        setError(null);
        setSlackSendFeedback(null);
        try {
            const res = await fetch("/api/apex-radar/performance-brief/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customerId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to generate Performance Brief");
            setCustomer(data.customer);
            if (data.customer?.customerName) {
                setCustomerName(data.customer.customerName);
            }
            setWindows(data.windows);
            setMeta(data.meta);
            setGoogle(data.google);
            setAccountIntent(data.accountIntent || null);
            setNarrative(data.narrative);
            setClaude(data.claude);
            if (data.slack) {
                setSlackChannelId(data.slack.channelId || "");
                setSlackChannelName(data.slack.channelName || "");
            }
        } catch (e) {
            setError(e.message || "Failed to generate Performance Brief");
        } finally {
            setGenerating(false);
        }
    }, [customerId]);

    const loadChannels = useCallback(async () => {
        if (channelsLoaded || channelsLoading) return;
        setChannelsLoading(true);
        setChannelsError(null);
        try {
            const res = await fetch("/api/apex-radar/performance-brief/slack-channels");
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
        setCustomerName("");
        setCustomer(null);
        setMeta(null);
        setGoogle(null);
        setAccountIntent(null);
        setNarrative(null);
        setError(null);
        setSlackSendFeedback(null);
        setSettingsLoading(true);
        loadSettings()
            .catch((e) => setError(e.message || "Failed to load settings"))
            .finally(() => setSettingsLoading(false));
    }, [loadSettings, customerId]);

    const slackPreview = useMemo(() => {
        if (!customer || (!meta && !google)) return null;
        return formatPerformanceBriefSlack({
            compact: { customer, windows, meta, google, accountIntent },
            narrative,
            channelName: slackChannelName,
            preview: true,
            customerId,
        });
    }, [customer, windows, meta, google, accountIntent, narrative, slackChannelName, customerId]);

    const persistSettings = useCallback(
        async (patch) => {
            if (!customerId) return;
            setSaving(true);
            setSaveError(null);
            try {
                const res = await fetch(
                    `/api/apex-radar/performance-brief/settings?customerId=${encodeURIComponent(customerId)}`,
                    {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            customerId,
                            ...patch,
                        }),
                    }
                );
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || "Failed to save settings");
                if (data.settings) {
                    setSlackChannelId(data.settings.slackChannelId || "");
                    setSlackChannelName(data.settings.slackChannelName || "");
                    setScheduleDayOfWeek(
                        data.settings.scheduleDayOfWeek ?? DEFAULT_SCHEDULE_DAY_OF_WEEK
                    );
                    setScheduleHour(data.settings.scheduleHour ?? DEFAULT_SCHEDULE_HOUR);
                }
            } catch (e) {
                setSaveError(e.message || "Failed to save");
            } finally {
                setSaving(false);
            }
        },
        [customerId]
    );

    const handleSlackChange = (channelId) => {
        const ch = channels.find((c) => c.id === channelId);
        const name = ch?.name || "";
        setSlackChannelId(channelId);
        setSlackChannelName(name);
        persistSettings({
            slackChannelId: channelId,
            slackChannelName: name,
        });
    };

    const handleScheduleDayChange = (day) => {
        const nextDay = Number(day);
        setScheduleDayOfWeek(nextDay);
        persistSettings({ scheduleDayOfWeek: nextDay });
    };

    const handleScheduleHourChange = (hour) => {
        const nextHour = Number(hour);
        setScheduleHour(nextHour);
        persistSettings({ scheduleHour: nextHour });
    };

    const scheduleLabel = useMemo(
        () =>
            formatPerformanceBriefScheduleLabel({
                scheduleDayOfWeek,
                scheduleHour,
            }),
        [scheduleDayOfWeek, scheduleHour]
    );

    const filteredChannels = useMemo(() => {
        const q = channelQuery.trim().toLowerCase();
        if (!q) return channels;
        return channels.filter((c) => c.name.toLowerCase().includes(q));
    }, [channels, channelQuery]);

    const handleSendSlack = useCallback(async () => {
        if (!customerId || !slackChannelId || !slackPreview || !customer) return;
        setSlackSending(true);
        setSlackSendFeedback(null);
        try {
            const slackPreviewForSend = formatPerformanceBriefSlack({
                compact: { customer, windows, meta, google, accountIntent },
                narrative,
                channelName: slackChannelName,
                customerId,
            });
            const res = await fetch("/api/apex-radar/performance-brief/slack/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerId,
                    slackPreview: slackPreviewForSend,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to send Slack message");
            const channelLabel = data.channelName ? `#${data.channelName}` : `#${slackChannelName}`;
            setSlackSendFeedback({
                type: "success",
                message: `Posted Performance Brief to ${channelLabel}.`,
            });
        } catch (e) {
            setSlackSendFeedback({
                type: "error",
                message: e.message || "Could not send Slack message.",
            });
        } finally {
            setSlackSending(false);
        }
    }, [
        customerId,
        slackChannelId,
        slackChannelName,
        slackPreview,
        customer,
        windows,
        meta,
        google,
        accountIntent,
        narrative,
    ]);

    const dateRange = windows?.last7
        ? { startDate: windows.last7.start, endDate: windows.last7.end }
        : undefined;

    return (
        <div className="apex-radar-stack">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Performance Brief"
                label={
                    customer?.customerName ||
                    customerName ||
                    "Performance Brief"
                }
                showAnalyzeWithAi={false}
                showPdfExport={false}
                dateRange={dateRange}
                loading={settingsLoading || generating}
            />

            <PerformanceBriefNavTabs />

            <div className="apex-radar-panel apex-radar-panel--padded">
                <div className="apex-radar-cs-toolbar">
                    <div>
                        <h1 className="apex-radar-section__title">
                            {customerName || customer?.customerName || "Customer"}
                        </h1>
                        <p className="apex-radar-section__subtitle">
                            Slack &amp; schedule — assign a channel and weekly send time
                            (Europe/Copenhagen). The cron posts automatically at the scheduled time;
                            you can also generate and send manually below.
                        </p>
                    </div>
                    <div className="apex-radar-cs-toolbar__actions">
                        <button
                            type="button"
                            className="apex-radar-alerts-panel__slack-btn"
                            onClick={() => generateBrief()}
                            disabled={settingsLoading || generating || saving}
                        >
                            <FiRefreshCw
                                className={`h-3.5 w-3.5${generating ? " animate-spin" : ""}`}
                                aria-hidden
                            />
                            {generating ? "Generating…" : "Generate brief"}
                        </button>
                        <Link
                            href={APEX_RADAR_PERFORMANCE_BRIEF_HREF}
                            className="apex-perf-btn apex-perf-btn--ghost"
                        >
                            Change customer
                        </Link>
                    </div>
                </div>
                <div className="apex-radar-form apex-radar-cs-slack-form">
                    <label className="apex-radar-field-label" htmlFor="brief-slack-search">
                        Filter channels
                    </label>
                    <input
                        id="brief-slack-search"
                        type="search"
                        value={channelQuery}
                        onChange={(e) => setChannelQuery(e.target.value)}
                        placeholder="Search channel name"
                    />
                    <label className="apex-radar-field-label" htmlFor="brief-slack-channel">
                        Slack channel
                    </label>
                    <select
                        id="brief-slack-channel"
                        value={slackChannelId}
                        onFocus={loadChannels}
                        onChange={(e) => handleSlackChange(e.target.value)}
                        disabled={saving || generating || channelsLoading}
                    >
                        <option value="">
                            {channelsLoading
                                ? "Loading channels…"
                                : channelsLoaded
                                  ? "Select a channel"
                                  : "Select a channel (loads list on focus)"}
                        </option>
                        {slackChannelId && !filteredChannels.some((c) => c.id === slackChannelId) ? (
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
                    <label className="apex-radar-field-label" htmlFor="brief-schedule-day">
                        Weekly send time
                    </label>
                    <div className="apex-radar-brief-bulk-schedule">
                        <select
                            id="brief-schedule-day"
                            value={scheduleDayOfWeek}
                            onChange={(e) => handleScheduleDayChange(e.target.value)}
                            disabled={saving || generating}
                            className="apex-radar-brief-bulk-select apex-radar-brief-bulk-select--schedule"
                            aria-label="Schedule day"
                        >
                            {SCHEDULE_DAY_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        <select
                            id="brief-schedule-hour"
                            value={scheduleHour}
                            onChange={(e) => handleScheduleHourChange(e.target.value)}
                            disabled={saving || generating}
                            className="apex-radar-brief-bulk-select apex-radar-brief-bulk-select--schedule"
                            aria-label="Schedule hour"
                        >
                            {SCHEDULE_HOUR_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <p className="apex-radar-section__subtitle mt-2">
                        Cron posts every{" "}
                        <span className="font-medium text-[var(--color-ink-2)]">{scheduleLabel}</span>{" "}
                        when a Slack channel is assigned.
                    </p>
                    {channelsError ? <p className="apex-radar-alert mt-2">{channelsError}</p> : null}
                    {saveError ? <p className="apex-radar-alert mt-2">{saveError}</p> : null}
                    {saving ? (
                        <p className="apex-radar-section__subtitle mt-2" role="status">
                            Saving…
                        </p>
                    ) : null}
                </div>
            </div>

            {error ? <div className="apex-radar-alert">{error}</div> : null}
            {claude?.error ? (
                <div className="apex-radar-alert">
                    Claude analysis: {claude.error}. Tables still use live numbers.
                </div>
            ) : null}

            {settingsLoading ? (
                <CobaltLoader variant="block" title="Loading settings" />
            ) : generating && !customer ? (
                <CobaltLoader variant="block" title="Generating Performance Brief" />
            ) : customer ? (
                <div className="apex-radar-cs-platforms">
                    <section className="apex-radar-panel apex-radar-panel--padded">
                        <h2 className="apex-radar-section__title">
                            {PERFORMANCE_BRIEF_PLATFORM_LABELS.meta}
                        </h2>
                        <PlatformStatus
                            label="Meta"
                            platform={meta}
                            accountIntent={accountIntent?.meta}
                            businessCategory={customer?.businessCategory}
                        />
                    </section>
                    <section className="apex-radar-panel apex-radar-panel--padded">
                        <h2 className="apex-radar-section__title">
                            {PERFORMANCE_BRIEF_PLATFORM_LABELS["google-ads"]}
                        </h2>
                        <PlatformStatus
                            label="Google Ads"
                            platform={google}
                            accountIntent={accountIntent?.google}
                            businessCategory={customer?.businessCategory}
                        />
                    </section>
                </div>
            ) : (
                <p className="apex-radar-empty px-4 py-6">
                    Click &ldquo;Generate brief&rdquo; to load channel performance and preview the
                    Slack message.
                </p>
            )}

            <SlackPreview
                preview={slackPreview}
                skipReason={slackChannelId ? null : "no_slack_channel"}
                channelName={slackChannelName}
                sending={slackSending}
                sendFeedback={slackSendFeedback}
                onSend={handleSendSlack}
                sendDisabled={generating || saving || !slackPreview}
            />
        </div>
    );
}
