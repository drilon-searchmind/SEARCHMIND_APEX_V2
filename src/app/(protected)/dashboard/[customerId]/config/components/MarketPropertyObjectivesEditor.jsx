"use client";

import React, { useEffect, useMemo, useState } from "react";
import PropertyObjectivesTable from "./PropertyObjectivesTable";
import { marketObjectivesHasData } from "@/lib/propertyObjectivesUtils";

export default function MarketPropertyObjectivesEditor({
    customerId,
    marketObjectives = {},
    onMarketObjectivesChange,
    markets: marketsProp,
    marketsLoading: marketsLoadingProp,
}) {
    const [markets, setMarkets] = useState(marketsProp || []);
    const [marketsLoading, setMarketsLoading] = useState(Boolean(marketsLoadingProp));
    const [selectedMarketId, setSelectedMarketId] = useState("");

    useEffect(() => {
        if (marketsProp) {
            setMarkets(marketsProp);
            setMarketsLoading(Boolean(marketsLoadingProp));
            return undefined;
        }
        if (!customerId) return undefined;

        let cancelled = false;
        setMarketsLoading(true);
        fetch(`/api/shopify-markets/${customerId}`, { credentials: "same-origin" })
            .then(async (r) => {
                const body = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(body.error || `Failed to load markets (${r.status})`);
                return body;
            })
            .then((body) => {
                if (cancelled) return;
                setMarkets(Array.isArray(body.markets) ? body.markets : []);
            })
            .catch(() => {
                if (!cancelled) setMarkets([]);
            })
            .finally(() => {
                if (!cancelled) setMarketsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [customerId, marketsProp, marketsLoadingProp]);

    useEffect(() => {
        if (!markets.length) {
            setSelectedMarketId("");
            return;
        }
        const stillValid = markets.some((m) => String(m.shopifyqlMarketId) === selectedMarketId);
        if (!stillValid) {
            setSelectedMarketId(String(markets[0].shopifyqlMarketId));
        }
    }, [markets, selectedMarketId]);

    const selectedObjectives = useMemo(() => {
        if (!selectedMarketId) return {};
        return marketObjectives[selectedMarketId] || {};
    }, [marketObjectives, selectedMarketId]);

    const handleTableChange = (updated) => {
        if (!selectedMarketId || !onMarketObjectivesChange) return;
        onMarketObjectivesChange({
            ...marketObjectives,
            [selectedMarketId]: updated,
        });
    };

    if (marketsLoading) {
        return <p className="apex-config-empty">Loading Shopify markets…</p>;
    }

    if (!markets.length) {
        return (
            <p className="apex-config-empty">
                No Shopify markets found. Ensure the Admin API token includes the read_markets scope.
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="apex-config-card__title" htmlFor="market-objectives-select">
                    Market
                </label>
                <select
                    id="market-objectives-select"
                    className="w-full sm:max-w-xs"
                    value={selectedMarketId}
                    onChange={(e) => setSelectedMarketId(e.target.value)}
                >
                    {markets.map((m) => {
                        const id = String(m.shopifyqlMarketId);
                        const configured = marketObjectivesHasData(marketObjectives[id]);
                        const label = m.name || m.handle || id;
                        return (
                            <option key={id} value={id}>
                                {configured ? `${label} ✓` : label}
                            </option>
                        );
                    })}
                </select>
            </div>
            <p className="apex-config-field-hint">
                Configure revenue targets and marketing budgets for the selected market.
            </p>
            <PropertyObjectivesTable
                objectives={selectedObjectives}
                onObjectivesChange={handleTableChange}
            />
        </div>
    );
}
