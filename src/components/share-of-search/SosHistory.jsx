"use client";

import React from "react";
import dayjs from "dayjs";
import { FiClock, FiRefreshCw, FiRotateCcw, FiTrash2 } from "react-icons/fi";

/** Saved searches as compact cards: load one to restore its settings and results, or delete it. */
export default function SosHistory({ history, loading, deletingId, onLoad, onDelete }) {
    return (
        <section className="apex-sos-card" aria-labelledby="sos-history-title">
            <div className="apex-sos-card__head">
                <h2 id="sos-history-title" className="apex-sos-card__title">
                    History
                </h2>
                {!loading && history.length > 0 ? <span className="apex-sos-count">{history.length}</span> : null}
            </div>
            <p className="apex-sos-card__sub">Previously saved searches. Load one to restore its brands, country, dates and results.</p>

            {loading ? (
                <p className="apex-sos-empty">Loading history</p>
            ) : history.length === 0 ? (
                <p className="apex-sos-empty">No saved searches yet. Fetch data to create the first one.</p>
            ) : (
                <ul className="apex-sos-history">
                    {history.map((h) => {
                        const id = String(h._id);
                        const brands = h.brands || [];
                        return (
                            <li key={id} className="apex-sos-history__item">
                                <div className="apex-sos-history__main">
                                    <p className="apex-sos-history__brands" title={brands.join(", ")}>
                                        {brands.join(", ") || "No brands"}
                                    </p>
                                    <p className="apex-sos-history__meta">
                                        <span>{h.geoLabel}</span>
                                        <span aria-hidden>·</span>
                                        <span>
                                            {h.startDate} to {h.endDate}
                                        </span>
                                        <span aria-hidden>·</span>
                                        <span className="apex-sos-history__when">
                                            <FiClock aria-hidden /> {h.createdAt ? dayjs(h.createdAt).format("YYYY-MM-DD HH:mm") : "-"}
                                        </span>
                                    </p>
                                </div>
                                <div className="apex-sos-history__actions">
                                    <button type="button" className="apex-sos-btn apex-sos-btn--sm" onClick={() => onLoad(h)}>
                                        <FiRotateCcw aria-hidden /> Load
                                    </button>
                                    <button type="button" className="apex-sos-btn apex-sos-btn--sm apex-sos-btn--danger" disabled={deletingId === id} onClick={() => onDelete(h._id)} aria-label={`Delete saved search ${brands.join(", ")}`}>
                                        {deletingId === id ? <FiRefreshCw className="is-spinning" aria-hidden /> : <FiTrash2 aria-hidden />}
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
