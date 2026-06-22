"use client";

import React from "react";

export default function ParentGoogleAdsCampaignFilterBar({
    enabled = false,
    onEnabledChange,
    disabled = false,
}) {
    return (
        <div className="apex-parent-filter-bar">
            <label>
                <input
                    type="checkbox"
                    className="apex-parent-checkbox"
                    checked={enabled}
                    disabled={disabled}
                    onChange={(e) => onEnabledChange?.(e.target.checked)}
                />
                <span className="font-medium">Filter Google Ads by campaign</span>
            </label>
            {!enabled ? (
                <span className="apex-parent-filter-bar__hint">
                    Off — Google Ads spend uses all campaigns (default).
                </span>
            ) : null}
        </div>
    );
}
