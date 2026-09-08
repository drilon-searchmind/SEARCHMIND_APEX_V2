"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiPlay, FiRefreshCw, FiSave, FiSearch } from "react-icons/fi";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import CobaltLoader from "@/components/ui/CobaltLoader";
import PerformanceBriefNavTabs from "./PerformanceBriefNavTabs";

const RUN_STATUS = {
    idle: "idle",
    generating: "generating",
    sending: "sending",
    success: "success",
    error: "error",
    skipped: "skipped",
};

function statusLabel(status, message) {
    switch (status) {
        case RUN_STATUS.generating:
            return "Generating…";
        case RUN_STATUS.sending:
            return "Sending to Slack…";
        case RUN_STATUS.success:
            return message || "Posted";
        case RUN_STATUS.error:
            return message || "Failed";
        case RUN_STATUS.skipped:
            return message || "Skipped";
        default:
            return "—";
    }
}

export default function ApexRadarPerformanceBriefBulkRunPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [rows, setRows] = useState([]);
    const [selected, setSelected] = useState({});
    const [search, setSearch] = useState("");
    const [channels, setChannels] = useState([]);
    const [channelsLoading, setChannelsLoading] = useState(false);
    const [channelsLoaded, setChannelsLoaded] = useState(false);
    const [channelsError, setChannelsError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saveFeedback, setSaveFeedback] = useState(null);
    const [running, setRunning] = useState(false);
    const [runLog, setRunLog] = useState([]);

    const loadCustomers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/apex-radar/performance-brief/bulk");
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to load customers");
            const customers = data.customers || [];
            setRows(
                customers.map((c) => ({
                    customerId: c.customerId,
                    customerName: c.customerName,
                    slackChannelId: c.slackChannelId || "",
                    slackChannelName: c.slackChannelName || "",
                    integrations: c.integrations || {},
                }))
            );
            const initialSelected = {};
            for (const c of customers) {
                initialSelected[c.customerId] = Boolean(c.slackChannelId);
            }
            setSelected(initialSelected);
        } catch (e) {
            setError(e.message || "Failed to load customers");
        } finally {
            setLoading(false);
        }
    }, []);

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
        loadCustomers();
    }, [loadCustomers]);

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((r) => r.customerName.toLowerCase().includes(q));
    }, [rows, search]);

    const selectedCount = useMemo(
        () => Object.values(selected).filter(Boolean).length,
        [selected]
    );

    const readyCount = useMemo(
        () =>
            rows.filter((r) => selected[r.customerId] && String(r.slackChannelId || "").trim())
                .length,
        [rows, selected]
    );

    const updateRow = (customerId, patch) => {
        setRows((prev) =>
            prev.map((r) => (r.customerId === customerId ? { ...r, ...patch } : r))
        );
    };

    const handleChannelChange = (customerId, channelId) => {
        const ch = channels.find((c) => c.id === channelId);
        updateRow(customerId, {
            slackChannelId: channelId,
            slackChannelName: ch?.name || "",
        });
    };

    const toggleAllVisible = (checked) => {
        setSelected((prev) => {
            const next = { ...prev };
            for (const row of filteredRows) {
                next[row.customerId] = checked;
            }
            return next;
        });
    };

    const handleSaveChannels = async () => {
        setSaving(true);
        setSaveFeedback(null);
        try {
            const updates = rows.map((r) => ({
                customerId: r.customerId,
                slackChannelId: r.slackChannelId,
                slackChannelName: r.slackChannelName,
            }));
            const res = await fetch("/api/apex-radar/performance-brief/bulk", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ updates }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to save channels");
            setSaveFeedback({
                type: "success",
                message: `Saved Slack channels for ${updates.length} customers.`,
            });
        } catch (e) {
            setSaveFeedback({ type: "error", message: e.message || "Failed to save channels" });
        } finally {
            setSaving(false);
        }
    };

    const appendLog = (entry) => {
        setRunLog((prev) => [entry, ...prev].slice(0, 50));
    };

    const handleRunBulk = async () => {
        const queue = rows.filter(
            (r) => selected[r.customerId] && String(r.slackChannelId || "").trim()
        );
        if (!queue.length) return;

        setRunning(true);
        setRunLog([]);
        appendLog({
            customerId: "",
            customerName: "Bulk run",
            status: RUN_STATUS.generating,
            message: `Starting ${queue.length} customer(s)…`,
        });

        for (const row of queue) {
            const base = {
                customerId: row.customerId,
                customerName: row.customerName,
            };

            try {
                appendLog({ ...base, status: RUN_STATUS.generating, message: "Generating brief…" });

                const genRes = await fetch("/api/apex-radar/performance-brief/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ customerId: row.customerId }),
                });
                const genData = await genRes.json().catch(() => ({}));
                if (!genRes.ok) {
                    throw new Error(genData.error || "Generate failed");
                }

                appendLog({ ...base, status: RUN_STATUS.sending, message: "Posting to Slack…" });

                const sendRes = await fetch("/api/apex-radar/performance-brief/slack/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        customerId: row.customerId,
                        slackPreview: genData.slackPreview,
                        slackChannelId: row.slackChannelId,
                        slackChannelName: row.slackChannelName,
                    }),
                });
                const sendData = await sendRes.json().catch(() => ({}));
                if (!sendRes.ok) {
                    throw new Error(sendData.error || "Slack send failed");
                }

                const dest = sendData.channelName
                    ? `#${sendData.channelName}`
                    : `#${row.slackChannelName}`;
                appendLog({
                    ...base,
                    status: RUN_STATUS.success,
                    message: `Posted to ${dest}`,
                });
            } catch (e) {
                appendLog({
                    ...base,
                    status: RUN_STATUS.error,
                    message: e.message || "Failed",
                });
            }
        }

        appendLog({
            customerId: "",
            customerName: "Bulk run",
            status: RUN_STATUS.success,
            message: "Finished.",
        });
        setRunning(false);
    };

    const allVisibleSelected =
        filteredRows.length > 0 && filteredRows.every((r) => selected[r.customerId]);

    return (
        <div className="apex-radar-stack">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Performance Brief"
                label="Bulk run (dev)"
                showAnalyzeWithAi={false}
                showPdfExport={false}
                loading={loading || running}
            />

            <PerformanceBriefNavTabs />

            <section className="apex-radar-panel apex-radar-panel--padded">
                <div className="apex-radar-cs-toolbar">
                    <div>
                        <h1 className="apex-radar-section__title">Bulk run & Slack test</h1>
                        <p className="apex-radar-section__subtitle">
                            Select active customers, assign a Slack channel to each, then generate
                            and post Performance Briefs manually. Runs one customer at a time (future
                            cron will use the same pipeline).
                        </p>
                    </div>
                    <div className="apex-radar-cs-toolbar__actions">
                        <button
                            type="button"
                            className="apex-radar-alerts-panel__slack-btn"
                            onClick={() => loadCustomers()}
                            disabled={loading || running || saving}
                        >
                            <FiRefreshCw className={`h-3.5 w-3.5${loading ? " animate-spin" : ""}`} />
                            Reload
                        </button>
                        <button
                            type="button"
                            className="apex-perf-btn apex-perf-btn--ghost"
                            onClick={handleSaveChannels}
                            disabled={loading || running || saving || !rows.length}
                        >
                            <FiSave className="h-3.5 w-3.5" />
                            {saving ? "Saving…" : "Save all channels"}
                        </button>
                        <button
                            type="button"
                            className="apex-radar-alerts-panel__slack-btn"
                            onClick={handleRunBulk}
                            disabled={loading || running || saving || readyCount === 0}
                            title={
                                readyCount === 0
                                    ? "Select customers with a Slack channel assigned"
                                    : `Run ${readyCount} brief(s)`
                            }
                        >
                            <FiPlay className="h-3.5 w-3.5" />
                            {running ? "Running…" : `Run ${readyCount} brief(s)`}
                        </button>
                    </div>
                </div>

                {error ? <p className="apex-radar-alert mt-3">{error}</p> : null}
                {saveFeedback ? (
                    <p className={`apex-radar-alerts-panel__feedback is-${saveFeedback.type} mt-3`}>
                        {saveFeedback.message}
                    </p>
                ) : null}
                {channelsError ? <p className="apex-radar-alert mt-3">{channelsError}</p> : null}

                <p className="apex-radar-section__subtitle mt-3">
                    {selectedCount} selected · {readyCount} ready (channel assigned)
                </p>

                <div className="apex-radar-search-wrap mt-4">
                    <FiSearch className="h-4 w-4" aria-hidden />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search customers…"
                        aria-label="Search customers"
                    />
                </div>
            </section>

            {loading ? (
                <CobaltLoader variant="block" title="Loading active customers" />
            ) : (
                <section className="apex-radar-panel apex-radar-panel--padded">
                    <div className="apex-radar-brief-bulk-table-wrap">
                        <table className="apex-radar-brief-bulk-table">
                            <thead>
                                <tr>
                                    <th>
                                        <input
                                            type="checkbox"
                                            checked={allVisibleSelected}
                                            onChange={(e) => toggleAllVisible(e.target.checked)}
                                            aria-label="Select all visible customers"
                                        />
                                    </th>
                                    <th>Customer</th>
                                    <th>Integrations</th>
                                    <th>Slack channel</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.map((row) => (
                                    <tr key={row.customerId}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(selected[row.customerId])}
                                                onChange={(e) =>
                                                    setSelected((prev) => ({
                                                        ...prev,
                                                        [row.customerId]: e.target.checked,
                                                    }))
                                                }
                                                aria-label={`Select ${row.customerName}`}
                                            />
                                        </td>
                                        <td>{row.customerName}</td>
                                        <td>
                                            <span className="apex-radar-brief-bulk-chips">
                                                <span
                                                    className={`apex-radar-cs-picker__chip${
                                                        row.integrations.meta ? "" : " is-missing"
                                                    }`}
                                                >
                                                    {!row.integrations.meta ? (
                                                        <FiAlertTriangle
                                                            className="apex-radar-cs-picker__warn"
                                                            aria-hidden
                                                        />
                                                    ) : null}
                                                    Meta
                                                </span>
                                                <span
                                                    className={`apex-radar-cs-picker__chip${
                                                        row.integrations.googleAds ? "" : " is-missing"
                                                    }`}
                                                >
                                                    {!row.integrations.googleAds ? (
                                                        <FiAlertTriangle
                                                            className="apex-radar-cs-picker__warn"
                                                            aria-hidden
                                                        />
                                                    ) : null}
                                                    GAds
                                                </span>
                                            </span>
                                        </td>
                                        <td>
                                            <select
                                                value={row.slackChannelId}
                                                onFocus={loadChannels}
                                                onChange={(e) =>
                                                    handleChannelChange(row.customerId, e.target.value)
                                                }
                                                disabled={running || saving || channelsLoading}
                                                className="apex-radar-brief-bulk-select"
                                            >
                                                <option value="">
                                                    {channelsLoading
                                                        ? "Loading channels…"
                                                        : "Select channel"}
                                                </option>
                                                {row.slackChannelId &&
                                                !channels.some((c) => c.id === row.slackChannelId) ? (
                                                    <option value={row.slackChannelId}>
                                                        #{row.slackChannelName || row.slackChannelId}
                                                    </option>
                                                ) : null}
                                                {channels.map((c) => (
                                                    <option key={c.id} value={c.id}>
                                                        #{c.name}
                                                        {c.isPrivate ? " (private)" : ""}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {runLog.length ? (
                <section className="apex-radar-panel apex-radar-panel--padded">
                    <h2 className="apex-radar-section__title">Run log</h2>
                    <ul className="apex-radar-brief-bulk-log">
                        {runLog.map((entry, i) => (
                            <li
                                key={`${entry.customerId}-${i}`}
                                className={`apex-radar-brief-bulk-log__item is-${entry.status}`}
                            >
                                <span className="apex-radar-brief-bulk-log__name">
                                    {entry.customerName}
                                </span>
                                <span className="apex-radar-brief-bulk-log__msg">
                                    {statusLabel(entry.status, entry.message)}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}
        </div>
    );
}
