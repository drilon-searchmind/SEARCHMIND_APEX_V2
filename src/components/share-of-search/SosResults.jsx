"use client";

import React, { useMemo, useState } from "react";
import { FiArrowDownRight, FiArrowUpRight, FiCalendar, FiDownload, FiLayers, FiMinus, FiSearch, FiTrendingDown, FiTrendingUp } from "react-icons/fi";
import { downloadCsv, pointChange, toCsv } from "./sosAnalytics";

const fmtInt = (n) => Math.round(Number(n) || 0).toLocaleString("da-DK");
const fmtPct = (n) => `${(Number(n) || 0).toLocaleString("da-DK", { maximumFractionDigits: 1 })}%`;
const fmtPts = (n) => `${n > 0 ? "+" : n < 0 ? "-" : ""}${Math.abs(n).toLocaleString("da-DK", { maximumFractionDigits: 1 })} pts`;
const rowKey = (row) => String(row.key ?? row.brand);

/** Change in percentage points, coloured by direction. */
function PointChip({ value, label }) {
    if (value == null) return <span className="apex-sos-chip-pts is-none">{label}: none</span>;
    const tone = value > 0 ? "is-up" : value < 0 ? "is-down" : "is-flat";
    const Icon = value > 0 ? FiArrowUpRight : value < 0 ? FiArrowDownRight : FiMinus;
    return (
        <span className={`apex-sos-chip-pts ${tone}`} title={`${label}: ${fmtPts(value)}`}>
            <Icon aria-hidden />
            {fmtPts(value)}
            <small>{label}</small>
        </span>
    );
}

/** Tiny monthly volume line for a row. */
function Sparkline({ data, color }) {
    if (!data || data.length < 2) return <span className="apex-sos-spark" aria-hidden />;
    const W = 80;
    const H = 26;
    const max = Math.max(...data, 1);
    const min = Math.min(...data);
    const span = Math.max(max - min, 1);
    const step = W / (data.length - 1);
    const d = data.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)} ${(H - 3 - ((v - min) / span) * (H - 6)).toFixed(1)}`).join(" ");
    return (
        <svg className="apex-sos-spark" viewBox={`0 0 ${W} ${H}`} aria-hidden>
            <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

/** One bar split into every brand's share. */
function ShareBar({ rows, colorFor }) {
    return (
        <div className="apex-sos-sharebar" role="img" aria-label="Share of search per brand">
            {rows.map((r) => (
                <span key={rowKey(r)} className="apex-sos-sharebar__seg" style={{ flexGrow: Math.max(Number(r.sharePct) || 0, 0.5), background: colorFor(rowKey(r)) }} title={`${r.label || r.brand}: ${fmtPct(r.sharePct)}`} />
            ))}
        </div>
    );
}

function InsightTile({ icon: Icon, label, title, caption, tone }) {
    return (
        <div className={`apex-sos-insight${tone ? ` is-${tone}` : ""}`}>
            <span className="apex-sos-insight__icon" aria-hidden>
                <Icon />
            </span>
            <div>
                <p className="apex-sos-insight__label">{label}</p>
                <p className="apex-sos-insight__title">{title}</p>
                {caption ? <p className="apex-sos-insight__caption">{caption}</p> : null}
            </div>
        </div>
    );
}

export default function SosResults({
    rows,
    keywordRows,
    colorFor,
    sparkByKey,
    selectedKeys,
    onToggleKey,
    mode,
    onModeChange,
    visualMode,
    onVisualChange,
    chartNode,
    totalVolume,
    comparisonRanges,
    insights,
    grouped,
    range,
    countryLabel,
}) {
    const [tableView, setTableView] = useState("results");
    const sorted = useMemo(() => [...rows].sort((a, b) => (Number(b.sharePct) || 0) - (Number(a.sharePct) || 0)), [rows]);
    const leader = sorted[0];
    const leaderChange = leader ? pointChange(leader, "sharePctPreviousPeriod") : null;
    const showYoy = !comparisonRanges?.rangesEqual;
    const volumeMode = mode === "volume";

    const downloadResults = () => {
        const isKeywords = tableView === "keywords";
        const header = isKeywords ? ["Keyword", "Matched in API", "Volume in range", "Share (ungrouped) %"] : ["Brand", "Keywords", "Volume in range", "Share %", "Share % prior period", "Share % last year"];
        const body = isKeywords
            ? keywordRows.map((r) => [r.brand, r.apiKeywordText, r.volumeInRange, r.sharePct])
            : rows.map((r) => [r.label || r.brand, r.isGroup ? (r.memberBrands || []).join(" + ") : r.apiKeywordText, r.volumeInRange, r.sharePct, r.sharePctPreviousPeriod ?? "", r.sharePctLastYear ?? ""]);
        downloadCsv(`share-of-search-${range.startDate}-${range.endDate}${isKeywords ? "-keywords" : ""}.csv`, toCsv(header, body));
    };

    return (
        <div className="apex-sos-results">
            <section className="apex-sos-hero" aria-label="Summary">
                <div className="apex-sos-hero__main">
                    <p className="apex-sos-hero__eyebrow">
                        <FiSearch aria-hidden /> {countryLabel} <span aria-hidden>·</span> {range.startDate} to {range.endDate}
                    </p>
                    {rows.length > 1 && leader ? (
                        <>
                            <h2 className="apex-sos-hero__title">
                                {leader.label || leader.brand} leads with {fmtPct(leader.sharePct)}
                            </h2>
                            <p className="apex-sos-hero__sub">
                                {leaderChange == null
                                    ? `Share of the ${fmtInt(totalVolume)} searches across the ${rows.length} brands you compared.`
                                    : leaderChange === 0
                                      ? "Unchanged from the previous period."
                                      : `${leaderChange > 0 ? "Up" : "Down"} ${Math.abs(leaderChange).toLocaleString("da-DK", { maximumFractionDigits: 1 })} points on the previous period.`}
                            </p>
                        </>
                    ) : (
                        <>
                            <h2 className="apex-sos-hero__title">Add one more brand to compare</h2>
                            <p className="apex-sos-hero__sub">Share of search is each brand&apos;s part of the total, so it needs at least two.</p>
                        </>
                    )}
                    <ShareBar rows={sorted} colorFor={colorFor} />
                    <ul className="apex-sos-legend">
                        {sorted.map((r) => (
                            <li key={rowKey(r)}>
                                <i style={{ background: colorFor(rowKey(r)) }} aria-hidden />
                                {r.label || r.brand} <b>{fmtPct(r.sharePct)}</b>
                            </li>
                        ))}
                    </ul>
                </div>
                <dl className="apex-sos-hero__facts">
                    <div>
                        <dt>Brands compared</dt>
                        <dd>{rows.length}</dd>
                    </div>
                    <div>
                        <dt>Searches in period</dt>
                        <dd>{fmtInt(totalVolume)}</dd>
                    </div>
                </dl>
            </section>

            <div className="apex-sos-insights">
                <InsightTile
                    icon={FiTrendingUp}
                    label="Biggest gainer"
                    tone="up"
                    title={insights.gainer ? insights.gainer.row.label || insights.gainer.row.brand : "No gainers"}
                    caption={insights.gainer ? `${fmtPts(insights.gainer.change)} vs previous period` : "No brand gained share against the previous period."}
                />
                <InsightTile
                    icon={FiTrendingDown}
                    label="Biggest decliner"
                    tone="down"
                    title={insights.decliner ? insights.decliner.row.label || insights.decliner.row.brand : "No decliners"}
                    caption={insights.decliner ? `${fmtPts(insights.decliner.change)} vs previous period` : "No brand lost share against the previous period."}
                />
                <InsightTile icon={FiCalendar} label="Peak month" title={insights.peak ? insights.peak.label : "Not available"} caption={insights.peak ? `${fmtInt(insights.peak.volume)} searches across all brands` : "Needs monthly volumes."} />
            </div>

            <div className="apex-sos-split">
                <section className="apex-sos-card apex-sos-board" aria-labelledby="sos-board-title">
                    <div className="apex-sos-card__head">
                        <h2 id="sos-board-title" className="apex-sos-card__title">
                            Scoreboard
                        </h2>
                        <span className="apex-sos-hint apex-sos-hint--inline">Click a row to show or hide it in the chart</span>
                    </div>
                    {(comparisonRanges?.previousPeriod?.ok || comparisonRanges?.lastYear?.ok) && (
                        <p className="apex-sos-ranges">
                            {comparisonRanges?.previousPeriod?.ok ? (
                                <span>
                                    <b>Prior period</b> {comparisonRanges.previousPeriod.startDate} to {comparisonRanges.previousPeriod.endDate}
                                </span>
                            ) : null}
                            {comparisonRanges?.lastYear?.ok && showYoy ? (
                                <span>
                                    <b>Last year</b> {comparisonRanges.lastYear.startDate} to {comparisonRanges.lastYear.endDate}
                                </span>
                            ) : null}
                        </p>
                    )}
                    {comparisonRanges?.note ? <p className="apex-sos-ranges">{comparisonRanges.note}</p> : null}

                    <ul className="apex-sos-rows">
                        {volumeMode ? (
                            <li>
                                <button type="button" className={`apex-sos-row${selectedKeys.includes("__total__") ? " is-on" : ""}`} onClick={() => onToggleKey("__total__")} aria-pressed={selectedKeys.includes("__total__")}>
                                    <span className="apex-sos-row__rank">
                                        <i className="apex-sos-row__dot" style={{ "--c": "#94a3b8" }} aria-hidden />
                                    </span>
                                    <span className="apex-sos-row__name">
                                        <b>Total</b>
                                        <small>All brands together</small>
                                    </span>
                                    <span className="apex-sos-row__num">
                                        <b>{fmtInt(totalVolume)}</b>
                                        <small>searches</small>
                                    </span>
                                </button>
                            </li>
                        ) : null}
                        {sorted.map((r, i) => {
                            const key = rowKey(r);
                            const on = selectedKeys.includes(key);
                            return (
                                <li key={key}>
                                    <button type="button" className={`apex-sos-row${on ? " is-on" : ""}`} onClick={() => onToggleKey(key)} aria-pressed={on}>
                                        <span className="apex-sos-row__rank">
                                            <small>{i + 1}</small>
                                            <i className="apex-sos-row__dot" style={{ "--c": colorFor(key) }} aria-hidden />
                                        </span>
                                        <span className="apex-sos-row__name">
                                            <b>{r.label || r.brand}</b>
                                            <small>
                                                {r.isGroup ? (
                                                    <>
                                                        <FiLayers aria-hidden /> {r.memberBrands?.length || 0} keywords
                                                    </>
                                                ) : (
                                                    `${fmtInt(r.volumeInRange)} searches`
                                                )}
                                            </small>
                                        </span>
                                        <Sparkline data={sparkByKey.get(key)} color={colorFor(key)} />
                                        <span className="apex-sos-row__num">
                                            <b>{fmtPct(r.sharePct)}</b>
                                            <small>{r.isGroup ? `${fmtInt(r.volumeInRange)} searches` : "share"}</small>
                                        </span>
                                        <span className="apex-sos-row__changes">
                                            <PointChip value={pointChange(r, "sharePctPreviousPeriod")} label="prior" />
                                            {showYoy ? <PointChip value={pointChange(r, "sharePctLastYear")} label="last year" /> : null}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </section>

                <section className="apex-sos-card apex-sos-chartcard" aria-labelledby="sos-chart-title">
                    <div className="apex-sos-card__head">
                        <h2 id="sos-chart-title" className="apex-sos-card__title">
                            Trend
                        </h2>
                    </div>
                    <div className="apex-sos-tabs">
                        <div className="apex-sos-seg" role="group" aria-label="What to show">
                            <button type="button" className={mode === "share" ? "is-active" : ""} onClick={() => onModeChange("share")} aria-pressed={mode === "share"}>
                                Share of search
                            </button>
                            <button type="button" className={mode === "volume" ? "is-active" : ""} onClick={() => onModeChange("volume")} aria-pressed={mode === "volume"}>
                                Search volume
                            </button>
                        </div>
                        <div className="apex-sos-seg" role="group" aria-label="Chart style">
                            <button type="button" className={visualMode === "stacked" ? "is-active" : ""} onClick={() => onVisualChange("stacked")} aria-pressed={visualMode === "stacked"}>
                                Stacked
                            </button>
                            <button type="button" className={visualMode === "lines" ? "is-active" : ""} onClick={() => onVisualChange("lines")} aria-pressed={visualMode === "lines"}>
                                Lines
                            </button>
                        </div>
                    </div>
                    <div className="apex-sos-chart">{chartNode}</div>
                </section>
            </div>

            <section className="apex-sos-card" aria-labelledby="sos-table-title">
                <div className="apex-sos-card__head apex-sos-card__head--split">
                    <div>
                        <h2 id="sos-table-title" className="apex-sos-card__title">
                            {tableView === "keywords" ? "All keywords fetched" : grouped ? "Grouped results" : "Results"}
                        </h2>
                        <p className="apex-sos-card__sub">{tableView === "keywords" ? "One row per search term sent to Keyword Planner, before grouping." : grouped ? "Combined volumes and share per brand group." : "Keyword Planner volumes and share for the period."}</p>
                    </div>
                    <div className="apex-sos-card__tools">
                        <div className="apex-sos-seg" role="group" aria-label="Table">
                            <button type="button" className={tableView === "results" ? "is-active" : ""} onClick={() => setTableView("results")} aria-pressed={tableView === "results"}>
                                {grouped ? "Grouped" : "Results"}
                            </button>
                            <button type="button" className={tableView === "keywords" ? "is-active" : ""} onClick={() => setTableView("keywords")} aria-pressed={tableView === "keywords"}>
                                Keywords
                            </button>
                        </div>
                        <button type="button" className="apex-sos-btn apex-sos-btn--sm" onClick={downloadResults}>
                            <FiDownload aria-hidden /> CSV
                        </button>
                    </div>
                </div>
                <div className="apex-sos-table-wrap">
                    {tableView === "keywords" ? (
                        <table className="apex-sos-table">
                            <thead>
                                <tr>
                                    <th>Keyword</th>
                                    <th>Matched in API</th>
                                    <th className="is-num">Volume in range</th>
                                    <th className="is-num">Share (ungrouped)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {keywordRows.map((r) => (
                                    <tr key={r.brand}>
                                        <td className="is-brand">{r.brand}</td>
                                        <td className="is-muted">{r.apiKeywordText}</td>
                                        <td className="is-num">{fmtInt(r.volumeInRange)}</td>
                                        <td className="is-num">{fmtPct(r.sharePct)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table className="apex-sos-table">
                            <thead>
                                <tr>
                                    <th>Brand</th>
                                    <th>Keywords</th>
                                    <th className="is-num">Volume in range</th>
                                    <th className="is-num">Share</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((r) => (
                                    <tr key={rowKey(r)}>
                                        <td className="is-brand">
                                            <i className="apex-sos-row__dot" style={{ "--c": colorFor(rowKey(r)) }} aria-hidden /> {r.label || r.brand}
                                        </td>
                                        <td className="is-muted">{r.isGroup ? (r.memberBrands || []).join(", ") : r.apiKeywordText}</td>
                                        <td className="is-num">{fmtInt(r.volumeInRange)}</td>
                                        <td className="is-num">{fmtPct(r.sharePct)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </section>
        </div>
    );
}
