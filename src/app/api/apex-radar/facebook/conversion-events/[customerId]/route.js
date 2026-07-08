import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import Customer from "@/models/Customer";
import ApexRadarChannelSettings from "@/models/ApexRadarChannelSettings";
import { APEX_RADAR_CHANNEL_FACEBOOK } from "@/lib/apexRadarChannels";
import { mergeFacebookChannelSettingsIntoCustomers } from "@/lib/apexRadarChannelSettingsMerge";
import { getFacebookApexRadarSettings } from "@/lib/apexRadarCustomerSettings";
import { parseMetaIdFilter } from "@/lib/facebookApi";
import {
    addDaysIso,
    buildAccountInsightsRelativeUrl,
    fetchAccountInsightsDailyPaginated,
    normalizeDailyInsightRows,
} from "@/lib/apexRadarFacebookOverview";
import {
    aggregateConversionRelevantAccountEvents,
    mergeConversionEventOptions,
} from "@/lib/apexRadarFacebookConversionEvents";
import { customerMetaConfigUrl, fetchAdAccountPixels } from "@/lib/apexRadarFacebookPixelStats";
import { isDemoCustomerId } from "@/lib/demoCustomer";

const LOOKBACK_DAYS = 90;

function demoAccountEvents() {
    return [
        { actionType: "offsite_conversion.fb_pixel_contact", count: 184, label: "Pixel contact", source: "ad_account" },
        { actionType: "offsite_conversion.fb_pixel_subscribe", count: 303, label: "Pixel subscribe", source: "ad_account" },
        { actionType: "offsite_conversion.fb_pixel_add_to_cart", count: 288, label: "Pixel add to cart", source: "ad_account" },
        { actionType: "offsite_conversion.fb_pixel_view_content", count: 6544, label: "Pixel view content", source: "ad_account" },
        { actionType: "offsite_conversion.fb_pixel_custom", count: 276, label: "Pixel custom", source: "ad_account" },
    ];
}

/**
 * GET /api/apex-radar/facebook/conversion-events/[customerId]
 * Lists ad-attributed conversion events from ad account insights (last 90 days).
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
            const events = mergeConversionEventOptions(demoAccountEvents(), apex.trackingConversionActionTypes);
            return NextResponse.json({
                customerId: String(customerId),
                lookbackDays: LOOKBACK_DAYS,
                eventSource: "ad_account_insights",
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
                eventSource: "ad_account_insights",
                missingAdAccount: true,
                configUrl,
                savedActionTypes: apex.trackingConversionActionTypes,
                events: [],
            });
        }

        const until = addDaysIso(new Date().toISOString().slice(0, 10), -1);
        const since = addDaysIso(until, -(LOOKBACK_DAYS - 1));
        const metaInclude = settings.customerMetaID || "";
        const metaExclude = settings.customerMetaIDExclude || "";

        let availablePixels = [];
        try {
            availablePixels = await fetchAdAccountPixels(token, adAccountId);
        } catch (e) {
            console.warn("[conversion-events] adspixels:", e.message);
        }

        const relativeUrl = buildAccountInsightsRelativeUrl(
            adAccountId,
            since,
            until,
            metaInclude,
            metaExclude
        );
        const rawRows = await fetchAccountInsightsDailyPaginated(token, relativeUrl);
        const { effectiveInclude, exclude } = parseMetaIdFilter(metaInclude, metaExclude);
        const useBreakdown = exclude.length > 0 && effectiveInclude.length === 0;
        const dailyRows = normalizeDailyInsightRows(rawRows, { useBreakdown, exclude });

        const activeEvents = aggregateConversionRelevantAccountEvents(dailyRows);
        const events = mergeConversionEventOptions(activeEvents, apex.trackingConversionActionTypes);

        return NextResponse.json({
            customerId: String(customerId),
            lookbackDays: LOOKBACK_DAYS,
            eventSource: "ad_account_insights",
            adAccountId: adAccountId.replace(/^act_/, ""),
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
        console.error("[apex-radar/facebook/conversion-events GET]", e);
        return NextResponse.json({ error: e.message || "Failed to load conversion events" }, { status: 500 });
    }
}
