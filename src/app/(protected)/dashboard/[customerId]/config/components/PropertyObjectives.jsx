import React from "react";
import PropertyObjectivesTable from "./PropertyObjectivesTable";
import MarketPropertyObjectivesEditor from "./MarketPropertyObjectivesEditor";
import { isShopifyMarketsCustomer } from "@/lib/customerPlatformDisplay";

const PropertyObjectives = ({
    customerId,
    customerType,
    shopifyMarketsEnabled,
    objectives,
    marketObjectives,
    onObjectivesChange,
    onMarketObjectivesChange,
}) => {
    const isMarketsCustomer =
        customerType === "Shopify" && shopifyMarketsEnabled === true;

    return (
        <div className="flex flex-col gap-4">
            <h5 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-2">
                Property Objectives
            </h5>
            {isMarketsCustomer ? (
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
        </div>
    );
};

export default PropertyObjectives;
