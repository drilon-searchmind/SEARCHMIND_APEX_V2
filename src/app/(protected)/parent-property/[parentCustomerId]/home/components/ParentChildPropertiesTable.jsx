"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import FormButton from "@/components/form/FormButton";
import Spinner from "@/components/ui/Spinner";
import { isShopifyMarketsCustomer } from "@/lib/customerPlatformDisplay";
import { adSpendChannelsForShopifyMarketsFilterUi } from "@/lib/mergeAdSpendDaily";
import { isValidIntegrationId } from "@/lib/customerServiceIntegrations";
import { normalizeMongoId } from "@/lib/parentPropertyGoogleAdsCampaignOverrides";
import { buildOrderedVisibleColumns } from "@root/lib/parentChildPropertiesTableColumns";
import ParentChildShopifyMarketsActions from "./ParentChildShopifyMarketsActions";
import ParentChildAdSpendPlatformsActions from "./ParentChildAdSpendPlatformsActions";
import ParentChildGoogleAdsCampaignsActions from "./ParentChildGoogleAdsCampaignsActions";
import ParentChildMetaAdsCampaignsActions from "./ParentChildMetaAdsCampaignsActions";
import ParentGoogleAdsCampaignFilterBar from "./ParentGoogleAdsCampaignFilterBar";
import ParentMetaAdsCampaignFilterBar from "./ParentMetaAdsCampaignFilterBar";
import ParentChildPropertiesColumnPicker, {
    useParentChildPropertiesTableColumns,
} from "./ParentChildPropertiesColumnPicker";

function formatDkk(n) {
    return (n ?? 0).toLocaleString("da-DK", { style: "currency", currency: "DKK" });
}

function formatPercentRatio(n) {
    if (n == null || Number.isNaN(n)) return "-";
    return `${(n * 100).toFixed(2)}%`;
}

/**
 * Child property breakdown table with Markets / Spend filters per Shopify Markets row.
 */
export default function ParentChildPropertiesTable({
    parentCustomerId,
    loading,
    error,
    rows = [],
    childCustomers = [],
    visibleAdSpendChannels = [],
    visibleColumnIds: visibleColumnIdsProp,
    onVisibleColumnIdsChange,
    shopifyRevenueField = "net_sales",
    predominantMetricPreference = "ROAS/POAS",
    groupMarketExcludedDraft = {},
    groupMarketFilterAdSpendDraft = {},
    groupSpendExcludedDraft = {},
    onToggleMarket,
    onCatalogLoaded,
    onApplyMarketsForChild,
    onMarketsMenuOpen,
    onFilterAdSpendByMarketChange,
    onToggleSpendPlatform,
    onApplySpendForChild,
    onSpendMenuOpen,
    fetchDisabled = false,
    googleCampaignFilterEnabled = false,
    onGoogleCampaignFilterEnabledChange,
    groupGoogleCampaignExcludedDraft = {},
    groupGoogleCampaignKeywordsDraft = {},
    appliedDateRange,
    onApplyGoogleCampaignsForChild,
    onGoogleCampaignsMenuOpen,
    metaCampaignFilterEnabled = false,
    onMetaCampaignFilterEnabledChange,
    groupMetaCampaignExcludedDraft = {},
    groupMetaCampaignKeywordsDraft = {},
    onApplyMetaCampaignsForChild,
    onMetaCampaignsMenuOpen,
}) {
    const hook = useParentChildPropertiesTableColumns(parentCustomerId, visibleAdSpendChannels);
    const visibleColumnIds = visibleColumnIdsProp ?? hook.visibleColumnIds;
    const setVisibleColumnIds = onVisibleColumnIdsChange ?? hook.setVisibleColumnIds;

    const orderedColumns = useMemo(
        () => buildOrderedVisibleColumns(visibleColumnIds, hook.allColumns),
        [visibleColumnIds, hook.allColumns]
    );

    const getRowChannelSpend = (row, channelId) =>
        row.channelAdspend?.[channelId] ??
        row[`${channelId}Adspend`] ??
        (channelId === "facebook" ? row.facebookAdspend : undefined) ??
        (channelId === "google" ? row.googleAdspend : undefined) ??
        0;

    const colSpan = 1 + orderedColumns.length + 1;

    const childIdKey = (row) => normalizeMongoId(row._id);

    const showGoogleCampaignCog = (row) => {
        if (!googleCampaignFilterEnabled) return false;
        const childDoc = childCustomers.find((c) => String(c._id) === String(row._id));
        return isValidIntegrationId(childDoc?.CustomerSettings?.googleAdsCustomerId);
    };

    const showMetaCampaignCog = (row) => {
        if (!metaCampaignFilterEnabled) return false;
        const childDoc = childCustomers.find((c) => String(c._id) === String(row._id));
        return isValidIntegrationId(childDoc?.CustomerSettings?.facebookAdAccountId);
    };

    const blendedHeaderLabel =
        predominantMetricPreference === "Spendshare" ? "Spendshare" : "Blended ROAS";

    const columnHeaderLabel = (col) => {
        if (col.id === "blended") return blendedHeaderLabel;
        return col.label;
    };

    const renderChannelCell = (row, channelId) => {
        const spend = formatDkk(getRowChannelSpend(row, channelId));
        const cid = childIdKey(row);
        const isGoogle = channelId === "google";
        const isFacebook = channelId === "facebook";
        return (
            <span className="inline-flex items-center gap-1">
                {spend}
                {isGoogle && showGoogleCampaignCog(row) && (
                    <ParentChildGoogleAdsCampaignsActions
                        customerId={cid}
                        propertyLabel={row.customerName}
                        startDate={appliedDateRange?.startDate}
                        endDate={appliedDateRange?.endDate}
                        excludedCampaigns={groupGoogleCampaignExcludedDraft[cid] || {}}
                        excludedKeywords={groupGoogleCampaignKeywordsDraft[cid] || []}
                        onApplyCampaigns={onApplyGoogleCampaignsForChild}
                        onMenuWillOpen={() => onGoogleCampaignsMenuOpen?.(row._id)}
                        fetchDisabled={fetchDisabled}
                    />
                )}
                {isFacebook && showMetaCampaignCog(row) && (
                    <ParentChildMetaAdsCampaignsActions
                        customerId={cid}
                        propertyLabel={row.customerName}
                        startDate={appliedDateRange?.startDate}
                        endDate={appliedDateRange?.endDate}
                        excludedCampaigns={groupMetaCampaignExcludedDraft[cid] || {}}
                        excludedKeywords={groupMetaCampaignKeywordsDraft[cid] || []}
                        onApplyCampaigns={onApplyMetaCampaignsForChild}
                        onMenuWillOpen={() => onMetaCampaignsMenuOpen?.(row._id)}
                        fetchDisabled={fetchDisabled}
                    />
                )}
            </span>
        );
    };

    const renderMetricCell = (row, columnId) => {
        switch (columnId) {
            case "revenue":
                return (
                    <>
                        {formatDkk(row.revenue)}
                        {shopifyRevenueField === "net_sales" && (
                            <span className="ml-1 text-xs text-gray-400">(net sales)</span>
                        )}
                        {shopifyRevenueField === "gross_sales" && (
                            <span className="ml-1 text-xs text-gray-400">(gross sales)</span>
                        )}
                    </>
                );
            case "orders":
                return row.orders.toLocaleString();
            case "total_adspend":
                return formatDkk(row.adspend);
            case "blended":
                return predominantMetricPreference === "Spendshare"
                    ? formatPercentRatio(row.spendshare)
                    : row.roas != null
                      ? row.roas.toFixed(2)
                      : "-";
            case "aov":
                return row.aov ? formatDkk(row.aov) : "-";
            case "net_profit":
                return row.netProfit != null ? formatDkk(row.netProfit) : "-";
            case "poas":
                return row.poas != null ? row.poas.toFixed(2) : "-";
            case "cac":
                return row.cac != null ? formatDkk(row.cac) : "-";
            case "gross_sales":
                return row.grossSales != null ? formatDkk(row.grossSales) : "-";
            case "returns":
                return row.returns != null ? formatDkk(row.returns) : "-";
            case "discounts":
                return row.discounts != null ? formatDkk(row.discounts) : "-";
            default:
                if (columnId.startsWith("channel_")) {
                    const channelId = columnId.slice("channel_".length);
                    return renderChannelCell(row, channelId);
                }
                return "-";
        }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
            <div className="flex flex-col gap-2 mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <h3 className="text-lg font-semibold">Child Properties</h3>
                    <ParentChildPropertiesColumnPicker
                        visibleAdSpendChannels={visibleAdSpendChannels}
                        selectedIds={visibleColumnIds}
                        onChange={setVisibleColumnIds}
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <ParentGoogleAdsCampaignFilterBar
                        enabled={googleCampaignFilterEnabled}
                        onEnabledChange={onGoogleCampaignFilterEnabledChange}
                        disabled={fetchDisabled}
                    />
                    <ParentMetaAdsCampaignFilterBar
                        enabled={metaCampaignFilterEnabled}
                        onEnabledChange={onMetaCampaignFilterEnabledChange}
                        disabled={fetchDisabled}
                    />
                </div>
            </div>
            {loading ? (
                <div className="flex justify-center items-center min-h-[120px]">
                    <Spinner size={40} />
                </div>
            ) : error ? (
                <div className="text-red-500 text-center">{error}</div>
            ) : (
                <div className="overflow-x-auto">
                    <table
                        className="min-w-full text-xs text-left border-collapse"
                        style={{ fontSize: "13px" }}
                    >
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="px-3 py-1.5 font-semibold text-gray-700">Property Name</th>
                                {orderedColumns.map((col) => (
                                    <th
                                        key={col.id}
                                        className="px-3 py-1.5 font-semibold text-gray-700 whitespace-nowrap"
                                    >
                                        {columnHeaderLabel(col)}
                                    </th>
                                ))}
                                <th className="px-3 py-1.5 font-semibold text-gray-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={colSpan} className="text-center py-8 text-gray-400">
                                        No child properties found.
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row, idx) => (
                                    <tr
                                        key={row._id}
                                        className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                                    >
                                        <td className="px-3 py-2 whitespace-nowrap">{row.customerName}</td>
                                        {orderedColumns.map((col) => (
                                            <td
                                                key={col.id}
                                                className="px-3 py-2 whitespace-nowrap"
                                            >
                                                {renderMetricCell(row, col.id)}
                                            </td>
                                        ))}
                                        <td className="px-3 py-2 align-middle text-right">
                                            <div className="flex flex-wrap gap-2 justify-end items-center">
                                                {(() => {
                                                    const childDoc = childCustomers.find(
                                                        (c) => String(c._id) === String(row._id)
                                                    );
                                                    return isShopifyMarketsCustomer(childDoc) ? (
                                                        <>
                                                            <ParentChildShopifyMarketsActions
                                                                customerId={String(row._id)}
                                                                propertyLabel={row.customerName}
                                                                excludedMarkets={
                                                                    groupMarketExcludedDraft[
                                                                        String(row._id)
                                                                    ] || {}
                                                                }
                                                                onToggleMarket={onToggleMarket}
                                                                onCatalogLoaded={onCatalogLoaded}
                                                                filterAdSpendByMarket={
                                                                    groupMarketFilterAdSpendDraft[
                                                                        String(row._id)
                                                                    ] === true
                                                                }
                                                                onFilterAdSpendByMarketChange={(
                                                                    enabled
                                                                ) =>
                                                                    onFilterAdSpendByMarketChange?.(
                                                                        row._id,
                                                                        enabled
                                                                    )
                                                                }
                                                                onApplyMarkets={() =>
                                                                    onApplyMarketsForChild(row._id)
                                                                }
                                                                onMenuWillOpen={() =>
                                                                    onMarketsMenuOpen(row._id)
                                                                }
                                                                fetchDisabled={fetchDisabled}
                                                            />
                                                            <ParentChildAdSpendPlatformsActions
                                                                customerId={String(row._id)}
                                                                propertyLabel={row.customerName}
                                                                platforms={adSpendChannelsForShopifyMarketsFilterUi(
                                                                    childDoc?.CustomerSettings || {}
                                                                ).map((c) => ({
                                                                    id: c.id,
                                                                    label: c.label,
                                                                }))}
                                                                excludedPlatforms={
                                                                    groupSpendExcludedDraft[
                                                                        String(row._id)
                                                                    ] || {}
                                                                }
                                                                onTogglePlatform={onToggleSpendPlatform}
                                                                onApplySpend={() =>
                                                                    onApplySpendForChild(row._id)
                                                                }
                                                                onMenuWillOpen={() =>
                                                                    onSpendMenuOpen(row._id)
                                                                }
                                                                fetchDisabled={fetchDisabled}
                                                            />
                                                        </>
                                                    ) : null;
                                                })()}
                                                <Link
                                                    href={`/dashboard/${row._id}/performance-dashboard`}
                                                >
                                                    <FormButton buttonSize="small" borderType="outline">
                                                        View Dashboard
                                                    </FormButton>
                                                </Link>
                                                <Link href={`/dashboard/${row._id}/config`}>
                                                    <FormButton buttonSize="small" borderType="outline">
                                                        Config
                                                    </FormButton>
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
