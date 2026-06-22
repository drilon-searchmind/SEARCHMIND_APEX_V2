import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import Customer from "@/models/Customer";
import { fetchShopifyMarketsCatalog } from "@/lib/shopifyMarketsApi";
import { getDemoPayload, getDemoShopifyMarkets, isDemoCustomerId, mergeDemoCustomerDocument } from "@/lib/demoCustomer";

/**
 * Lists Shopify Markets for customers with `CustomerSettings.shopifyMarketsEnabled` and Shopify credentials.
 * Requires Admin API scopes including `read_markets`.
 */
export async function GET(_request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const resolved = await params;
        const customerId = resolved.customerId;
        await connectToDatabase();

        const customer = await Customer.findById(customerId).lean();
        if (!customer) {
            if (isDemoCustomerId(customerId)) {
                const demo = getDemoPayload("customer");
                if (!demo) {
                    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
                }
                const merged = { ...demo, _id: customerId };
                const cs = merged.CustomerSettings || {};
                if (!cs.shopifyMarketsEnabled) {
                    return NextResponse.json({ markets: [], featureDisabled: true });
                }
                return NextResponse.json({
                    markets: getDemoShopifyMarkets().map((m) => ({
                        shopifyqlMarketId: m.shopifyqlMarketId,
                        name: m.name,
                        handle: m.handle,
                    })),
                });
            }
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }

        const merged = isDemoCustomerId(customerId)
            ? mergeDemoCustomerDocument(customer)
            : customer;
        const cs = merged.CustomerSettings || {};
        if (!cs.shopifyMarketsEnabled) {
            return NextResponse.json({ markets: [], featureDisabled: true });
        }

        if (merged.customerType !== "Shopify") {
            return NextResponse.json(
                { markets: [], error: "Shopify Markets is only available for Shopify stores." },
                { status: 400 }
            );
        }

        if (isDemoCustomerId(customerId)) {
            return NextResponse.json({
                markets: getDemoShopifyMarkets().map((m) => ({
                    shopifyqlMarketId: m.shopifyqlMarketId,
                    name: m.name,
                    handle: m.handle,
                })),
            });
        }

        const shop = (cs.shopifyUrl || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
        const token = cs.shopifyApiPassword || "";
        if (!shop || !token) {
            return NextResponse.json(
                { markets: [], error: "Shopify URL and API access token are required." },
                { status: 400 }
            );
        }

        const { markets, graphqlErrors } = await fetchShopifyMarketsCatalog(shop, token);
        return NextResponse.json({
            markets: markets.map((m) => ({
                shopifyqlMarketId: m.shopifyqlMarketId,
                name: m.name,
            })),
            graphqlErrors: graphqlErrors || undefined,
        });
    } catch (e) {
        console.error("[shopify-markets] GET:", e);
        return NextResponse.json(
            { error: e.message || "Failed to load Shopify Markets" },
            { status: 500 }
        );
    }
}
