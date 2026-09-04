"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { showToast } from "@/components/ui/ToastProvider";
import { useCustomers } from "@/hooks/useCustomers";

function statusClass(status) {
    if (status === "complete") return "text-emerald-700 bg-emerald-50";
    if (status === "failed") return "text-red-700 bg-red-50";
    return "text-amber-800 bg-amber-50";
}

export default function StapeTrackingCheckerPage() {
    const { customers, loading: customersLoading } = useCustomers();
    const [customerId, setCustomerId] = useState("");
    const [siteUrl, setSiteUrl] = useState("");
    const [job, setJob] = useState(null);
    const [limit, setLimit] = useState(null);
    const [running, setRunning] = useState(false);
    const [polling, setPolling] = useState(false);
    const pollRef = useRef(null);

    const sortedCustomers = useMemo(
        () =>
            [...(customers || [])].sort((a, b) =>
                String(a.customerName || "").localeCompare(String(b.customerName || ""))
            ),
        [customers]
    );

    const loadLimit = useCallback(async () => {
        try {
            const res = await fetch("/api/stape/tracking-checker");
            if (!res.ok) return;
            const data = await res.json();
            setLimit(data);
        } catch {
            /* ignore */
        }
    }, []);

    useEffect(() => {
        loadLimit();
    }, [loadLimit]);

    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    const pollJob = useCallback(async (jobId) => {
        const res = await fetch(`/api/stape/tracking-checker/${jobId}`);
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || "Failed to fetch job");
        }
        setJob(data);
        return data;
    }, []);

    const startPolling = useCallback(
        (jobId) => {
            if (pollRef.current) clearInterval(pollRef.current);
            setPolling(true);
            pollRef.current = setInterval(async () => {
                try {
                    const data = await pollJob(jobId);
                    if (data.status !== "pending") {
                        clearInterval(pollRef.current);
                        pollRef.current = null;
                        setPolling(false);
                    }
                } catch (e) {
                    clearInterval(pollRef.current);
                    pollRef.current = null;
                    setPolling(false);
                    showToast({ message: e.message, type: "error", position: "top-center" });
                }
            }, 3000);
        },
        [pollJob]
    );

    const handleStart = async (e) => {
        e.preventDefault();
        if (!customerId && !siteUrl.trim()) {
            showToast({
                message: "Pick a customer or enter a site URL",
                type: "error",
                position: "top-center",
            });
            return;
        }

        setRunning(true);
        setJob(null);
        try {
            const res = await fetch("/api/stape/tracking-checker", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerId: customerId || undefined,
                    siteUrl: siteUrl.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to start scan");
            }
            setJob(data);
            if (data.reused) {
                showToast({
                    message: "Reusing a pending scan for this site",
                    type: "info",
                    position: "top-center",
                });
            }
            if (data.status === "pending") {
                startPolling(data.jobId);
            }
            await loadLimit();
        } catch (err) {
            showToast({
                message: err.message || "Failed to start scan",
                type: "error",
                position: "top-center",
            });
        } finally {
            setRunning(false);
        }
    };

    return (
        <div className="apex-perf w-full max-w-3xl mx-auto space-y-6 pb-10">
            <DashboardHeading
                variant="cobalt"
                title="Stape Tracking Checker"
                label="Website tracking audit"
                showRunAudit={false}
                showAnalyzeWithAi={false}
                showPdfExport={false}
            />

            <p className="text-sm text-slate-600">
                Runs Stape&apos;s Partner Tracking Checker against a customer site. Results arrive
                asynchronously (usually within 2 minutes) via webhook.
            </p>

            {limit ? (
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    <strong>Stape API quota:</strong>{" "}
                    {limit.remaining != null && limit.limit != null
                        ? `${limit.remaining} / ${limit.limit} requests remaining this month`
                        : JSON.stringify(limit)}
                </div>
            ) : null}

            <form
                onSubmit={handleStart}
                className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm"
            >
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Customer (optional)
                    </label>
                    {customersLoading ? (
                        <CobaltLoader variant="inline" title="Loading customers" />
                    ) : (
                        <select
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            value={customerId}
                            onChange={(e) => setCustomerId(e.target.value)}
                        >
                            <option value="">— Select customer —</option>
                            {sortedCustomers.map((c) => (
                                <option key={c._id || c.id} value={c._id || c.id}>
                                    {c.customerName}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Site URL override (optional)
                    </label>
                    <input
                        type="url"
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        placeholder="https://example.com"
                        value={siteUrl}
                        onChange={(e) => setSiteUrl(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                        Leave blank to use the customer&apos;s Shopify URL or Search Console property.
                    </p>
                </div>

                <button
                    type="submit"
                    disabled={running || polling}
                    className="apex-perf-btn apex-perf-btn--primary"
                >
                    {running ? "Starting…" : polling ? "Scan in progress…" : "Run tracking check"}
                </button>
            </form>

            {job ? (
                <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                        <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(job.status)}`}
                        >
                            {job.status}
                        </span>
                        {job.customerName ? (
                            <span className="text-sm text-slate-600">{job.customerName}</span>
                        ) : null}
                    </div>
                    <p className="text-sm">
                        <strong>Site:</strong> {job.siteUrl}
                    </p>
                    <p className="text-xs text-slate-500 font-mono break-all">Job: {job.jobId}</p>
                    {job.summary ? (
                        <pre className="text-xs bg-slate-50 rounded p-3 overflow-auto max-h-48">
                            {JSON.stringify(job.summary, null, 2)}
                        </pre>
                    ) : null}
                    {job.result ? (
                        <details>
                            <summary className="cursor-pointer text-sm font-medium text-slate-700">
                                Full Stape result
                            </summary>
                            <pre className="mt-2 text-xs bg-slate-50 rounded p-3 overflow-auto max-h-96">
                                {JSON.stringify(job.result, null, 2)}
                            </pre>
                        </details>
                    ) : null}
                    {job.stale && job.hint ? (
                        <p className="text-sm text-amber-800 bg-amber-50 rounded p-3">{job.hint}</p>
                    ) : null}
                    {job.error ? (
                        <p className="text-sm text-red-700">{job.error}</p>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
