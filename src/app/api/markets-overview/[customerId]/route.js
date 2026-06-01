import { NextResponse } from "next/server";
import { getCustomerById } from "../../../../../lib/customerOperations";
import { parseAdSpendExcludeQueryParam } from "@/lib/adSpendExcludeParam";
import {
    fetchMarketsOverviewRows,
    loadShopifyMarketsForOverview,
    visibleMarketingColumnKeysForMarkets,
} from "@/lib/marketsOverviewApi";
import { adSpendChannelsForShopifyMarketsFilterUi } from "@/lib/mergeAdSpendDaily";

export async function GET(request, { params }) {
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const excludeAdSpendPlatforms = parseAdSpendExcludeQueryParam(
        searchParams.get("adSpendExclude")
    );
    if (!startDate || !endDate) {
        return NextResponse.json(
            { error: "Missing startDate or endDate" },
            { status: 400 }
        );
    }

    try {
        const doc = await getCustomerById(customerId);
        if (!doc) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }
        const data = doc?.toObject ? doc.toObject() : doc;
        const cs = data.CustomerSettings || {};

        if (data.customerType !== "Shopify" || cs.shopifyMarketsEnabled !== true) {
            return NextResponse.json({
                featureDisabled: true,
                rows: [],
                storeTotalRow: null,
                visibleMarketingColumnKeys: [],
            });
        }

        const shop = cs.shopifyUrl;
        const token = cs.shopifyApiPassword;
        if (!shop || !token) {
            return NextResponse.json(
                { error: "Shopify URL and API access token are required." },
                { status: 400 }
            );
        }

        const markets = await loadShopifyMarketsForOverview(shop, token);
        const settings = {
            customerName: data.customerName,
            customerType: data.customerType || "Shopify",
            ...cs,
            CustomerStaticExpenses: data.CustomerStaticExpenses || {},
            CustomerSettings: cs,
        };

        const { rows, storeTotalRow } = await fetchMarketsOverviewRows(
            settings,
            startDate,
            endDate,
            markets,
            { excludeAdSpendPlatforms }
        );

        const spendCols = adSpendChannelsForShopifyMarketsFilterUi(cs)
            .filter((c) => !excludeAdSpendPlatforms.includes(c.id))
            .map((c) => c.dailyOverviewColumnKey);

        return NextResponse.json({
            rows,
            storeTotalRow,
            marketsCount: markets.length,
            visibleMarketingColumnKeys:
                spendCols.length > 0
                    ? spendCols
                    : visibleMarketingColumnKeysForMarkets(cs, excludeAdSpendPlatforms),
        });
    } catch (e) {
        console.error("[markets-overview] GET:", e);
        return NextResponse.json(
            { error: e.message || "Failed to load markets overview" },
            { status: 500 }
        );
    }
}
