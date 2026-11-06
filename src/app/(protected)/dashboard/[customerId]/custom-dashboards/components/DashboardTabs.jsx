"use client";

import React from "react";

/**
 * Reusable tab bar for custom dashboards.
 * `tabs`: [{ key, label, icon? }], `value`: active key, `onChange(key)`.
 */
export default function DashboardTabs({ tabs, value, onChange, label = "Sections" }) {
    return (
        <div className="cd-tabs" role="tablist" aria-label={label}>
            {tabs.map((t) => {
                const Icon = t.icon;
                const active = value === t.key;
                return (
                    <button
                        key={t.key}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        className={`cd-tabs__tab${active ? " is-active" : ""}`}
                        onClick={() => onChange(t.key)}
                    >
                        {Icon ? <Icon aria-hidden="true" /> : null}
                        {t.label}
                    </button>
                );
            })}
        </div>
    );
}
