import React from "react";
import PropertyObjectivesTable from "./PropertyObjectivesTable";
import MarketPropertyObjectivesEditor from "./MarketPropertyObjectivesEditor";
import {
    PROPERTY_OBJECTIVES_MODE_GLOBAL,
    PROPERTY_OBJECTIVES_MODE_PER_MARKET,
} from "@/lib/propertyObjectivesUtils";

const PropertyObjectivesModeSelector = ({ mode, onModeChange, disabled = false }) => (
    <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-gray-700">Objectives scope</p>
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 w-full sm:w-auto">
            <button
                type="button"
                disabled={disabled}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    mode === PROPERTY_OBJECTIVES_MODE_GLOBAL
                        ? "bg-white text-[var(--color-primary-searchmind)] shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                }`}
                onClick={() => onModeChange(PROPERTY_OBJECTIVES_MODE_GLOBAL)}
            >
                Global
            </button>
            <button
                type="button"
                disabled={disabled}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    mode === PROPERTY_OBJECTIVES_MODE_PER_MARKET
                        ? "bg-white text-[var(--color-primary-searchmind)] shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                }`}
                onClick={() => onModeChange(PROPERTY_OBJECTIVES_MODE_PER_MARKET)}
            >
                Per market
            </button>
        </div>
        <p className="text-xs text-gray-500">
            {mode === PROPERTY_OBJECTIVES_MODE_GLOBAL
                ? "One revenue target and marketing budget applies to all markets. Market filters still filter performance data, not these objectives."
                : "Set revenue targets and marketing budgets for each market. Totals sum objectives for enabled markets in dashboard filters."}
        </p>
    </div>
);

const PropertyObjectives = ({
    customerId,
    customerType,
    shopifyMarketsEnabled,
    propertyObjectivesMode,
    onPropertyObjectivesModeChange,
    objectives,
    marketObjectives,
    onObjectivesChange,
    onMarketObjectivesChange,
    showTitle = true,
}) => {
    const isMarketsCustomer =
        customerType === "Shopify" && shopifyMarketsEnabled === true;
    const usePerMarket =
        isMarketsCustomer && propertyObjectivesMode === PROPERTY_OBJECTIVES_MODE_PER_MARKET;

    return (
        <div className="flex flex-col gap-4">
            {showTitle ? (
                <h5 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-2">
                    Property Objectives
                </h5>
            ) : null}
            {isMarketsCustomer ? (
                <>
                    <PropertyObjectivesModeSelector
                        mode={propertyObjectivesMode}
                        onModeChange={onPropertyObjectivesModeChange}
                    />
                    {usePerMarket ? (
                        <MarketPropertyObjectivesEditor
                            customerId={customerId}
                            marketObjectives={marketObjectives}
                            onMarketObjectivesChange={onMarketObjectivesChange}
                        />
                    ) : (
                        <PropertyObjectivesTable
                            objectives={objectives}
                            onObjectivesChange={onObjectivesChange}
                        />
                    )}
                </>
            ) : (
                <PropertyObjectivesTable
                    objectives={objectives}
                    onObjectivesChange={onObjectivesChange}
                />
            )}
        </div>
    );
};

export default PropertyObjectives;
