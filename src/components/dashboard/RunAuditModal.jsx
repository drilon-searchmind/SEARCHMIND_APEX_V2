"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiClipboard, FiList, FiX } from "react-icons/fi";
import Spinner from "@/components/ui/Spinner";
import { showToast } from "@/components/ui/ToastProvider";
import { useCustomers } from "@/hooks/useCustomers";
import {
    AUDIT_CATALOG_GROUPS,
    AUDIT_TAG_COLOR_CLASSES,
} from "@/lib/audit/auditPromptCatalog";
import { getAuditTabConnectivity } from "@/lib/audit/auditDataSources";
import { minusOneYearDate } from "@/lib/audit/auditDateUtils";

const STORAGE_PREFIX = "apex_audit:";

function canUserRunAudit(user) {
    if (!user) return false;
    if (user.isAdmin === true) return true;
    return user.isExternal !== true;
}

function countSelections(selectedCards, customByGroup) {
    let n = selectedCards.size;
    for (const g of AUDIT_CATALOG_GROUPS) {
        if ((customByGroup[g.id] || "").trim()) n += 1;
    }
    return n;
}

function pillCountForGroup(groupId, selectedCards, customByGroup) {
    const g = AUDIT_CATALOG_GROUPS.find((x) => x.id === groupId);
    if (!g) return 0;
    let n = g.items.filter((c) => selectedCards.has(c.id)).length;
    if ((customByGroup[groupId] || "").trim()) n += 1;
    return n;
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
    const [compareOn, setCompareOn] = useState(false);
    const [compareStart, setCompareStart] = useState("");
    const [compareEnd, setCompareEnd] = useState("");
    const [compareCustom, setCompareCustom] = useState(false);
    const [activeTab, setActiveTab] = useState("cross");
    const [selectedCards, setSelectedCards] = useState(() => new Set());
    const [customByGroup, setCustomByGroup] = useState({});
    const [customOpen, setCustomOpen] = useState({});
    const [running, setRunning] = useState(false);
    const [error, setError] = useState(null);

    const customer = useMemo(
        () => customers.find((c) => String(c._id) === String(customerId)),
        [customers, customerId]
    );

    const tabConnectivity = useMemo(
        () => getAuditTabConnectivity(customer || {}),
        [customer]
    );

    useEffect(() => {
        if (!open) return;
        setStartDate(dateRange?.startDate || "");
        setEndDate(dateRange?.endDate || "");
        setCompareOn(false);
        setCompareCustom(false);
        setCompareStart("");
        setCompareEnd("");
        setError(null);
        setRunning(false);
        setSelectedCards(new Set());
        setCustomByGroup({});
        setCustomOpen({});
        setActiveTab("cross");
    }, [open, dateRange?.startDate, dateRange?.endDate]);

    const applyYoY = useCallback(() => {
        setCompareStart(minusOneYearDate(startDate));
        setCompareEnd(minusOneYearDate(endDate));
        setCompareCustom(false);
    }, [startDate, endDate]);

    useEffect(() => {
        if (compareOn && !compareCustom) applyYoY();
    }, [compareOn, compareCustom, applyYoY]);

    const totalSelected = useMemo(
        () => countSelections(selectedCards, customByGroup),
        [selectedCards, customByGroup]
    );

    const toggleCard = (cardId) => {
        setSelectedCards((prev) => {
            const next = new Set(prev);
            if (next.has(cardId)) next.delete(cardId);
            else next.add(cardId);
            return next;
        });
    };

    const toggleAllInTab = (groupId) => {
        const g = AUDIT_CATALOG_GROUPS.find((x) => x.id === groupId);
        if (!g) return;
        const allSelected = g.items.every((c) => selectedCards.has(c.id));
        setSelectedCards((prev) => {
            const next = new Set(prev);
            for (const c of g.items) {
                if (allSelected) next.delete(c.id);
                else next.add(c.id);
            }
            return next;
        });
    };

    const buildSelectionsPayload = () => {
        const selections = [];
        for (const id of selectedCards) {
            selections.push({ cardId: id });
        }
        for (const g of AUDIT_CATALOG_GROUPS) {
            const text = (customByGroup[g.id] || "").trim();
            if (text) selections.push({ groupId: g.id, customPrompt: text });
        }
        return selections;
    };

    const handleRun = async () => {
        setError(null);
        if (!startDate || !endDate) {
            setError("Please select start and end dates.");
            return;
        }
        const selections = buildSelectionsPayload();
        if (selections.length === 0) {
            setError("Select at least one analysis.");
            return;
        }
        if (compareOn && (!compareStart || !compareEnd)) {
            setError("Fill in the comparison period or turn off historical comparison.");
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
                    selections,
                    comparisonEnabled: compareOn,
                    comparisonDateRange: compareOn
                        ? { startDate: compareStart, endDate: compareEnd }
                        : null,
                    outputFormat: "json",
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

    const activeGroup = AUDIT_CATALOG_GROUPS.find((g) => g.id === activeTab);
    const tabDisabled = (id) => !tabConnectivity[id];

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
            role="presentation"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !running) onClose();
            }}
        >
            <div
                className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-xl border border-gray-200 bg-white shadow-xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="run-audit-title"
            >
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
                    <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary-searchmind)]/10 text-[var(--color-primary-searchmind)]">
                            <FiClipboard className="h-5 w-5" aria-hidden />
                        </span>
                        <div>
                            <h2 id="run-audit-title" className="text-lg font-bold text-gray-900">
                                Run audit
                            </h2>
                            <p className="text-xs text-gray-500">
                                {customer?.customerName || "Customer"} — AI audit across integrated channels
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

                {customerId ? (
                    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/90 px-5 py-2.5">
                        <p className="text-xs text-gray-500">Browse saved audits for this customer</p>
                        <Link
                            href={`/dashboard/${customerId}/audit`}
                            onClick={() => {
                                if (!running) onClose();
                            }}
                            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-searchmind)]"
                        >
                            <FiList className="h-4 w-4 shrink-0 text-[var(--color-primary-searchmind)]" aria-hidden />
                            View all audits
                        </Link>
                    </div>
                ) : null}

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-5">
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

                    <button
                        type="button"
                        disabled={running}
                        onClick={() => setCompareOn((v) => !v)}
                        className={`flex w-full items-start gap-3 rounded-lg text-left ${compareOn ? "" : ""}`}
                    >
                        <span
                            className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors ${
                                compareOn ? "bg-[var(--color-primary-searchmind)]" : "bg-gray-300"
                            }`}
                            aria-hidden
                        >
                            <span
                                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                                    compareOn ? "translate-x-[18px]" : "translate-x-0.5"
                                }`}
                            />
                        </span>
                        <span>
                            <span className="block text-sm font-semibold text-gray-800">
                                Use historical comparison
                            </span>
                            <span className="block text-xs text-gray-500">
                                Compare the period to a prior range to spot gaps and winners
                            </span>
                        </span>
                    </button>

                    {compareOn ? (
                        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/80 p-4 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
                                    Comparison period
                                    {!compareCustom ? (
                                        <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-[0.65rem] font-bold text-purple-700">
                                            Year over year
                                        </span>
                                    ) : null}
                                </div>
                                {compareCustom ? (
                                    <button
                                        type="button"
                                        disabled={running}
                                        onClick={applyYoY}
                                        className="text-xs font-semibold text-[var(--color-primary-searchmind)] hover:underline"
                                    >
                                        Reset to year over year
                                    </button>
                                ) : null}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-gray-500">
                                        Start (comparison)
                                    </label>
                                    <input
                                        type="date"
                                        disabled={running}
                                        value={compareStart}
                                        onChange={(e) => {
                                            setCompareStart(e.target.value);
                                            setCompareCustom(true);
                                        }}
                                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-60"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-gray-500">
                                        End (comparison)
                                    </label>
                                    <input
                                        type="date"
                                        disabled={running}
                                        value={compareEnd}
                                        onChange={(e) => {
                                            setCompareEnd(e.target.value);
                                            setCompareCustom(true);
                                        }}
                                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-60"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-1 border-b border-gray-200">
                        {AUDIT_CATALOG_GROUPS.map((g) => {
                            const disabled = tabDisabled(g.id);
                            const active = activeTab === g.id;
                            const count = pillCountForGroup(g.id, selectedCards, customByGroup);
                            return (
                                <button
                                    key={g.id}
                                    type="button"
                                    disabled={running || disabled}
                                    onClick={() => !disabled && setActiveTab(g.id)}
                                    title={disabled ? "Not connected" : g.label}
                                    className={`inline-flex max-w-[14rem] items-center gap-1.5 truncate px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                                        active
                                            ? "border-[var(--color-primary-searchmind)] text-gray-900"
                                            : "border-transparent text-gray-500 hover:text-gray-800"
                                    } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                                >
                                    <span className="truncate">{g.label}</span>
                                    <span
                                        className={`shrink-0 min-w-[1.25rem] rounded-md px-1.5 py-0.5 text-center text-[0.65rem] font-semibold tabular-nums ${
                                            active
                                                ? "bg-[var(--color-primary-searchmind)]/10 text-[var(--color-primary-searchmind)]"
                                                : "bg-gray-100 text-gray-500"
                                        }`}
                                    >
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {activeGroup ? (
                        <div>
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs text-gray-500 max-w-xl">{activeGroup.description}</p>
                                <button
                                    type="button"
                                    disabled={running}
                                    onClick={() => toggleAllInTab(activeGroup.id)}
                                    className="text-xs font-semibold text-[var(--color-primary-searchmind)] hover:underline shrink-0"
                                >
                                    {activeGroup.items.every((c) => selectedCards.has(c.id))
                                        ? "Deselect all"
                                        : "Select all"}
                                </button>
                            </div>
                            <div className="max-h-[22rem] overflow-y-auto pr-1">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div
                                        className={`col-span-1 sm:col-span-2 rounded-xl border ${
                                            (customByGroup[activeGroup.id] || "").trim()
                                                ? "border-[var(--color-primary-searchmind)] bg-[var(--color-primary-searchmind)]/5"
                                                : "border-dashed border-gray-300 bg-gray-50/50"
                                        }`}
                                    >
                                        <button
                                            type="button"
                                            disabled={running}
                                            className="flex w-full items-center gap-2 px-4 py-3 text-left"
                                            onClick={() =>
                                                setCustomOpen((p) => ({
                                                    ...p,
                                                    [activeGroup.id]: !p[activeGroup.id],
                                                }))
                                            }
                                        >
                                            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase text-teal-800">
                                                Custom
                                            </span>
                                            <span className="text-sm font-semibold text-gray-800">
                                                Custom analysis for {activeGroup.shortLabel}
                                            </span>
                                            {(customByGroup[activeGroup.id] || "").trim() ? (
                                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                            ) : null}
                                            <span className="ml-auto text-gray-400">
                                                {customOpen[activeGroup.id] ? "▴" : "▾"}
                                            </span>
                                        </button>
                                        {customOpen[activeGroup.id] ? (
                                            <div className="px-4 pb-4">
                                                <textarea
                                                    disabled={running}
                                                    value={customByGroup[activeGroup.id] || ""}
                                                    onChange={(e) =>
                                                        setCustomByGroup((p) => ({
                                                            ...p,
                                                            [activeGroup.id]: e.target.value,
                                                        }))
                                                    }
                                                    placeholder="Write your own prompt… e.g. Compare this period to last year and explain what is driving the ROAS decline."
                                                    className="w-full min-h-[96px] rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-[var(--color-primary-searchmind-lighter)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind-lighter)]/30 disabled:opacity-60"
                                                />
                                            </div>
                                        ) : null}
                                    </div>

                                    {activeGroup.items.map((card) => {
                                        const sel = selectedCards.has(card.id);
                                        return (
                                            <button
                                                key={card.id}
                                                type="button"
                                                disabled={running}
                                                onClick={() => toggleCard(card.id)}
                                                className={`relative rounded-xl border p-4 text-left transition ${
                                                    sel
                                                        ? "border-[var(--color-primary-searchmind)] bg-[var(--color-primary-searchmind)]/5 shadow-[inset_0_0_0_1px_var(--color-primary-searchmind)]"
                                                        : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/80"
                                                }`}
                                            >
                                                <span
                                                    className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded text-xs ${
                                                        sel
                                                            ? "bg-[var(--color-primary-searchmind)] text-white"
                                                            : "border border-gray-300 bg-white text-transparent"
                                                    }`}
                                                >
                                                    ✓
                                                </span>
                                                <span
                                                    className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase ${
                                                        AUDIT_TAG_COLOR_CLASSES[card.tagColor] ||
                                                        "bg-gray-100 text-gray-600"
                                                    }`}
                                                >
                                                    {card.tag}
                                                </span>
                                                <h3 className="pr-6 text-sm font-semibold text-gray-900 leading-snug">
                                                    {card.title}
                                                </h3>
                                                <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">
                                                    {card.description}
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : null}

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
                            <p className="max-w-sm text-center text-xs text-gray-500">
                                Fetching channel data for the audit period, then running{" "}
                                {totalSelected} analysis(es) with Claude (Apex prompt library).
                            </p>
                        </div>
                    ) : null}
                </div>

                {!running ? (
                    <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-gray-100 px-5 py-4">
                        <p className="text-sm text-gray-700">
                            <span className="font-bold text-emerald-700">{totalSelected}</span> analyses
                            selected
                        </p>
                        <p className="hidden text-xs text-gray-400 sm:block">
                            Only connected channels with a valid ID can be selected.
                        </p>
                        <div className="flex-1" />
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleRun}
                            disabled={totalSelected === 0}
                            className="rounded-lg bg-[var(--color-primary-searchmind)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-searchmind-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Start audit
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export { canUserRunAudit };
