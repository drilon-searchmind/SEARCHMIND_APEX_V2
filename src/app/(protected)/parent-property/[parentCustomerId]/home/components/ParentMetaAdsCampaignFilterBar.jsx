"use client";

import React from "react";

export default function ParentMetaAdsCampaignFilterBar({
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
                <span className="font-medium">Filter Meta Ads by campaign</span>
            </label>
            {!enabled ? (
                <span className="apex-parent-filter-bar__hint">
                    Off — Meta Ads spend uses all campaigns (default).
                </span>
            ) : null}
        </div>
    );
}
