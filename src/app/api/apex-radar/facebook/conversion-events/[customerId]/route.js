import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import Customer from "@/models/Customer";
import ApexRadarChannelSettings from "@/models/ApexRadarChannelSettings";
import { APEX_RADAR_CHANNEL_FACEBOOK } from "@/lib/apexRadarChannels";
import { mergeFacebookChannelSettingsIntoCustomers } from "@/lib/apexRadarChannelSettingsMerge";
import { getFacebookApexRadarSettings } from "@/lib/apexRadarCustomerSettings";
import { addDaysIso } from "@/lib/apexRadarFacebookOverview";
import {
    DEFAULT_FB_PURCHASE_ACTION_TYPES,
    formatActionTypeLabel,
    mergeConversionEventOptions,
} from "@/lib/apexRadarFacebookConversionEvents";
import {
    aggregatePixelEventCounts,
    customerMetaConfigUrl,
    fetchAdAccountPixels,
    fetchFacebookPixelStats,
    isFacebookPermissionDeniedError,
    normalizeFacebookPixelId,
    pixelCountsToEventOptions,
    resolveFacebookPixelId,
} from "@/lib/apexRadarFacebookPixelStats";
import { isDemoCustomerId } from "@/lib/demoCustomer";

const LOOKBACK_DAYS = 90;

function demoPixelEvents() {
    return [
        { actionType: "Contact", count: 184, label: "Contact" },
        { actionType: "Subscribe", count: 303, label: "Subscribe" },
        { actionType: "AddToCart", count: 288, label: "Add to cart" },
        { actionType: "ViewContent", count: 45900, label: "View Content" },
        { actionType: "PageView", count: 255500, label: "Page View" },
        { actionType: "FindLocation", count: 22, label: "Find Location" },
    ];
}

/**
 * GET /api/apex-radar/facebook/conversion-events/[customerId]
 * Lists Meta Pixel events (last 90 days) from pixel stats only — same source as Events Manager.
 */
export async function GET(_request, { params }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolved = await params;
    const customerId = resolved.customerId;
    if (!customerId) {
        return NextResponse.json({ error: "Missing customer id" }, { status: 400 });
    }

    const token = process.env.FACEBOOK_APP_TOKEN;
    if (!token) {
        return NextResponse.json({ error: "Facebook token not configured" }, { status: 503 });
    }

    const configUrl = customerMetaConfigUrl(customerId);

    try {
        await connectToDatabase();
        const customerDoc = await Customer.findById(customerId).lean();
        if (!customerDoc) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }

        let customer = { ...customerDoc, _id: customerDoc._id };
        const channelSettingsDocs = await ApexRadarChannelSettings.find({
            channel: APEX_RADAR_CHANNEL_FACEBOOK,
            customerId: customer._id,
        }).lean();
        [customer] = mergeFacebookChannelSettingsIntoCustomers([customer], channelSettingsDocs);
        const apex = getFacebookApexRadarSettings(customer);

        if (isDemoCustomerId(customerId)) {
            const events = mergeConversionEventOptions(demoPixelEvents(), apex.trackingConversionActionTypes);
            return NextResponse.json({
                customerId: String(customerId),
                lookbackDays: LOOKBACK_DAYS,
                savedActionTypes: apex.trackingConversionActionTypes,
                events,
                configUrl,
            });
        }

        const settings = customer.CustomerSettings || {};
        const adAccountId = (settings.facebookAdAccountId || "").trim();
        if (!adAccountId) {
            return NextResponse.json({
                customerId: String(customerId),
                lookbackDays: LOOKBACK_DAYS,
                missingAdAccount: true,
                configUrl,
                savedActionTypes: apex.trackingConversionActionTypes,
                events: [],
            });
        }

        const until = addDaysIso(new Date().toISOString().slice(0, 10), -1);
        const since = addDaysIso(until, -(LOOKBACK_DAYS - 1));

        let availablePixels = [];
        try {
            availablePixels = await fetchAdAccountPixels(token, adAccountId);
        } catch (e) {
            console.warn("[conversion-events] adspixels:", e.message);
        }

        const configuredPixelId = normalizeFacebookPixelId(settings.facebookPixelId);
        const pixelId = resolveFacebookPixelId(configuredPixelId, availablePixels);
        const pixelMeta = availablePixels.find((p) => normalizeFacebookPixelId(p.id) === pixelId);

        if (!pixelId) {
            return NextResponse.json({
                customerId: String(customerId),
                lookbackDays: LOOKBACK_DAYS,
                missingPixel: true,
                configUrl,
                savedActionTypes: apex.trackingConversionActionTypes,
                events: mergeConversionEventOptions([], apex.trackingConversionActionTypes),
                availablePixels: availablePixels.map((p) => ({
                    id: String(p.id),
                    name: p.name || "",
                    lastFiredTime: p.last_fired_time || null,
                })),
            });
        }

        try {
            const stats = await fetchFacebookPixelStats(token, pixelId, {
                aggregation: "event_total_counts",
                startIso: since,
                endIso: until,
            });
            const counts = aggregatePixelEventCounts(stats);
            const activeEvents = pixelCountsToEventOptions(counts, formatActionTypeLabel);
            const events = mergeConversionEventOptions(activeEvents, apex.trackingConversionActionTypes);

            return NextResponse.json({
                customerId: String(customerId),
                lookbackDays: LOOKBACK_DAYS,
                pixelId,
                pixelName: pixelMeta?.name || null,
                dateRange: { since, until },
                savedActionTypes: apex.trackingConversionActionTypes,
                events,
                configUrl,
                availablePixels: availablePixels.map((p) => ({
                    id: String(p.id),
                    name: p.name || "",
                    lastFiredTime: p.last_fired_time || null,
                })),
            });
        } catch (e) {
            if (isFacebookPermissionDeniedError(e)) {
                return NextResponse.json({
                    customerId: String(customerId),
                    lookbackDays: LOOKBACK_DAYS,
                    pixelId,
                    pixelName: pixelMeta?.name || null,
                    pixelStatsPermissionDenied: true,
                    configUrl,
                    savedActionTypes: apex.trackingConversionActionTypes,
                    events: mergeConversionEventOptions([], apex.trackingConversionActionTypes),
                    availablePixels: availablePixels.map((p) => ({
                        id: String(p.id),
                        name: p.name || "",
                        lastFiredTime: p.last_fired_time || null,
                    })),
                    hint:
                        "Could not read pixel event stats for this dataset. Grant the Apex Facebook token access to this pixel in Business Manager, or set the correct pixel ID under Meta in customer config.",
                });
            }
            throw e;
        }
    } catch (e) {
        console.error("[apex-radar/facebook/conversion-events GET]", e);
        return NextResponse.json({ error: e.message || "Failed to load conversion events" }, { status: 500 });
    }
}
