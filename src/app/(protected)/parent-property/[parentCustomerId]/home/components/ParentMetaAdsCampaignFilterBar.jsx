"use client";

import React from "react";

/**
 * Master toggle for parent group Meta (Facebook) campaign exclusions.
 */
export default function ParentMetaAdsCampaignFilterBar({
    enabled = false,
    onEnabledChange,
    disabled = false,
}) {
    return (
        <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                    type="checkbox"
                    className="rounded border-gray-300 text-[var(--color-primary-searchmind)] focus:ring-[var(--color-primary-searchmind)]"
                    checked={enabled}
                    disabled={disabled}
                    onChange={(e) => onEnabledChange?.(e.target.checked)}
                />
                <span className="font-medium text-gray-700">Filter Meta Ads by campaign</span>
            </label>
            {!enabled && (
                <span className="text-xs text-gray-500">
                    Off — Meta Adspend uses all campaigns (default).
                </span>
            )}
        </div>
    );
}
