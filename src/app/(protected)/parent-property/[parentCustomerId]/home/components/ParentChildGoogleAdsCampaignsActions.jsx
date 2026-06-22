"use client";

import React, { useState } from "react";
import { FiSettings } from "react-icons/fi";
import ParentChildGoogleAdsCampaignsModal from "./ParentChildGoogleAdsCampaignsModal";
import { normalizeCampaignNameKeywords } from "@/lib/adCampaignFilterUtils";

/**
 * Cog control next to Google Adspend — opens campaign exclusion modal.
 */
export default function ParentChildGoogleAdsCampaignsActions({
    customerId,
    propertyLabel = "Property",
    startDate,
    endDate,
    excludedCampaigns = {},
    excludedKeywords = [],
    onApplyCampaigns,
    onMenuWillOpen,
    fetchDisabled = false,
}) {
    const [open, setOpen] = useState(false);

    const excludedCount = Object.keys(excludedCampaigns).filter(
        (k) => excludedCampaigns[k] === true
    ).length;
    const keywordCount = normalizeCampaignNameKeywords(excludedKeywords).length;
    const filterActive = excludedCount > 0 || keywordCount > 0;

    return (
        <>
            <button
                type="button"
                title={
                    filterActive
                        ? `${excludedCount} campaign(s), ${keywordCount} keyword(s) excluded — configure`
                        : "Filter Google Ads campaigns"
                }
                className={`apex-parent-icon-btn !w-auto !h-auto p-1${filterActive ? " border-[var(--color-accent)] text-[var(--color-accent)]" : ""}`}
                disabled={fetchDisabled}
                onClick={() => {
                    onMenuWillOpen?.();
                    setOpen(true);
                }}
                aria-label="Google Ads campaign filter"
            >
                <FiSettings className="w-3.5 h-3.5" />
            </button>
            <ParentChildGoogleAdsCampaignsModal
                open={open}
                onClose={() => setOpen(false)}
                customerId={customerId}
                propertyLabel={propertyLabel}
                startDate={startDate}
                endDate={endDate}
                excludedCampaigns={excludedCampaigns}
                excludedKeywords={excludedKeywords}
                onApply={(excludedCampaignIds, excludedCampaignNameKeywords) =>
                    onApplyCampaigns?.(
                        customerId,
                        excludedCampaignIds,
                        excludedCampaignNameKeywords
                    )
                }
                fetchDisabled={fetchDisabled}
            />
        </>
    );
}
