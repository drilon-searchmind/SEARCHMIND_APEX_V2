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

function PlatformStatus({ label, platform }) {
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
    return (
        <div className="apex-radar-cs-kpi-grid">
            <div className="apex-radar-cs-kpi is-ok">
                <span className="apex-radar-cs-kpi__label">Spend 7d</span>
                <span className="apex-radar-cs-kpi__value">
                    {new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(w7.spend || 0)}
                </span>
            </div>
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
        </div>
    );
}

export default function ApexRadarPerformanceBriefClient({ customerId }) {
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [saveError, setSaveError] = useState(null);
    const [customer, setCustomer] = useState(null);
    const [windows, setWindows] = useState(null);
    const [meta, setMeta] = useState(null);
    const [google, setGoogle] = useState(null);
    const [accountIntent, setAccountIntent] = useState(null);
    const [narrative, setNarrative] = useState(null);
    const [claude, setClaude] = useState(null);
    const [slackChannelId, setSlackChannelId] = useState("");
    const [slackChannelName, setSlackChannelName] = useState("");
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
        setSlackChannelId(data.settings?.slackChannelId || "");
        setSlackChannelName(data.settings?.slackChannelName || "");
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
            setLoading(false);
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
        setCustomer(null);
        setMeta(null);
        setGoogle(null);
        setAccountIntent(null);
        setNarrative(null);
        setError(null);
        setSlackSendFeedback(null);
        setLoading(true);
        loadSettings()
            .catch((e) => setError(e.message || "Failed to load settings"))
            .finally(() => generateBrief());
    }, [loadSettings, generateBrief]);

    const slackPreview = useMemo(() => {
        if (!customer || (!meta && !google)) return null;
        return formatPerformanceBriefSlack({
            compact: { customer, windows, meta, google, accountIntent },
            narrative,
            channelName: slackChannelName,
        });
    }, [customer, windows, meta, google, accountIntent, narrative, slackChannelName]);

    const persistSlack = useCallback(
        async ({ id, name }) => {
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
                            slackChannelId: id,
                            slackChannelName: name,
                        }),
                    }
                );
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || "Failed to save settings");
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
        persistSlack({ id: channelId, name });
    };

    const filteredChannels = useMemo(() => {
        const q = channelQuery.trim().toLowerCase();
        if (!q) return channels;
        return channels.filter((c) => c.name.toLowerCase().includes(q));
    }, [channels, channelQuery]);

    const handleSendSlack = useCallback(async () => {
        if (!customerId || !slackChannelId || !slackPreview) return;
        setSlackSending(true);
        setSlackSendFeedback(null);
        try {
            const res = await fetch("/api/apex-radar/performance-brief/slack/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerId,
                    slackPreview,
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
    }, [customerId, slackChannelId, slackChannelName, slackPreview]);

    const dateRange = windows?.last7
        ? { startDate: windows.last7.start, endDate: windows.last7.end }
        : undefined;

    return (
        <div className="apex-radar-stack">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Performance Brief"
                label={customer?.customerName || "Performance Brief"}
                showAnalyzeWithAi={false}
                showPdfExport={false}
                dateRange={dateRange}
                loading={loading || generating}
            />

            <PerformanceBriefNavTabs />

            <div className="apex-radar-panel apex-radar-panel--padded">
                <div className="apex-radar-cs-toolbar">
                    <div>
                        <h1 className="apex-radar-section__title">Slack destination</h1>
                        <p className="apex-radar-section__subtitle">
                            Assign this customer to a Slack channel, generate the weekly brief, then send
                            it manually. Daily cron is not wired yet.
                        </p>
                    </div>
                    <div className="apex-radar-cs-toolbar__actions">
                        <button
                            type="button"
                            className="apex-radar-alerts-panel__slack-btn"
                            onClick={() => generateBrief()}
                            disabled={loading || generating || saving}
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
                    {channelsError ? <p className="apex-radar-alert mt-2">{channelsError}</p> : null}
                    {saveError ? <p className="apex-radar-alert mt-2">{saveError}</p> : null}
                </div>
            </div>

            {error ? <div className="apex-radar-alert">{error}</div> : null}
            {claude?.error ? (
                <div className="apex-radar-alert">
                    Claude analysis: {claude.error}. Tables still use live numbers.
                </div>
            ) : null}

            {loading && !meta && !google ? (
                <CobaltLoader variant="block" title="Generating Performance Brief" />
            ) : (
                <div className="apex-radar-cs-platforms">
                    <section className="apex-radar-panel apex-radar-panel--padded">
                        <h2 className="apex-radar-section__title">
                            {PERFORMANCE_BRIEF_PLATFORM_LABELS.meta}
                        </h2>
                        <PlatformStatus label="Meta" platform={meta} />
                    </section>
                    <section className="apex-radar-panel apex-radar-panel--padded">
                        <h2 className="apex-radar-section__title">
                            {PERFORMANCE_BRIEF_PLATFORM_LABELS["google-ads"]}
                        </h2>
                        <PlatformStatus label="Google Ads" platform={google} />
                    </section>
                </div>
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
