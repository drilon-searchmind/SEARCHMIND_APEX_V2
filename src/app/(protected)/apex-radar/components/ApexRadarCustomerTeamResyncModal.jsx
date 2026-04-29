"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FiSearch, FiX } from "react-icons/fi";

function normName(s) {
    return String(s || "")
        .trim()
        .toLowerCase();
}

function clickupIdLabel(c) {
    const id = c?.CustomerSettings?.customerClickupID;
    return typeof id === "string" && id.trim() ? id.trim() : null;
}

export default function ApexRadarCustomerTeamResyncModal({ open, onClose, customers = [], onSynced }) {
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState(() => new Set());
    const [syncing, setSyncing] = useState(false);
    const [lastError, setLastError] = useState(null);

    useEffect(() => {
        if (open) {
            setSearch("");
            setSelected(new Set());
            setLastError(null);
        }
    }, [open]);

    const filtered = useMemo(() => {
        const q = normName(search);
        const list = Array.isArray(customers) ? customers : [];
        let out = list;
        if (q) {
            out = list.filter((c) => {
                const name = normName(c?.customerName || "");
                const cid = String(c?._id || "").toLowerCase();
                return name.includes(q) || cid.includes(q);
            });
        }
        return out;
    }, [customers, search]);

    const selectableFiltered = useMemo(
        () => filtered.filter((c) => Boolean(clickupIdLabel(c))),
        [filtered]
    );

    const selectableIds = useMemo(
        () =>
            new Set(
                selectableFiltered.map((c) => String(c._id)).filter(Boolean)
            ),
        [selectableFiltered]
    );

    const allSelectableSelected =
        selectableFiltered.length > 0 && selectableFiltered.every((c) => selected.has(String(c._id)));

    const toggleOne = (cid) => {
        const id = String(cid);
        if (!id || !selectableIds.has(id)) return;
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAllFiltered = () => {
        if (allSelectableSelected) {
            setSelected((prev) => {
                const next = new Set(prev);
                for (const c of selectableFiltered) {
                    next.delete(String(c._id));
                }
                return next;
            });
        } else {
            setSelected((prev) => {
                const next = new Set(prev);
                for (const c of selectableFiltered) {
                    const id = String(c._id);
                    if (clickupIdLabel(c)) next.add(id);
                }
                return next;
            });
        }
    };

    const handleRun = async () => {
        const ids = Array.from(selected);
        if (!ids.length) return;
        try {
            setSyncing(true);
            setLastError(null);
            const res = await fetch("/api/apex-radar/sync-customer-teams", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customerIds: ids }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || "Sync failed");
            }
            await onSynced?.(data);
            onClose?.();
        } catch (e) {
            setLastError(e?.message || "Sync failed");
        } finally {
            setSyncing(false);
        }
    };

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/45"
            role="dialog"
            aria-modal="true"
            aria-labelledby="apex-resync-title"
        >
            <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white overflow-hidden shadow-xl max-h-[85vh] flex flex-col">
                <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
                    <div>
                        <h2 id="apex-resync-title" className="text-lg font-semibold text-gray-900">
                            Re-sync ClickUp teams
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">
                            Refreshes cached customerTeam fields (roster + services) for chosen customers. Properties
                            need a
                            ClickUp ID configured.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => !syncing && onClose?.()}
                        disabled={syncing}
                        className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                        aria-label="Close"
                    >
                        <FiX className="h-5 w-5" />
                    </button>
                </div>

                <div className="px-5 py-3 border-b border-gray-50 space-y-2 shrink-0">
                    <div className="relative">
                        <FiSearch
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                            aria-hidden
                        />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search customers…"
                            autoComplete="off"
                            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[var(--color-primary-searchmind-lighter)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind-lighter)]/30"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={toggleSelectAllFiltered}
                        disabled={!selectableFiltered.length || syncing}
                        className="text-xs font-semibold text-[var(--color-primary-searchmind)] hover:underline disabled:opacity-40 disabled:pointer-events-none"
                    >
                        {allSelectableSelected ? "Deselect all in list" : "Select all in list"}
                    </button>
                </div>

                <div className="flex-1 min-h-[200px] overflow-y-auto px-2 py-2">
                    {filtered.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-8 px-3">No customers match your search.</p>
                    ) : (
                        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100 overflow-hidden bg-white">
                            {filtered.map((c) => {
                                const cid = String(c._id || "");
                                const cu = clickupIdLabel(c);
                                const disabledRow = !cu;
                                const checked = selected.has(cid);
                                return (
                                    <li key={cid}>
                                        <label
                                            className={`flex items-start gap-3 px-3 py-2.5 ${
                                                disabledRow ? "opacity-55 cursor-not-allowed" : "cursor-pointer hover:bg-gray-50"
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                className="mt-0.5 rounded border-gray-300 text-[var(--color-primary-searchmind)] focus:ring-[var(--color-primary-searchmind)]"
                                                checked={checked}
                                                disabled={disabledRow || syncing}
                                                onChange={() => toggleOne(cid)}
                                            />
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-sm font-medium text-gray-900 truncate">
                                                    {c.customerName || "Unnamed"}
                                                </span>
                                                <span className="block text-[0.65rem] text-gray-400 font-mono truncate">
                                                    {cid}
                                                </span>
                                                {!cu ? (
                                                    <span className="block text-[0.65rem] text-amber-700 mt-0.5">
                                                        No ClickUp ID — skipped
                                                    </span>
                                                ) : null}
                                            </span>
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {lastError ? (
                    <div className="px-5 py-2 text-xs text-red-700 bg-red-50 shrink-0 border-t border-red-100">
                        {lastError}
                    </div>
                ) : null}

                <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50 shrink-0">
                    <span className="text-xs text-gray-500">{selected.size} selected</span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={syncing}
                            onClick={() => !syncing && onClose?.()}
                            className="text-xs font-semibold text-gray-700 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={syncing || !selected.size}
                            onClick={handleRun}
                            className="text-xs font-semibold text-white px-3 py-2 rounded-lg bg-[var(--color-primary-searchmind)] hover:bg-[var(--color-primary-searchmind-hover)] disabled:opacity-50"
                        >
                            {syncing ? "Syncing…" : "Run sync"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
