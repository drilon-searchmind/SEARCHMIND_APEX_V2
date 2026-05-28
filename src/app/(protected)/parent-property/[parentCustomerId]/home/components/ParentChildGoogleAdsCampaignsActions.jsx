"use client";

import React, { useState } from "react";
import { FiSettings } from "react-icons/fi";
import ParentChildGoogleAdsCampaignsModal from "./ParentChildGoogleAdsCampaignsModal";

/**
 * Cog control next to Google Adspend — opens campaign exclusion modal.
 */
export default function ParentChildGoogleAdsCampaignsActions({
    customerId,
    propertyLabel = "Property",
    startDate,
    endDate,
    excludedCampaigns = {},
    onApplyCampaigns,
    onMenuWillOpen,
    fetchDisabled = false,
}) {
    const [open, setOpen] = useState(false);

    const excludedCount = Object.keys(excludedCampaigns).filter(
        (k) => excludedCampaigns[k] === true
    ).length;

    return (
        <>
            <button
                type="button"
                title={
                    excludedCount > 0
                        ? `${excludedCount} campaign(s) excluded — configure`
                        : "Filter Google Ads campaigns"
                }
                className={`inline-flex items-center justify-center p-0.5 rounded hover:bg-gray-100 text-gray-500 hover:text-[var(--color-primary-searchmind)] ${
                    excludedCount > 0 ? "text-[var(--color-primary-searchmind)]" : ""
                }`}
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
                onApply={(excludedCampaignIds) =>
                    onApplyCampaigns?.(customerId, excludedCampaignIds)
                }
                fetchDisabled={fetchDisabled}
            />
        </>
    );
}
