"use client";

import React, { useMemo } from "react";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { combineGa4Totals } from "@/lib/parentPropertyB2B";

const fmtNum = (n, d = 0) =>
    Number(n ?? 0).toLocaleString("da-DK", { maximumFractionDigits: d, minimumFractionDigits: d });
const fmtCur = (n) =>
    Number(n ?? 0).toLocaleString("da-DK", {
        style: "currency",
        currency: "DKK",
        maximumFractionDigits: 0,
    });
const fmtPct = (n) => `${Number(n ?? 0).toFixed(1)}%`;

function pctChange(cur, prev) {
    if (prev === 0 || prev == null || cur == null) return null;
    return ((cur - prev) / Math.abs(prev)) * 100;
}

/** Cost metrics are "better" when they go down. */
function Delta({ cur, prev, inverse = false }) {
    const p = pctChange(cur, prev);
    if (p === null) return null;
    const up = p > 0;
    const good = inverse ? !up : up;
    return (
        <span
            className="apex-parent-table__meta"
            style={{ marginLeft: 6, color: p === 0 ? undefined : good ? "#15803d" : "#b91c1c" }}
        >
            {up ? "▲" : p < 0 ? "▼" : ""} {Math.abs(p).toFixed(0)}%
        </span>
    );
}

function metricsOf(ga4Totals, spend) {
    const sessions = Number(ga4Totals?.sessions) || 0;
    const conversions = Number(ga4Totals?.conversions) || 0;
    return {
        sessions,
        users: Number(ga4Totals?.totalUsers) || 0,
        conversions,
        convRate: sessions > 0 ? (conversions / sessions) * 100 : 0,
        spend: Number(spend) || 0,
        costPerSession: sessions > 0 ? spend / sessions : 0,
        costPerLead: conversions > 0 ? spend / conversions : 0,
    };
}

const COLUMNS = [
    { key: "sessions", label: "Sessions", fmt: fmtNum },
    { key: "users", label: "Users", fmt: fmtNum },
    { key: "conversions", label: "Conversions", fmt: fmtNum },
    { key: "convRate", label: "Conv. rate", fmt: fmtPct },
    { key: "spend", label: "Ad spend", fmt: fmtCur, inverse: true },
    { key: "costPerSession", label: "Cost / session", fmt: fmtCur, inverse: true },
    { key: "costPerLead", label: "Cost / lead", fmt: fmtCur, inverse: true },
];

export default function ParentB2BChildTable({ rows, loading, error }) {
    const body = useMemo(() => {
        const list = (rows || []).filter((r) => r?.b2b);
        const mapped = list.map((r) => ({
            id: String(r._id),
            name: r.customerName,
            ga4Configured: r.b2b.ga4Configured,
            cur: metricsOf(r.b2b.current?.ga4Totals, r.adspend),
            prev: metricsOf(r.b2b.prev?.ga4Totals, r.prevData?.adspend),
        }));
        const total = {
            id: "__total__",
            name: "Total",
            cur: metricsOf(
                combineGa4Totals(list.map((r) => r.b2b.current?.ga4Totals)),
                list.reduce((s, r) => s + (r.adspend || 0), 0)
            ),
            prev: metricsOf(
                combineGa4Totals(list.map((r) => r.b2b.prev?.ga4Totals)),
                list.reduce((s, r) => s + (r.prevData?.adspend || 0), 0)
            ),
        };
        return { mapped, total };
    }, [rows]);

    return (
        <div className="apex-parent-panel">
            <div className="apex-parent-panel__head">
                <div>
                    <h3 className="apex-parent-panel__title">Child properties</h3>
                    <p className="apex-parent-panel__subtitle">
                        GA4 traffic, conversions and ad spend per market. Change vs. comparison period.
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="apex-parent-loader-panel min-h-[8rem]">
                    <CobaltLoader variant="block" title="Loading properties" request="GET /api/parent-customers" />
                </div>
            ) : error ? (
                <div className="apex-daily-error">{error}</div>
            ) : (
                <div className="apex-parent-table-wrap">
                    <table className="apex-parent-table">
                        <thead>
                            <tr>
                                <th>Property name</th>
                                {COLUMNS.map((c) => (
                                    <th key={c.key}>{c.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {body.mapped.length === 0 ? (
                                <tr>
                                    <td colSpan={COLUMNS.length + 1} className="apex-parent-table__empty">
                                        No enabled properties
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {body.mapped.map((r) => (
                                        <tr key={r.id}>
                                            <td className="whitespace-nowrap">
                                                {r.name}
                                                {r.ga4Configured === false ? (
                                                    <span className="apex-parent-table__meta"> (GA4 not connected)</span>
                                                ) : null}
                                            </td>
                                            {COLUMNS.map((c) => (
                                                <td key={c.key} className="whitespace-nowrap">
                                                    {c.fmt(r.cur[c.key])}
                                                    <Delta cur={r.cur[c.key]} prev={r.prev[c.key]} inverse={c.inverse} />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                    <tr style={{ fontWeight: 600 }}>
                                        <td className="whitespace-nowrap">{body.total.name}</td>
                                        {COLUMNS.map((c) => (
                                            <td key={c.key} className="whitespace-nowrap">
                                                {c.fmt(body.total.cur[c.key])}
                                                <Delta
                                                    cur={body.total.cur[c.key]}
                                                    prev={body.total.prev[c.key]}
                                                    inverse={c.inverse}
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
