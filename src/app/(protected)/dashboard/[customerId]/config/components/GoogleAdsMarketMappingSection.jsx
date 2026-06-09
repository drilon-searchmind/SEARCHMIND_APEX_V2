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
        <div className="col-span-full mt-2 rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm font-medium text-gray-800 mb-1">
                Google Ads account → Shopify Market mapping
            </p>
            <p className="text-xs text-gray-600 leading-snug mb-4">
                When &quot;Filter marketing spend by markets&quot; is enabled on dashboards, mapped
                accounts are used for the selected markets (full account spend, converted to DKK).
                Unmapped selections still use country-based filtering.
            </p>
            {marketsLoading ? (
                <p className="text-xs text-gray-500">Loading Shopify Markets…</p>
            ) : marketsError ? (
                <p className="text-xs text-amber-700">{marketsError}</p>
            ) : markets.length === 0 ? (
                <p className="text-xs text-gray-500">
                    No Shopify Markets found. Check store credentials and the read_markets scope.
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-xs border-collapse">
                        <thead>
                            <tr className="border-b border-gray-200 text-left text-gray-500">
                                <th className="py-2 pr-4 font-medium">Google Ads ID</th>
                                {markets.map((m) => (
                                    <th
                                        key={m.shopifyqlMarketId}
                                        className="py-2 px-2 font-medium whitespace-nowrap"
                                    >
                                        {m.name}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {syncedMapping.map((row) => (
                                <tr
                                    key={row.googleAdsCustomerId}
                                    className="border-b border-gray-100 last:border-0"
                                >
                                    <td className="py-2 pr-4 font-mono text-gray-800">
                                        {row.googleAdsCustomerId}
                                    </td>
                                    {markets.map((m) => {
                                        const marketId = String(m.shopifyqlMarketId);
                                        const checked = (row.shopifyqlMarketIds || []).includes(
                                            marketId
                                        );
                                        return (
                                            <td key={marketId} className="py-2 px-2 text-center">
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
                                                    className="rounded border-gray-300"
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
