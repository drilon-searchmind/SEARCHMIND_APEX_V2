"use client";

import React from "react";
import Link from "next/link";
import FormButton from "@/components/form/FormButton";
import Spinner from "@/components/ui/Spinner";
import { isShopifyMarketsCustomer } from "@/lib/customerPlatformDisplay";
import { adSpendChannelsForShopifyMarketsFilterUi } from "@/lib/mergeAdSpendDaily";
import ParentChildShopifyMarketsActions from "./ParentChildShopifyMarketsActions";
import ParentChildAdSpendPlatformsActions from "./ParentChildAdSpendPlatformsActions";

function formatDkk(n) {
    return (n ?? 0).toLocaleString("da-DK", { style: "currency", currency: "DKK" });
}

/**
 * Child property breakdown table with Markets / Spend filters per Shopify Markets row.
 */
export default function ParentChildPropertiesTable({
    loading,
    error,
    rows = [],
    childCustomers = [],
    visibleAdSpendChannels = [],
    shopifyRevenueField = "net_sales",
    predominantMetricPreference = "ROAS/POAS",
    groupMarketExcludedDraft = {},
    groupSpendExcludedDraft = {},
    onToggleMarket,
    onCatalogLoaded,
    onApplyMarketsForChild,
    onMarketsMenuOpen,
    onToggleSpendPlatform,
    onApplySpendForChild,
    onSpendMenuOpen,
    fetchDisabled = false,
}) {
    const channelColLabel = (ch) => {
        if (ch.id === "facebook") return "Meta Adspend";
        if (ch.id === "google") return "Google Adspend";
        return `${ch.label} Adspend`;
    };

    const getRowChannelSpend = (row, channelId) =>
        row.channelAdspend?.[channelId] ??
        row[`${channelId}Adspend`] ??
        (channelId === "facebook" ? row.facebookAdspend : undefined) ??
        (channelId === "google" ? row.googleAdspend : undefined) ??
        0;

    const channelColCount =
        visibleAdSpendChannels.length > 0 ? visibleAdSpendChannels.length : 2;
    const colSpan = 7 + channelColCount;

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Child Properties</h3>
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
                                <th className="px-3 py-1.5 font-semibold text-gray-700">Revenue</th>
                                <th className="px-3 py-1.5 font-semibold text-gray-700">Orders</th>
                                <th className="px-3 py-1.5 font-semibold text-gray-700">Total Adspend</th>
                                {visibleAdSpendChannels.length > 0
                                    ? visibleAdSpendChannels.map((ch) => (
                                          <th
                                              key={ch.id}
                                              className="px-3 py-1.5 font-semibold text-gray-700"
                                          >
                                              {channelColLabel(ch)}
                                          </th>
                                      ))
                                    : (
                                        <>
                                            <th className="px-3 py-1.5 font-semibold text-gray-700">
                                                Facebook Adspend
                                            </th>
                                            <th className="px-3 py-1.5 font-semibold text-gray-700">
                                                Google Adspend
                                            </th>
                                        </>
                                    )}
                                <th className="px-3 py-1.5 font-semibold text-gray-700">
                                    {predominantMetricPreference === "Spendshare"
                                        ? "Spendshare"
                                        : "ROAS"}
                                </th>
                                <th className="px-3 py-1.5 font-semibold text-gray-700">AOV</th>
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
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {formatDkk(row.revenue)}
                                            {shopifyRevenueField === "net_sales" && (
                                                <span className="ml-1 text-xs text-gray-400">(net sales)</span>
                                            )}
                                            {shopifyRevenueField === "gross_sales" && (
                                                <span className="ml-1 text-xs text-gray-400">(gross sales)</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {row.orders.toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {formatDkk(row.adspend)}
                                        </td>
                                        {visibleAdSpendChannels.length > 0
                                            ? visibleAdSpendChannels.map((ch) => (
                                                  <td
                                                      key={ch.id}
                                                      className="px-3 py-2 whitespace-nowrap"
                                                  >
                                                      {formatDkk(getRowChannelSpend(row, ch.id))}
                                                  </td>
                                              ))
                                            : (
                                                <>
                                                    <td className="px-3 py-2 whitespace-nowrap">
                                                        {formatDkk(row.facebookAdspend)}
                                                    </td>
                                                    <td className="px-3 py-2 whitespace-nowrap">
                                                        {formatDkk(row.googleAdspend)}
                                                    </td>
                                                </>
                                            )}
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {predominantMetricPreference === "Spendshare"
                                                ? row.spendshare !== null
                                                    ? `${(row.spendshare * 100).toFixed(2)}%`
                                                    : "-"
                                                : row.roas !== null
                                                  ? row.roas.toFixed(2)
                                                  : "-"}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {row.aov ? formatDkk(row.aov) : "-"}
                                        </td>
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
