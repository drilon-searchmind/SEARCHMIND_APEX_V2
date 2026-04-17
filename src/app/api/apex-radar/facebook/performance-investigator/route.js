import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getCustomerById } from "@root/lib/customerOperations";
import { isDemoCustomerId, mergeDemoCustomerDocument } from "@/lib/demoCustomer";
import {
    buildPiFunnelFromAggregates,
    buildPiMonthRowsForYear,
    fetchFacebookPiMonthlyByMonthKey,
    fetchFacebookPiRangeAggregate,
    priorPeriodRange,
} from "@/lib/apexRadarPerformanceInvestigatorFacebook";
import {
    PI_MONTH_LABELS,
    computePiYearOverYearDiff,
    getDemoFacebookPerformanceInvestigatorPayload,
} from "@/app/(protected)/apex-radar/lib/mockPerformanceInvestigatorData";

function toPlainCustomer(doc) {
    if (doc && typeof doc.toObject === "function") return doc.toObject();
    return { ...doc };
}

function emptyPiPayload(currentYear, previousYear, now, funnelStart, funnelEnd) {
    const emptyMap = new Map();
    const currentYearRows = buildPiMonthRowsForYear(currentYear, PI_MONTH_LABELS, emptyMap, now);
    const previousYearRows = buildPiMonthRowsForYear(previousYear, PI_MONTH_LABELS, emptyMap, now);
    const { prevStart, prevEnd } = priorPeriodRange(funnelStart, funnelEnd);
    const z = {
        impr: 0,
        clicks: 0,
        cost: 0,
        conv: 0,
        convValue: 0,
        ctr: 0,
        convRate: 0,
        avgCpc: 0,
        freq: 0,
        aov: 0,
    };
    return {
        currentYear,
        previousYear,
        currentYearRows,
        previousYearRows,
        diffRows: computePiYearOverYearDiff(currentYearRows, previousYearRows),
        funnel: buildPiFunnelFromAggregates(z, z),
        funnelRange: {
            startDate: funnelStart,
            endDate: funnelEnd,
            compareStart: prevStart,
            compareEnd: prevEnd,
        },
        source: "empty",
    };
}

/**
 * GET /api/apex-radar/facebook/performance-investigator?customerId=&currentYear=&funnelStartDate=&funnelEndDate=
 */
export async function GET(req) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    const funnelStart = searchParams.get("funnelStartDate");
    const funnelEnd = searchParams.get("funnelEndDate");
    const currentYear = parseInt(searchParams.get("currentYear") || String(new Date().getUTCFullYear()), 10);
    const previousYear = currentYear - 1;

    if (!customerId) {
        return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }
    if (!funnelStart || !funnelEnd) {
        return NextResponse.json(
            { error: "funnelStartDate and funnelEndDate are required (YYYY-MM-DD)" },
            { status: 400 }
        );
    }
    if (funnelEnd < funnelStart) {
        return NextResponse.json({ error: "funnelEndDate must be on or after funnelStartDate" }, { status: 400 });
    }

    const now = new Date();

    if (isDemoCustomerId(customerId)) {
        const demo = getDemoFacebookPerformanceInvestigatorPayload(currentYear, previousYear);
        const { prevStart, prevEnd } = priorPeriodRange(funnelStart, funnelEnd);
        return NextResponse.json({
            ...demo,
            funnelRange: {
                startDate: funnelStart,
                endDate: funnelEnd,
                compareStart: prevStart,
                compareEnd: prevEnd,
            },
        });
    }

    const token = process.env.FACEBOOK_APP_TOKEN;
    if (!token) {
        return NextResponse.json({ error: "Facebook token not configured" }, { status: 503 });
    }

    try {
        let customer = await getCustomerById(customerId);
        customer = toPlainCustomer(customer);
        if (isDemoCustomerId(String(customer._id))) {
            customer = mergeDemoCustomerDocument(customer);
        }

        const settings = customer.CustomerSettings || {};
        const adId = (settings.facebookAdAccountId || "").trim();
        const metaInclude = settings.customerMetaID || "";
        const metaExclude = settings.customerMetaIDExclude || "";

        if (!adId) {
            return NextResponse.json(emptyPiPayload(currentYear, previousYear, now, funnelStart, funnelEnd));
        }

        const since = `${previousYear}-01-01`;
        const until = `${currentYear}-12-31`;

        const byMonth = await fetchFacebookPiMonthlyByMonthKey({
            accessToken: token,
            adAccountId: adId,
            since,
            until,
            metaIdInclude: metaInclude,
            metaIdExclude: metaExclude,
        });

        const currentYearRows = buildPiMonthRowsForYear(currentYear, PI_MONTH_LABELS, byMonth, now);
        const previousYearRows = buildPiMonthRowsForYear(previousYear, PI_MONTH_LABELS, byMonth, now);
        const diffRows = computePiYearOverYearDiff(currentYearRows, previousYearRows);

        const { prevStart, prevEnd } = priorPeriodRange(funnelStart, funnelEnd);
        const [curAgg, prevAgg] = await Promise.all([
            fetchFacebookPiRangeAggregate({
                accessToken: token,
                adAccountId: adId,
                since: funnelStart,
                until: funnelEnd,
                metaIdInclude: metaInclude,
                metaIdExclude: metaExclude,
            }),
            fetchFacebookPiRangeAggregate({
                accessToken: token,
                adAccountId: adId,
                since: prevStart,
                until: prevEnd,
                metaIdInclude: metaInclude,
                metaIdExclude: metaExclude,
            }),
        ]);

        const funnel = buildPiFunnelFromAggregates(curAgg, prevAgg);

        return NextResponse.json({
            currentYear,
            previousYear,
            currentYearRows,
            previousYearRows,
            diffRows,
            funnel,
            funnelRange: { startDate: funnelStart, endDate: funnelEnd, compareStart: prevStart, compareEnd: prevEnd },
            source: "facebook",
        });
    } catch (e) {
        console.error("[apex-radar/facebook/performance-investigator]", e);
        return NextResponse.json({ error: e.message || "Failed to load performance investigator" }, { status: 500 });
    }
}
