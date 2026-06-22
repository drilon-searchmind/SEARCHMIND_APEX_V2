"use client";

import React, { useState } from "react";
import { FiSettings } from "react-icons/fi";
import { useParentPropertyGroupSettings } from "@/contexts/ParentPropertyGroupSettingsContext";
import ParentPropertyGroupSettingsModal from "@/components/layout/ParentPropertyGroupSettingsModal";

export default function ParentPropertyGroupSettingsTrigger() {
    const ctx = useParentPropertyGroupSettings();
    const [open, setOpen] = useState(false);
    const [modalMountKey, setModalMountKey] = useState(0);

    if (!ctx?.parentCustomerId) return null;

    const draft = {
        shopifyRevenueField: ctx.shopifyRevenueField,
        groupMetricPreference: ctx.groupMetricPreference,
    };

    return (
        <>
            <button
                type="button"
                onClick={() => {
                    setModalMountKey((k) => k + 1);
                    setOpen(true);
                }}
                title="Group view settings"
                className="apex-parent-icon-btn"
                aria-label="Group view settings"
            >
                <FiSettings className="w-4 h-4" />
            </button>
            {open && (
                <ParentPropertyGroupSettingsModal
                    key={modalMountKey}
                    onClose={() => setOpen(false)}
                    draft={draft}
                    onApply={({ shopifyRevenueField, groupMetricPreference }) => {
                        ctx.setShopifyRevenueField(shopifyRevenueField);
                        ctx.setGroupMetricPreference(groupMetricPreference);
                    }}
                />
            )}
        </>
    );
}
