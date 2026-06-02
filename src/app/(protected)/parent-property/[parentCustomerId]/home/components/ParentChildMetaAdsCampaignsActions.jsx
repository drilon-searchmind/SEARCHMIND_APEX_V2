"use client";

import React, { useState } from "react";
import { FiSettings } from "react-icons/fi";
import ParentChildMetaAdsCampaignsModal from "./ParentChildMetaAdsCampaignsModal";
import { normalizeCampaignNameKeywords } from "@/lib/adCampaignFilterUtils";

/**
 * Cog control next to Meta Adspend — opens campaign exclusion modal.
 */
export default function ParentChildMetaAdsCampaignsActions({
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
                        : "Filter Meta Ads campaigns"
                }
                className={`inline-flex items-center justify-center p-0.5 rounded hover:bg-gray-100 text-gray-500 hover:text-[var(--color-primary-searchmind)] ${
                    filterActive ? "text-[var(--color-primary-searchmind)]" : ""
                }`}
                disabled={fetchDisabled}
                onClick={() => {
                    onMenuWillOpen?.();
                    setOpen(true);
                }}
                aria-label="Meta Ads campaign filter"
            >
                <FiSettings className="w-3.5 h-3.5" />
            </button>
            <ParentChildMetaAdsCampaignsModal
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
