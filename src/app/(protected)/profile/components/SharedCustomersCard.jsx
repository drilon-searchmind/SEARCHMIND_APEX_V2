"use client";

import React, { useMemo, useState } from "react";
import { FiSearch } from "react-icons/fi";

const SEARCH_THRESHOLD = 8;

export default function SharedCustomersCard({ sharedCustomers = [] }) {
    const [query, setQuery] = useState("");

    const items = useMemo(
        () =>
            (sharedCustomers || [])
                .map((c) => {
                    if (!c) return null;
                    const id = typeof c === "string" ? c : c._id || c.id || String(c);
                    const label = typeof c === "object" && c.customerName ? c.customerName : id;
                    return { id, label };
                })
                .filter(Boolean)
                .sort((a, b) => a.label.localeCompare(b.label)),
        [sharedCustomers]
    );

    const q = query.trim().toLowerCase();
    const visible = q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items;

    return (
        <section className="apex-profile-card apex-profile-reveal" aria-labelledby="shared-customers-title">
            <header className="apex-profile-card__head apex-profile-card__head--row">
                <div>
                    <h2 id="shared-customers-title" className="apex-profile-card__title">Shared customers</h2>
                    <p className="apex-profile-card__subtitle">Properties shared with your external account.</p>
                </div>
                {items.length > 0 ? <span className="apex-profile-count">{items.length}</span> : null}
            </header>

            {items.length === 0 ? (
                <div className="apex-profile-empty">
                    <p className="apex-profile-empty__title">No customers shared yet</p>
                    <p className="apex-profile-empty__text">
                        When a colleague shares a property with your account, it will appear here.
                    </p>
                </div>
            ) : (
                <>
                    {items.length > SEARCH_THRESHOLD ? (
                        <label className="apex-profile-search">
                            <FiSearch aria-hidden="true" />
                            <span className="sr-only">Search shared customers</span>
                            <input
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search customers"
                            />
                        </label>
                    ) : null}
                    {visible.length === 0 ? (
                        <p className="apex-profile-empty__text">No customers match &quot;{query}&quot;.</p>
                    ) : (
                        <ul className="apex-profile-chips">
                            {visible.map((item) => (
                                <li key={item.id} className="apex-profile-chip">
                                    <span className="apex-profile-chip__mark" aria-hidden="true">
                                        {item.label.slice(0, 1).toUpperCase()}
                                    </span>
                                    {item.label}
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </section>
    );
}
