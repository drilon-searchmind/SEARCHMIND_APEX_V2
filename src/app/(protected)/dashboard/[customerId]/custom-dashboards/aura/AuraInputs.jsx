"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { useCustomers } from "@/hooks/useCustomers";
import { AURA_CHANNELS, AURA_COST_CHANNEL, conversionTotal } from "@/lib/auraInputs";
import { MONTH_NAMES } from "./auraSheetLogic";
import { fetchJson, isoDate } from "./auraApi";

const TABS = [
    { key: "conversions", label: "Conversions" },
    { key: "campaigns", label: "Campaign budgets" },
    { key: "goals", label: "Goals" },
];

const nf0 = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 2 });

/** Input that keeps blank as blank and sends numbers up as numbers. */
function NumberCell({ value, onChange, label, placeholder = "" }) {
    return (
        <input
            type="number"
            inputMode="decimal"
            className="cd-input"
            aria-label={label}
            placeholder={placeholder}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
    );
}

const hasConversionData = (r) =>
    [r.ejeNy, r.ejeEks, r.lejeNy, r.lejeEks].some((v) => v !== null && v !== undefined && v !== "") || Number(r.value) > 0;

function daysInMonth(month) {
    const [y, m] = month.split("-").map(Number);
    return Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

function ConversionsEditor({ rows, setRows }) {
    const [month, setMonth] = useState(() => isoDate(new Date()).slice(0, 7));
    const byDate = useMemo(() => new Map(rows.map((r) => [r.date, r])), [rows]);
    const days = daysInMonth(month);

    const update = (date, patch) =>
        setRows((prev) => {
            const current = prev.find((r) => r.date === date) || { date, value: 0, ejeNy: null, ejeEks: null, lejeNy: null, lejeEks: null };
            const next = { ...current, ...patch };
            const rest = prev.filter((r) => r.date !== date);
            return hasConversionData(next) ? [...rest, next].sort((a, b) => a.date.localeCompare(b.date)) : rest;
        });

    const monthTotal = days.reduce((s, d) => s + (byDate.get(d) ? conversionTotal(byDate.get(d)) : 0), 0);

    return (
        <div>
            <div className="cd-editor__toolbar">
                <label className="cd-field">
                    <span>Month</span>
                    <input type="month" className="cd-input" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
                </label>
                <p className="cd-editor__hint">
                    {MONTH_NAMES[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)} total: <strong>{nf0.format(monthTotal)}</strong>. Fill in the four
                    columns and the total is the sum. Older days may only have a total.
                </p>
            </div>
            <div className="cd-table-wrap">
                <table className="cd-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Eje, new</th>
                            <th>Eje, existing</th>
                            <th>Leje, new</th>
                            <th>Leje, existing</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {days.map((date) => {
                            const r = byDate.get(date) || {};
                            const breakdown = [r.ejeNy, r.ejeEks, r.lejeNy, r.lejeEks].some((v) => v !== null && v !== undefined && v !== "");
                            return (
                                <tr key={date}>
                                    <td>{date}</td>
                                    {["ejeNy", "ejeEks", "lejeNy", "lejeEks"].map((field) => (
                                        <td key={field}>
                                            <NumberCell value={r[field]} label={`${field} ${date}`} onChange={(v) => update(date, { [field]: v })} />
                                        </td>
                                    ))}
                                    <td>
                                        {breakdown ? (
                                            <strong>{nf2.format(conversionTotal(r))}</strong>
                                        ) : (
                                            <NumberCell
                                                value={r.value || null}
                                                label={`Total ${date}`}
                                                placeholder="0"
                                                onChange={(v) => update(date, { value: v ?? 0 })}
                                            />
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function CampaignsEditor({ rows, setRows }) {
    const update = (i, patch) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    const days = (c) =>
        c.startDate && c.endDate && c.endDate >= c.startDate
            ? Math.round((new Date(`${c.endDate}T00:00:00Z`) - new Date(`${c.startDate}T00:00:00Z`)) / 86400000) + 1
            : null;

    return (
        <div>
            <div className="cd-editor__toolbar">
                <p className="cd-editor__hint">
                    Planned budgets for media outside Google Ads and Meta. The budget is spread evenly over the days between start and end, and the
                    daily amounts for the <strong>{AURA_COST_CHANNEL}</strong> channel make up &quot;Other&quot; cost on the dashboard.
                </p>
                <button
                    type="button"
                    className="apex-perf-btn"
                    onClick={() =>
                        setRows((prev) => [...prev, { name: "", channel: AURA_COST_CHANNEL, budget: 0, startDate: isoDate(new Date()), endDate: isoDate(new Date()) }])
                    }
                >
                    Add campaign
                </button>
            </div>
            <div className="cd-table-wrap">
                <table className="cd-table">
                    <thead>
                        <tr>
                            <th>Campaign</th>
                            <th>Channel</th>
                            <th>Budget</th>
                            <th>Start</th>
                            <th>End</th>
                            <th>Days</th>
                            <th>Per day</th>
                            <th aria-label="Remove" />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="cd-table__empty">
                                    No campaigns yet.
                                </td>
                            </tr>
                        ) : null}
                        {rows.map((c, i) => {
                            const d = days(c);
                            return (
                                <tr key={i}>
                                    <td>
                                        <input
                                            className="cd-input cd-input--wide"
                                            aria-label="Campaign name"
                                            value={c.name}
                                            onChange={(e) => update(i, { name: e.target.value })}
                                        />
                                    </td>
                                    <td>
                                        <select className="cd-input" aria-label="Channel" value={c.channel} onChange={(e) => update(i, { channel: e.target.value })}>
                                            {AURA_CHANNELS.map((ch) => (
                                                <option key={ch}>{ch}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td>
                                        <NumberCell value={c.budget} label="Budget" onChange={(v) => update(i, { budget: v ?? 0 })} />
                                    </td>
                                    <td>
                                        <input type="date" className="cd-input" aria-label="Start date" value={c.startDate} onChange={(e) => update(i, { startDate: e.target.value })} />
                                    </td>
                                    <td>
                                        <input type="date" className="cd-input" aria-label="End date" value={c.endDate} onChange={(e) => update(i, { endDate: e.target.value })} />
                                    </td>
                                    <td className="cd-table__num">{d ?? "N/A"}</td>
                                    <td className="cd-table__num">{d ? nf0.format((Number(c.budget) || 0) / d) : "N/A"}</td>
                                    <td>
                                        <button type="button" className="apex-profile-btn-text" onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}>
                                            Remove
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function GoalsEditor({ rows, setRows }) {
    const update = (i, patch) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    return (
        <div>
            <div className="cd-editor__toolbar">
                <p className="cd-editor__hint">
                    Monthly customer goal and budget. The CAC goal line on the chart is budget divided by customer goal.
                </p>
            </div>
            <div className="cd-table-wrap">
                <table className="cd-table">
                    <thead>
                        <tr>
                            <th>Month</th>
                            <th>Customer goal</th>
                            <th>Budget</th>
                            <th>CAC goal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((g, i) => (
                            <tr key={MONTH_NAMES[i]}>
                                <td>{MONTH_NAMES[i]}</td>
                                <td>
                                    <NumberCell value={g.goal} label={`Goal ${MONTH_NAMES[i]}`} onChange={(v) => update(i, { goal: v ?? 0 })} />
                                </td>
                                <td>
                                    <NumberCell value={g.budget} label={`Budget ${MONTH_NAMES[i]}`} onChange={(v) => update(i, { budget: v ?? 0 })} />
                                </td>
                                <td className="cd-table__num">{g.goal > 0 && g.budget > 0 ? nf2.format(g.budget / g.goal) : "N/A"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/** Hand-entered values for the Aura dashboard (the ones that were typed into the old Google Sheet). */
export default function AuraInputs() {
    const params = useParams();
    const { customers } = useCustomers();
    const customer = customers.find((c) => c._id === params.customerId);
    const customerId = customer?._id;

    const [tab, setTab] = useState("conversions");
    const [saved, setSaved] = useState(null);
    const [draft, setDraft] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [status, setStatus] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!customerId) return;
        let cancelled = false;
        fetchJson(`/api/custom-dashboards/aura/inputs?customerId=${customerId}`)
            .then((data) => {
                if (cancelled) return;
                setSaved(data);
                setDraft(data);
            })
            .catch((e) => !cancelled && setLoadError(e.message));
        return () => {
            cancelled = true;
        };
    }, [customerId]);

    const setRows = (key) => (updater) => setDraft((d) => ({ ...d, [key]: typeof updater === "function" ? updater(d[key]) : updater }));
    const dirty = draft && saved ? JSON.stringify(draft[tab]) !== JSON.stringify(saved[tab]) : false;

    const save = async () => {
        setSaving(true);
        setStatus(null);
        try {
            const res = await fetch("/api/custom-dashboards/aura/inputs", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customerId, key: tab, data: draft[tab] }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error || "Could not save");
            setSaved((s) => ({ ...s, [tab]: json.data }));
            setDraft((d) => ({ ...d, [tab]: json.data }));
            setStatus({ ok: true, text: "Saved" });
        } catch (e) {
            setStatus({ ok: false, text: e.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div id="AuraInputs" className="apex-perf w-full">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Aura data inputs"
                label={customer ? customer.customerName : ""}
                customerId={params.customerId}
                loading={!draft && !loadError}
                dashboardType="custom-aura-inputs"
                dataSnapshot={{}}
            />

            {loadError ? (
                <div className="apex-ppc-error">{loadError}</div>
            ) : !draft ? (
                <div className="apex-perf-loading">
                    <CobaltLoader variant="block" title="Loading saved inputs" request="GET /api/custom-dashboards/aura/inputs" />
                </div>
            ) : (
                <section className="cd-editor">
                    <div className="cd-editor__head">
                        <div className="apex-perf-segment" role="tablist" aria-label="Inputs">
                            {TABS.map((t) => (
                                <button
                                    key={t.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === t.key}
                                    className={`apex-perf-segment__btn${tab === t.key ? " is-active" : ""}`}
                                    onClick={() => {
                                        setTab(t.key);
                                        setStatus(null);
                                    }}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                        <div className="cd-editor__save">
                            <span className="cd-editor__status" role="status" data-ok={status?.ok}>
                                {status ? status.text : dirty ? "Unsaved changes" : "All changes saved"}
                            </span>
                            <button
                                type="button"
                                className="apex-profile-btn-text"
                                disabled={!dirty || saving}
                                onClick={() => setDraft((d) => ({ ...d, [tab]: saved[tab] }))}
                            >
                                Discard
                            </button>
                            <button type="button" className="apex-perf-btn apex-perf-btn--primary" disabled={!dirty || saving} onClick={save}>
                                {saving ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </div>

                    {tab === "conversions" ? <ConversionsEditor rows={draft.conversions} setRows={setRows("conversions")} /> : null}
                    {tab === "campaigns" ? <CampaignsEditor rows={draft.campaigns} setRows={setRows("campaigns")} /> : null}
                    {tab === "goals" ? <GoalsEditor rows={draft.goals} setRows={setRows("goals")} /> : null}
                </section>
            )}
        </div>
    );
}
