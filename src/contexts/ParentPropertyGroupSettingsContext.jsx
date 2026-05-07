"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

const STORAGE_KEY_PREFIX = "apex-parent-group-settings:";

const DEFAULTS = {
    shopifyRevenueField: "net_sales",
    groupMetricPreference: "ROAS/POAS",
};

/** @typedef {{ shopifyRevenueField: 'net_sales'|'gross_sales', groupMetricPreference: 'ROAS/POAS'|'Spendshare' }} ParentGroupSettings */

const ParentPropertyGroupSettingsContext = createContext(null);

function safeLoad(parentCustomerId) {
    if (!parentCustomerId || typeof window === "undefined") return DEFAULTS;
    try {
        const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${parentCustomerId}`);
        if (!raw) return DEFAULTS;
        const parsed = JSON.parse(raw);
        return {
            shopifyRevenueField:
                parsed.shopifyRevenueField === "gross_sales" ? "gross_sales" : "net_sales",
            groupMetricPreference:
                parsed.groupMetricPreference === "Spendshare" ? "Spendshare" : "ROAS/POAS",
        };
    } catch {
        return DEFAULTS;
    }
}

export function ParentPropertyGroupSettingsProvider({ children }) {
    const params = useParams();
    const parentCustomerId = params?.parentCustomerId ? String(params.parentCustomerId) : null;

    const [shopifyRevenueField, setShopifyRevenueFieldState] = useState(DEFAULTS.shopifyRevenueField);
    const [groupMetricPreference, setGroupMetricPreferenceState] = useState(DEFAULTS.groupMetricPreference);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        if (!parentCustomerId) return;
        const loaded = safeLoad(parentCustomerId);
        queueMicrotask(() => {
            setShopifyRevenueFieldState(loaded.shopifyRevenueField);
            setGroupMetricPreferenceState(loaded.groupMetricPreference);
            setHydrated(true);
        });
    }, [parentCustomerId]);

    useEffect(() => {
        if (!hydrated || !parentCustomerId || typeof window === "undefined") return;
        window.localStorage.setItem(
            `${STORAGE_KEY_PREFIX}${parentCustomerId}`,
            JSON.stringify({ shopifyRevenueField, groupMetricPreference })
        );
    }, [hydrated, parentCustomerId, shopifyRevenueField, groupMetricPreference]);

    const setShopifyRevenueField = useCallback((v) => {
        setShopifyRevenueFieldState(v === "gross_sales" ? "gross_sales" : "net_sales");
    }, []);

    const setGroupMetricPreference = useCallback((v) => {
        setGroupMetricPreferenceState(v === "Spendshare" ? "Spendshare" : "ROAS/POAS");
    }, []);

    const value = useMemo(
        () => ({
            parentCustomerId,
            shopifyRevenueField,
            groupMetricPreference,
            setShopifyRevenueField,
            setGroupMetricPreference,
            hydrated,
        }),
        [
            parentCustomerId,
            shopifyRevenueField,
            groupMetricPreference,
            setShopifyRevenueField,
            setGroupMetricPreference,
            hydrated,
        ]
    );

    return (
        <ParentPropertyGroupSettingsContext.Provider value={value}>
            {children}
        </ParentPropertyGroupSettingsContext.Provider>
    );
}

/** @returns {ParentGroupSettings & { parentCustomerId: string|null, setShopifyRevenueField: Function, setGroupMetricPreference: Function, hydrated: boolean } | null} */
export function useParentPropertyGroupSettings() {
    return useContext(ParentPropertyGroupSettingsContext);
}
