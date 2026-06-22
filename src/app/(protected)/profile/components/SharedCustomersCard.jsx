"use client";

import React from "react";

export default function SharedCustomersCard({ sharedCustomers = [] }) {
    const items = (sharedCustomers || [])
        .map((c) => {
            if (!c) return null;
            const id = typeof c === "string" ? c : c._id || c.id || String(c);
            const label = typeof c === "object" && c.customerName ? c.customerName : id;
            return { id, label };
        })
        .filter(Boolean);

    return (
        <div className="apex-profile-card h-full">
            <h2 className="apex-profile-card__title">Shared Customers</h2>
            <p className="apex-profile-card__subtitle">
                Properties shared with your external account.
            </p>
            {items.length === 0 ? (
                <p className="apex-profile-empty">No shared customers.</p>
            ) : (
                <div className="apex-profile-chips">
                    {items.map((item) => (
                        <span key={item.id} className="apex-profile-chip">
                            {item.label}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
