"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import { useCustomers } from "@/hooks/useCustomers";
import { customerMetaConfigUrl } from "@/lib/apexRadarFacebookPixelStats";

export default function ApexRadarDevToolsClient() {
    const { customers, loading: customersLoading } = useCustomers();
    const [customerId, setCustomerId] = useState("");
    const [pixelProbeLoading, setPixelProbeLoading] = useState(false);
    const [pixelProbeResult, setPixelProbeResult] = useState(null);
    const [pixelProbeError, setPixelProbeError] = useState(null);

    const [tokenPixelsLoading, setTokenPixelsLoading] = useState(false);
    const [tokenPixelsResult, setTokenPixelsResult] = useState(null);
    const [tokenPixelsError, setTokenPixelsError] = useState(null);
    const [tokenPixelSearch, setTokenPixelSearch] = useState("");

    const selectedCustomer = customers.find((c) => String(c._id) === String(customerId));

    const runPixelProbe = async () => {
        if (!customerId) return;
        setPixelProbeLoading(true);
        setPixelProbeError(null);
        setPixelProbeResult(null);
        try {
            const res = await fetch(`/api/apex-radar/facebook/conversion-events/${customerId}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || "Probe failed");
            }
            setPixelProbeResult(data);
        } catch (e) {
            setPixelProbeError(e?.message || "Probe failed");
        } finally {
            setPixelProbeLoading(false);
        }
    };

    const loadTokenPixels = async () => {
        setTokenPixelsLoading(true);
        setTokenPixelsError(null);
        setTokenPixelsResult(null);
        try {
            const res = await fetch("/api/apex-radar/dev-tools/facebook-pixels");
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || "Failed to load token pixels");
            }
            setTokenPixelsResult(data);
        } catch (e) {
            setTokenPixelsError(e?.message || "Failed to load token pixels");
        } finally {
            setTokenPixelsLoading(false);
        }
    };

    const filteredTokenPixels = useMemo(() => {
        const pixels = tokenPixelsResult?.pixels || [];
        const q = tokenPixelSearch.trim().toLowerCase();
        if (!q) return pixels;
        return pixels.filter((p) => {
            const hay = [
                p.id,
                p.name,
                ...(p.adAccounts || []).map((a) => `${a.id} ${a.name}`),
                ...(p.customers || []).map((c) => c.customerName),
                ...(p.sources || []),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            return hay.includes(q);
        });
    }, [tokenPixelsResult, tokenPixelSearch]);

    return (
        <div
            id="ApexRadarDevToolsPage"
            className="apex-perf w-full max-w-[min(100%,1200px)] mx-auto apex-radar-stack"
        >
            <DashboardHeading
                variant="cobalt"
                title="Dev Tools"
                label="Apex Radar · localhost only"
                subtitle="Internal debugging utilities. Not available in production."
                showAnalyzeWithAi={false}
                showPdfExport={false}
                showRunAudit={false}
            />

            <section className="apex-radar-section">
                <h2 className="apex-radar-section__title">FACEBOOK_APP_TOKEN pixels</h2>
                <p className="apex-radar-section__subtitle">
                    Loads unique <code className="text-xs">facebookAdAccountId</code> values from customer config in
                    Mongo, then calls <code className="text-xs">act_&#123;id&#125;/adspixels</code> for each with{" "}
                    <code className="text-xs">FACEBOOK_APP_TOKEN</code>. No{" "}
                    <code className="text-xs">me/adaccounts</code> or Business Manager listing required.
                </p>

                <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-end">
                    <button
                        type="button"
                        onClick={loadTokenPixels}
                        disabled={tokenPixelsLoading}
                        className="apex-perf-btn apex-perf-btn--primary shrink-0"
                    >
                        {tokenPixelsLoading ? "Loading…" : "Load all token pixels"}
                    </button>
                    {tokenPixelsResult ? (
                        <label className="flex-1 min-w-0">
                            <span className="sr-only">Search pixels</span>
                            <input
                                type="search"
                                value={tokenPixelSearch}
                                onChange={(e) => setTokenPixelSearch(e.target.value)}
                                placeholder="Search by pixel id, name, ad account…"
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                            />
                        </label>
                    ) : null}
                </div>

                {tokenPixelsError ? (
                    <pre className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 overflow-auto">
                        {tokenPixelsError}
                    </pre>
                ) : null}

                {tokenPixelsResult ? (
                    <div className="mt-4 space-y-4">
                        <dl className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
                            <div>
                                <dt className="text-gray-500 text-xs">Ad accounts</dt>
                                <dd>{tokenPixelsResult.adAccountCount}</dd>
                            </div>
                            <div>
                                <dt className="text-gray-500 text-xs">Customers</dt>
                                <dd>{tokenPixelsResult.customerCount ?? "—"}</dd>
                            </div>
                            <div>
                                <dt className="text-gray-500 text-xs">Unique pixels</dt>
                                <dd>{tokenPixelsResult.uniquePixelCount}</dd>
                            </div>
                            <div>
                                <dt className="text-gray-500 text-xs">Showing</dt>
                                <dd>{filteredTokenPixels.length}</dd>
                            </div>
                            <div>
                                <dt className="text-gray-500 text-xs">API errors</dt>
                                <dd>{tokenPixelsResult.errors?.length ?? 0}</dd>
                            </div>
                        </dl>

                        {tokenPixelsResult.errors?.length ? (
                            <details className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                <summary className="cursor-pointer font-medium">
                                    {tokenPixelsResult.errors.length} partial API error(s)
                                </summary>
                                <ul className="mt-2 space-y-1 text-xs list-disc pl-4">
                                    {tokenPixelsResult.errors.map((err, i) => (
                                        <li key={`${err.context}-${i}`}>
                                            <code>{err.context}</code>: {err.message}
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        ) : null}

                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-left text-xs text-gray-500">
                                    <tr>
                                        <th className="px-3 py-2 font-semibold">Pixel</th>
                                        <th className="px-3 py-2 font-semibold">Last fired</th>
                                        <th className="px-3 py-2 font-semibold">Ad accounts</th>
                                        <th className="px-3 py-2 font-semibold">Customers</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredTokenPixels.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-3 py-4 text-gray-500 text-center">
                                                No pixels match your search.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredTokenPixels.map((pixel) => (
                                            <tr key={pixel.id} className="align-top">
                                                <td className="px-3 py-2">
                                                    <div className="font-medium">{pixel.name}</div>
                                                    <div className="font-mono text-xs text-gray-500">{pixel.id}</div>
                                                </td>
                                                <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                                                    {pixel.last_fired_time
                                                        ? new Date(pixel.last_fired_time).toLocaleString()
                                                        : "—"}
                                                </td>
                                                <td className="px-3 py-2 text-xs">
                                                    {pixel.adAccounts?.length ? (
                                                        <ul className="space-y-1">
                                                            {pixel.adAccounts.map((a) => (
                                                                <li key={`${pixel.id}-${a.id}`}>
                                                                    <span className="font-mono">{a.id}</span>
                                                                    {a.name ? (
                                                                        <span className="text-gray-500"> · {a.name}</span>
                                                                    ) : null}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-xs">
                                                    {pixel.customers?.length ? (
                                                        <ul className="space-y-1">
                                                            {pixel.customers.map((c) => (
                                                                <li key={`${pixel.id}-${c._id}`}>
                                                                    <Link
                                                                        href={customerMetaConfigUrl(c._id)}
                                                                        className="text-[var(--color-ink)] underline underline-offset-2 hover:text-[var(--color-ink-2)]"
                                                                    >
                                                                        {c.customerName}
                                                                    </Link>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : null}
            </section>

            <section className="apex-radar-section mt-6">
                <h2 className="apex-radar-section__title">Meta conversion-events probe</h2>
                <p className="apex-radar-section__subtitle">
                    Test the conversion-events API for a customer (ad account insights, same as the Facebook settings modal).
                </p>

                <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-end">
                    <label className="flex-1 min-w-0">
                        <span className="block text-xs font-semibold text-gray-500 mb-1">Customer</span>
                        <select
                            value={customerId}
                            onChange={(e) => setCustomerId(e.target.value)}
                            disabled={customersLoading}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                        >
                            <option value="">Select customer…</option>
                            {(customers || []).map((c) => (
                                <option key={c._id} value={c._id}>
                                    {c.customerName}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button
                        type="button"
                        onClick={runPixelProbe}
                        disabled={!customerId || pixelProbeLoading}
                        className="apex-perf-btn apex-perf-btn--primary shrink-0"
                    >
                        {pixelProbeLoading ? "Probing…" : "Run probe"}
                    </button>
                </div>

                {selectedCustomer ? (
                    <p className="mt-3 text-xs text-gray-500">
                        Config:{" "}
                        <Link
                            href={customerMetaConfigUrl(customerId)}
                            className="text-[var(--color-ink)] underline underline-offset-2 hover:text-[var(--color-ink-2)]"
                        >
                            Open Meta settings
                        </Link>
                    </p>
                ) : null}

                {pixelProbeError ? (
                    <pre className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 overflow-auto">
                        {pixelProbeError}
                    </pre>
                ) : null}

                        {pixelProbeResult ? (
                    <div className="mt-4 space-y-3">
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                            <div>
                                <dt className="text-gray-500 text-xs">Source</dt>
                                <dd className="font-mono text-xs">{pixelProbeResult.eventSource || "—"}</dd>
                            </div>
                            <div>
                                <dt className="text-gray-500 text-xs">Ad account</dt>
                                <dd className="font-mono text-xs">{pixelProbeResult.adAccountId || "—"}</dd>
                            </div>
                            <div>
                                <dt className="text-gray-500 text-xs">Events found</dt>
                                <dd>{pixelProbeResult.events?.length ?? 0}</dd>
                            </div>
                            <div>
                                <dt className="text-gray-500 text-xs">Lookback</dt>
                                <dd>{pixelProbeResult.lookbackDays ?? 90} days</dd>
                            </div>
                        </dl>
                        <pre className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs overflow-auto max-h-96">
                            {JSON.stringify(pixelProbeResult, null, 2)}
                        </pre>
                    </div>
                ) : null}
            </section>

            <section className="apex-radar-section mt-6">
                <h2 className="apex-radar-section__title">Setup</h2>
                <p className="apex-radar-section__subtitle">
                    Add your login email to <code className="text-xs">APEX_RADAR_DEV_TOOLS_EMAIL</code> in{" "}
                    <code className="text-xs">.env</code>, then restart <code className="text-xs">next dev</code>.
                    Only that email on localhost can see this page.
                </p>
            </section>
        </div>
    );
}
