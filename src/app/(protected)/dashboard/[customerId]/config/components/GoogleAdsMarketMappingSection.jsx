"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
    parseGoogleAdsCustomerIds,
} from "@/lib/googleAdsCustomerIdUtils";
import {
    syncGoogleAdsMarketMappingWithCustomerIds,
    toggleGoogleAdsMarketMapping,
} from "@/lib/googleAdsMarketMapping";

/**
 * Map Google Ads accounts → Shopify Markets when multiple accounts are configured.
 */
export default function GoogleAdsMarketMappingSection({
    customerId,
    googleAdsCustomerId,
    mapping,
    onMappingChange,
    shopifyMarketsEnabled,
}) {
    const googleIds = useMemo(
        () => parseGoogleAdsCustomerIds(googleAdsCustomerId),
        [googleAdsCustomerId]
    );
    const [markets, setMarkets] = useState([]);
    const [marketsLoading, setMarketsLoading] = useState(false);
    const [marketsError, setMarketsError] = useState(null);

    const syncedMapping = useMemo(
        () => syncGoogleAdsMarketMappingWithCustomerIds(mapping, googleAdsCustomerId),
        [mapping, googleAdsCustomerId]
    );

    useEffect(() => {
        const next = syncGoogleAdsMarketMappingWithCustomerIds(mapping, googleAdsCustomerId);
        if (JSON.stringify(next) !== JSON.stringify(mapping || [])) {
            onMappingChange(next);
        }
    }, [googleAdsCustomerId]);

    useEffect(() => {
        if (!customerId || !shopifyMarketsEnabled || googleIds.length <= 1) {
            setMarkets([]);
            return;
        }
        let cancelled = false;
        setMarketsLoading(true);
        setMarketsError(null);
        fetch(`/api/shopify-markets/${customerId}`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load markets"))))
            .then((data) => {
                if (cancelled) return;
                setMarkets(Array.isArray(data?.markets) ? data.markets : []);
            })
            .catch((err) => {
                if (!cancelled) {
                    setMarkets([]);
                    setMarketsError(err.message || "Could not load Shopify Markets");
                }
            })
            .finally(() => {
                if (!cancelled) setMarketsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [customerId, shopifyMarketsEnabled, googleIds.length]);

    if (!shopifyMarketsEnabled || googleIds.length <= 1) return null;

    const handleToggle = (accountId, marketId, checked) => {
        onMappingChange(
            toggleGoogleAdsMarketMapping(syncedMapping, accountId, marketId, checked)
        );
    };

    return (
        <div className="apex-config-mapping-panel">
            <p className="apex-config-mapping-panel__title">
                Google Ads account → Shopify Market mapping
            </p>
            <p className="apex-config-mapping-panel__subtitle">
                When &quot;Filter marketing spend by markets&quot; is enabled on dashboards, mapped
                accounts are used for the selected markets (full account spend, converted to DKK).
                Unmapped selections still use country-based filtering.
            </p>
            {marketsLoading ? (
                <p className="apex-config-empty">Loading Shopify Markets…</p>
            ) : marketsError ? (
                <p className="apex-config-hint apex-config-hint--warn">{marketsError}</p>
            ) : markets.length === 0 ? (
                <p className="apex-config-empty">
                    No Shopify Markets found. Check store credentials and the read_markets scope.
                </p>
            ) : (
                <div className="apex-config-table-wrap">
                    <table className="apex-config-table">
                        <thead>
                            <tr>
                                <th>Google Ads ID</th>
                                {markets.map((m) => (
                                    <th key={m.shopifyqlMarketId} className="is-center">
                                        {m.name}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {syncedMapping.map((row) => (
                                <tr key={row.googleAdsCustomerId}>
                                    <td className="is-brand">{row.googleAdsCustomerId}</td>
                                    {markets.map((m) => {
                                        const marketId = String(m.shopifyqlMarketId);
                                        const checked = (row.shopifyqlMarketIds || []).includes(
                                            marketId
                                        );
                                        return (
                                            <td key={marketId} className="is-center">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(e) =>
                                                        handleToggle(
                                                            row.googleAdsCustomerId,
                                                            marketId,
                                                            e.target.checked
                                                        )
                                                    }
                                                    aria-label={`${row.googleAdsCustomerId} → ${m.name}`}
                                                />
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
