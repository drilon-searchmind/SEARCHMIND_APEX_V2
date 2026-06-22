import React from "react";
import PropertyObjectivesTable from "./PropertyObjectivesTable";
import MarketPropertyObjectivesEditor from "./MarketPropertyObjectivesEditor";
import {
    PROPERTY_OBJECTIVES_MODE_GLOBAL,
    PROPERTY_OBJECTIVES_MODE_PER_MARKET,
} from "@/lib/propertyObjectivesUtils";

const PropertyObjectivesModeSelector = ({ mode, onModeChange, disabled = false }) => (
    <div className="flex flex-col gap-2">
        <p className="apex-config-card__title">Objectives scope</p>
        <div className="apex-config-tab-group">
            <button
                type="button"
                disabled={disabled}
                className={`apex-config-tab${mode === PROPERTY_OBJECTIVES_MODE_GLOBAL ? " is-active" : ""}`}
                onClick={() => onModeChange(PROPERTY_OBJECTIVES_MODE_GLOBAL)}
            >
                Global
            </button>
            <button
                type="button"
                disabled={disabled}
                className={`apex-config-tab${mode === PROPERTY_OBJECTIVES_MODE_PER_MARKET ? " is-active" : ""}`}
                onClick={() => onModeChange(PROPERTY_OBJECTIVES_MODE_PER_MARKET)}
            >
                Per market
            </button>
        </div>
        <p className="apex-config-field-hint">
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
        <div className="apex-config-form">
            {showTitle ? (
                <h2 className="apex-config-form__title">Property Objectives</h2>
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
