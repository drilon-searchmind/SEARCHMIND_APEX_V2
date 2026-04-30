"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FiClipboard, FiX } from "react-icons/fi";
import Spinner from "@/components/ui/Spinner";
import { showToast } from "@/components/ui/ToastProvider";
import { useCustomers } from "@/hooks/useCustomers";
import { getConfiguredAuditServices } from "@/lib/customerServiceIntegrations";

const STORAGE_PREFIX = "apex_audit:";

function canUserRunAudit(user) {
    if (!user) return false;
    if (user.isAdmin === true) return true;
    return user.isExternal !== true;
}

export default function RunAuditModal({
    open,
    onClose,
    customerId,
    dateRange = { startDate: "", endDate: "" },
    dataSnapshot = {},
}) {
    const router = useRouter();
    const { customers } = useCustomers();
    const [startDate, setStartDate] = useState(dateRange?.startDate || "");
    const [endDate, setEndDate] = useState(dateRange?.endDate || "");
    const [selected, setSelected] = useState(() => new Set());
    const [running, setRunning] = useState(false);
    const [error, setError] = useState(null);

    const customer = useMemo(
        () => customers.find((c) => String(c._id) === String(customerId)),
        [customers, customerId]
    );

    const available = useMemo(
        () => getConfiguredAuditServices(customer?.CustomerSettings),
        [customer?.CustomerSettings]
    );

    useEffect(() => {
        if (!open) return;
        setStartDate(dateRange?.startDate || "");
        setEndDate(dateRange?.endDate || "");
        setError(null);
        setRunning(false);
    }, [open, dateRange?.startDate, dateRange?.endDate]);

    useEffect(() => {
        if (!open || available.length === 0) return;
        setSelected(new Set(available.map((a) => a.id)));
    }, [open, available]);

    const toggle = (id) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleRun = async () => {
        setError(null);
        if (!startDate || !endDate) {
            setError("Please select start and end dates.");
            return;
        }
        const serviceIds = [...selected];
        if (serviceIds.length === 0) {
            setError("Select at least one channel with an active integration.");
            return;
        }
        setRunning(true);
        try {
            const res = await fetch("/api/dashboard-audit/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerId,
                    startDate,
                    endDate,
                    serviceIds,
                    dataSnapshot,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || "Audit failed");
            }
            const { auditId, report, customerName, dateRange: dr, services } = data;
            const payload = {
                auditId,
                customerId: String(customerId),
                customerName,
                dateRange: dr,
                services,
                report,
                generatedAt: new Date().toISOString(),
            };
            try {
                sessionStorage.setItem(`${STORAGE_PREFIX}${auditId}`, JSON.stringify(payload));
            } catch (e) {
                console.warn("sessionStorage audit save failed", e);
            }
            showToast({ message: "Audit complete", type: "success", position: "top-center" });
            onClose();
            router.push(`/dashboard/${customerId}/audit?audit_id=${encodeURIComponent(auditId)}`);
        } catch (e) {
            setError(e?.message || "Audit failed");
        } finally {
            setRunning(false);
        }
    };

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
            role="presentation"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !running) onClose();
            }}
        >
            <div
                className="relative w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="run-audit-title"
            >
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
                    <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary-searchmind)]/10 text-[var(--color-primary-searchmind)]">
                            <FiClipboard className="h-5 w-5" aria-hidden />
                        </span>
                        <div>
                            <h2 id="run-audit-title" className="text-lg font-bold text-gray-900">
                                Run audit
                            </h2>
                            <p className="text-xs text-gray-500">
                                {customer?.customerName || "Customer"} — integrated channels only
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => !running && onClose()}
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-searchmind)]"
                        aria-label="Close"
                    >
                        <FiX className="h-5 w-5" />
                    </button>
                </div>

                <div className="px-5 py-4 space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="audit-start" className="mb-1 block text-xs font-semibold text-gray-500">
                                Start date
                            </label>
                            <input
                                id="audit-start"
                                type="date"
                                disabled={running}
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[var(--color-primary-searchmind-lighter)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind-lighter)]/30 disabled:opacity-60"
                            />
                        </div>
                        <div>
                            <label htmlFor="audit-end" className="mb-1 block text-xs font-semibold text-gray-500">
                                End date
                            </label>
                            <input
                                id="audit-end"
                                type="date"
                                disabled={running}
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[var(--color-primary-searchmind-lighter)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind-lighter)]/30 disabled:opacity-60"
                            />
                        </div>
                    </div>

                    <div>
                        <span className="mb-2 block text-xs font-semibold text-gray-500">Services</span>
                        {available.length === 0 ? (
                            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                No channels have valid integration IDs yet (check Config). Same rules as sidebar
                                warnings.
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {available.map((s) => {
                                    const active = selected.has(s.id);
                                    return (
                                        <button
                                            key={s.id}
                                            type="button"
                                            disabled={running}
                                            aria-pressed={active}
                                            onClick={() => toggle(s.id)}
                                            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-searchmind)] disabled:opacity-60 ${
                                                active
                                                    ? "border-[var(--color-primary-searchmind)] bg-[var(--color-primary-searchmind)] text-white"
                                                    : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                                            }`}
                                        >
                                            {s.label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        <p className="mt-2 text-[0.7rem] text-gray-400">
                            Only channels with a valid ID (not empty, 0, or 1).
                        </p>
                    </div>

                    {error ? (
                        <p className="text-sm text-red-600" role="alert">
                            {error}
                        </p>
                    ) : null}

                    {running ? (
                        <div
                            className="flex flex-col items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 py-10"
                            role="status"
                            aria-live="polite"
                            aria-busy="true"
                        >
                            <Spinner size={44} color="#406969" />
                            <p className="text-sm font-medium text-gray-700">Running audit…</p>
                            <p className="max-w-xs text-center text-xs text-gray-500">
                                Generating channel priorities from Apex data and your audit policy.
                            </p>
                        </div>
                    ) : (
                        <div className="flex justify-end gap-2 pt-1">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-searchmind)]"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleRun}
                                disabled={available.length === 0}
                                className="rounded-lg bg-[var(--color-primary-searchmind)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-searchmind-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-searchmind)] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Start audit
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export { canUserRunAudit };
