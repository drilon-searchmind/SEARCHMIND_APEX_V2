import { NextResponse } from "next/server";
import { getSearchConsoleClient } from "@/lib/searchConsoleClient";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { fetchSeoDashboardSupplemental } from "@/lib/seoDashboardBundle";
import { buildSeoInsightsBundle } from "@/lib/seoInsightsBundle";
import dbConnect from "@root/lib/mongodb";
import SEOBrandKeyword from "@/models/SEOBrandKeyword";

async function gscQuery(searchconsole, siteUrl, body) {
    const { data } = await searchconsole.searchanalytics.query({ siteUrl, requestBody: body });
    return data?.rows || [];
}

async function loadBrandTerms(customerId) {
    if (!customerId) return [];
    try {
        await dbConnect();
        const doc = await SEOBrandKeyword.findOne({ customer: customerId }).lean();
        return Array.isArray(doc?.keywords) ? doc.keywords : [];
    } catch {
        return [];
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        const {
            siteUrl,
            startDate,
            endDate,
            customerId,
            compareStartDate,
            compareEndDate,
        } = body;

        if (!startDate || !endDate) {
            return NextResponse.json({ error: "Missing startDate or endDate" }, { status: 400 });
        }

        const brandTerms = await loadBrandTerms(customerId);
        const hasCompare = compareStartDate && compareEndDate;

        if (customerId && isDemoCustomerId(customerId)) {
            const data = await buildSeoInsightsBundle({
                customerId,
                siteUrl,
                startDate,
                endDate,
                brandTerms,
            });
            return NextResponse.json(data);
        }

        if (!siteUrl) {
            return NextResponse.json({ error: "Missing siteUrl" }, { status: 400 });
        }

        const searchconsole = await getSearchConsoleClient();

        const [
            gscKeywords,
            gscPages,
            gscQueryPage,
            gscDateQuery,
            gscKeywordsPrev,
            gscPagesPrev,
        ] = await Promise.all([
            gscQuery(searchconsole, siteUrl, {
                startDate,
                endDate,
                dimensions: ["query"],
                rowLimit: 500,
                orderBy: [{ field: "clicks", desc: true }],
            }),
            gscQuery(searchconsole, siteUrl, {
                startDate,
                endDate,
                dimensions: ["page"],
                rowLimit: 100,
                orderBy: [{ field: "clicks", desc: true }],
            }),
            gscQuery(searchconsole, siteUrl, {
                startDate,
                endDate,
                dimensions: ["query", "page"],
                rowLimit: 5000,
            }),
            gscQuery(searchconsole, siteUrl, {
                startDate,
                endDate,
                dimensions: ["date", "query"],
                rowLimit: 25000,
            }),
            hasCompare
                ? gscQuery(searchconsole, siteUrl, {
                      startDate: compareStartDate,
                      endDate: compareEndDate,
                      dimensions: ["query"],
                      rowLimit: 500,
                  })
                : Promise.resolve([]),
            hasCompare
                ? gscQuery(searchconsole, siteUrl, {
                      startDate: compareStartDate,
                      endDate: compareEndDate,
                      dimensions: ["page"],
                      rowLimit: 100,
                  })
                : Promise.resolve([]),
        ]);

        const gscClicks = gscKeywords.reduce((s, r) => s + (r.clicks || 0), 0);
        const supplemental = await fetchSeoDashboardSupplemental({
            customerId,
            siteUrl,
            startDate,
            endDate,
            gscClicks,
        });

        const data = await buildSeoInsightsBundle({
            customerId,
            siteUrl,
            startDate,
            endDate,
            compareStartDate,
            compareEndDate,
            gscKeywords,
            gscKeywordsPrev,
            gscPages,
            gscPagesPrev,
            gscQueryPage,
            gscDateQuery,
            supplemental,
            brandTerms,
        });

        return NextResponse.json(data);
    } catch (error) {
        const message = error?.message || "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
