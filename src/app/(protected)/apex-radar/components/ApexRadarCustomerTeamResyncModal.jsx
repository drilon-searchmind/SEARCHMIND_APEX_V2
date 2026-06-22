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
        () => new Set(selectableFiltered.map((c) => String(c._id)).filter(Boolean)),
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
        <div className="apex-radar-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="apex-resync-title">
            <div className="apex-radar-modal apex-radar-modal--lg max-h-[85vh]">
                <div className="apex-radar-modal__head">
                    <div>
                        <h2 id="apex-resync-title" className="apex-radar-modal__title">
                            Re-sync ClickUp teams
                        </h2>
                        <p className="apex-radar-modal__subtitle">
                            Refreshes cached customerTeam fields (roster + services) for chosen customers.
                            Properties need a ClickUp ID configured.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => !syncing && onClose?.()}
                        disabled={syncing}
                        className="apex-radar-modal__close"
                        aria-label="Close"
                    >
                        <FiX className="h-5 w-5" />
                    </button>
                </div>

                <div className="px-5 py-3 border-b border-[var(--color-rule)] space-y-2 shrink-0">
                    <div className="apex-radar-search-wrap">
                        <FiSearch className="h-4 w-4" aria-hidden />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search customers…"
                            autoComplete="off"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={toggleSelectAllFiltered}
                        disabled={!selectableFiltered.length || syncing}
                        className="apex-radar-link-btn disabled:opacity-40 disabled:pointer-events-none"
                    >
                        {allSelectableSelected ? "Deselect all in list" : "Select all in list"}
                    </button>
                </div>

                <div className="flex-1 min-h-[200px] overflow-y-auto px-2 py-2">
                    {filtered.length === 0 ? (
                        <p className="apex-radar-empty py-8">No customers match your search.</p>
                    ) : (
                        <ul className="apex-radar-modal-list">
                            {filtered.map((c) => {
                                const cid = String(c._id || "");
                                const cu = clickupIdLabel(c);
                                const disabledRow = !cu;
                                const checked = selected.has(cid);
                                return (
                                    <li key={cid}>
                                        <label className={disabledRow ? "is-disabled" : ""}>
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                disabled={disabledRow || syncing}
                                                onChange={() => toggleOne(cid)}
                                            />
                                            <span className="flex-1 min-w-0">
                                                <span className="block font-medium truncate">
                                                    {c.customerName || "Unnamed"}
                                                </span>
                                                <span className="block text-[0.65rem] font-mono text-[var(--color-muted)] truncate">
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
                    <div className="px-5 py-2 text-xs text-[var(--color-error,oklch(50%_0.15_25))] bg-[var(--color-paper-3)] shrink-0 border-t border-[var(--color-rule)]">
                        {lastError}
                    </div>
                ) : null}

                <div className="apex-radar-modal__foot apex-radar-modal__foot--between">
                    <span className="text-xs text-[var(--color-muted)]">{selected.size} selected</span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={syncing}
                            onClick={() => !syncing && onClose?.()}
                            className="apex-perf-btn apex-perf-btn--secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={syncing || !selected.size}
                            onClick={handleRun}
                            className="apex-perf-btn apex-perf-btn--primary"
                        >
                            {syncing ? "Syncing…" : "Run sync"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
