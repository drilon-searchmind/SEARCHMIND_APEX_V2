"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FiArrowLeft, FiClipboard, FiExternalLink } from "react-icons/fi";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import Spinner from "@/components/ui/Spinner";
import { useCustomers } from "@/hooks/useCustomers";
import { gradeFromNumericScore } from "@/lib/channelAuditReport";

export default function AuditListClient() {
    const params = useParams();
    const customerId = params?.customerId;
    const { customers } = useCustomers();
    const customer = customers?.find((c) => String(c._id) === String(customerId));

    const [audits, setAudits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!customerId) return undefined;
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/dashboard-audit?customerId=${encodeURIComponent(customerId)}`);
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || "Failed to load audits");
                if (!cancelled) setAudits(Array.isArray(data.audits) ? data.audits : []);
            } catch (e) {
                if (!cancelled) setError(e?.message || "Failed to load audits");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [customerId]);

    return (
        <div className="w-full">
            <DashboardHeading
                title="Channel audits"
                label={customer?.customerName || "Property"}
                customerId={customerId}
                showAnalyzeWithAi={false}
                showPdfExport={false}
                showRunAudit={false}
                right={
                    <Link
                        href={`/dashboard/${customerId}/performance-dashboard`}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-searchmind)]"
                    >
                        <FiArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                        Back to dashboard
                    </Link>
                }
            />

            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="border-b border-gray-100 bg-gray-50/80 px-4 py-3 flex items-center gap-2">
                    <FiClipboard className="h-5 w-5 text-[var(--color-primary-searchmind)]" aria-hidden />
                    <div>
                        <h2 className="text-sm font-bold text-gray-900">Saved audits</h2>
                        <p className="text-xs text-gray-500">Open any report stored for this customer.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-16">
                        <Spinner size={40} color="#406969" />
                    </div>
                ) : error ? (
                    <p className="p-8 text-center text-sm text-red-600">{error}</p>
                ) : audits.length === 0 ? (
                    <p className="p-8 text-center text-sm text-gray-500">
                        No audits yet. Run an audit from any dashboard header.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 bg-white">
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500">Created</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500">Period</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500">Channels</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500">Mean score</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 w-24" />
                                </tr>
                            </thead>
                            <tbody>
                                {audits.map((a) => {
                                    const co = a.canonicalOverall || {};
                                    const mean =
                                        co.score != null && Number.isFinite(Number(co.score))
                                            ? Number(co.score)
                                            : null;
                                    const grade =
                                        co.grade && co.grade !== "—"
                                            ? co.grade
                                            : mean != null
                                              ? gradeFromNumericScore(mean)
                                              : "—";
                                    const href = `/dashboard/${customerId}/audit?audit_id=${encodeURIComponent(a.auditId)}`;
                                    return (
                                        <tr key={a.auditId} className="border-b border-gray-100 hover:bg-gray-50/80">
                                            <td className="px-4 py-3 text-gray-800 whitespace-nowrap">
                                                {a.createdAt
                                                    ? new Date(a.createdAt).toLocaleString()
                                                    : "—"}
                                            </td>
                                            <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                                                {a.dateRange?.startDate} → {a.dateRange?.endDate}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {(a.serviceIds || []).map((sid) => (
                                                        <span
                                                            key={sid}
                                                            className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-gray-600"
                                                        >
                                                            {sid}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 tabular-nums font-semibold text-gray-900">
                                                {mean != null ? `${mean} (${grade})` : "—"}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Link
                                                    href={href}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-[var(--color-primary-searchmind)] hover:bg-gray-50"
                                                >
                                                    Open
                                                    <FiExternalLink className="h-3.5 w-3.5" aria-hidden />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
