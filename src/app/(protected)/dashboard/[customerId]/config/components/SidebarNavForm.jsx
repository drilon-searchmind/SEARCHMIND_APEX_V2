"use client";

import React from "react";
import {
    DEFAULT_SIDEBAR_NAV_VISIBILITY,
    SIDEBAR_NAV_SECTIONS,
    normalizeSidebarNavVisibility,
} from "@/lib/sidebarNavVisibility";

/**
 * Config tab: which top-level sidebar sections to show when custom dashboards are on.
 */
export default function SidebarNavForm({ form, onChange, saving }) {
    const visibility = normalizeSidebarNavVisibility(
        form.sidebarNavVisibility || DEFAULT_SIDEBAR_NAV_VISIBILITY
    );
    const customOn = form.customDashboardsEnabled === true;

    const setSection = (key, checked) => {
        onChange({
            target: {
                name: "sidebarNavVisibility",
                type: "sidebarNavVisibility",
                value: { ...visibility, [key]: checked },
            },
        });
    };

    return (
        <div className="apex-config-form">
            <div className="apex-config-section">
                <h3 className="apex-config-section__title">Sidebar menu</h3>
                <p className="apex-config-hint" style={{ marginBottom: "1rem" }}>
                    Choose which sections appear in the left menu for this customer. These toggles only
                    apply when <strong>Custom dashboards</strong> are enabled (Property Settings). With
                    custom dashboards off, the full menu is shown.
                </p>

                {!customOn ? (
                    <p className="apex-config-hint" role="status">
                        Custom dashboards are currently off — turn them on under Property Settings to use
                        these options. Until then the sidebar shows every section.
                    </p>
                ) : null}

                <ul className="apex-config-sidebar-nav-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {SIDEBAR_NAV_SECTIONS.map((section) => (
                        <li
                            key={section.key}
                            style={{
                                display: "flex",
                                gap: "0.75rem",
                                alignItems: "flex-start",
                                padding: "0.75rem 0",
                                borderBottom: "1px solid var(--apex-border, #e5e7eb)",
                            }}
                        >
                            <input
                                id={`sidebarNav_${section.key}`}
                                type="checkbox"
                                checked={visibility[section.key] !== false}
                                disabled={saving || !customOn}
                                onChange={(e) => setSection(section.key, e.target.checked)}
                                style={{ marginTop: "0.2rem" }}
                            />
                            <label htmlFor={`sidebarNav_${section.key}`} style={{ cursor: customOn ? "pointer" : "default" }}>
                                <div style={{ fontWeight: 600 }}>{section.label}</div>
                                <div className="apex-config-hint" style={{ marginTop: "0.15rem" }}>
                                    {section.description}
                                </div>
                            </label>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
