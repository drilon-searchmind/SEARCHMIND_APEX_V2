import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import { getCustomerById } from "@root/lib/customerOperations";
import CustomerChannelAudit from "@/models/CustomerChannelAudit";
import { normalizeAuditReport } from "@/lib/channelAuditReport";
import { auditGroupIdFromCardId } from "@/lib/audit/auditPromptCatalog";
import {
    assembleAuditReport,
    buildFallbackAuditReport,
    runAuditAnalyses,
} from "@/lib/audit/auditReportBuilder";
import { buildAuditContext } from "@/lib/audit/auditContextBuilder";
import { getAuditAiAccessMode, isAuditAiConfigured } from "@/lib/audit/auditAnthropic";
import { rejectClientAuditAiOverrides } from "@/lib/audit/auditAiReadOnlyPolicy";

/**
 * @param {unknown[]} selections
 */
function normalizeSelections(selections) {
    if (!Array.isArray(selections)) return [];
    const out = [];
    for (const row of selections) {
        if (!row || typeof row !== "object") continue;
        const promptId = row.promptId != null ? String(row.promptId).trim() : "";
        const cardId = row.cardId != null ? String(row.cardId).trim() : "";
        const groupId = row.groupId != null ? String(row.groupId).trim() : "";
        const customPrompt =
            row.customPrompt != null ? String(row.customPrompt).trim() : "";
        if (promptId) {
            out.push({ promptId, groupId: groupId || undefined });
        } else if (cardId) {
            out.push({ cardId });
        } else if (customPrompt && groupId) {
            out.push({ groupId, customPrompt });
        }
    }
    return out;
}

/**
 * @param {ReturnType<typeof normalizeSelections>} selections
 */
function serviceIdsFromSelections(selections) {
    const ids = new Set();
    for (const s of selections) {
        const g = s.groupId || (s.cardId ? auditGroupIdFromCardId(s.cardId) : "");
        if (g) ids.add(g === "cross" ? "cross" : g);
    }
    return [...ids];
}

export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (session.user.isExternal === true && session.user.isAdmin !== true) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        try {
            rejectClientAuditAiOverrides(body);
        } catch (overrideErr) {
            return NextResponse.json({ error: overrideErr.message }, { status: 400 });
        }

        if (getAuditAiAccessMode() !== "READ_ONLY") {
            return NextResponse.json(
                { error: "Audit AI misconfigured: READ_ONLY mode required" },
                { status: 500 }
            );
        }

        const {
            customerId,
            startDate,
            endDate,
            dataSnapshot = {},
            selections: selectionsRaw,
            comparisonEnabled,
            comparisonDateRange,
            outputFormat = "json",
            /** @deprecated legacy multi-select */
            serviceIds,
        } = body;

        if (!customerId || !startDate || !endDate) {
            return NextResponse.json(
                { error: "customerId, startDate, and endDate are required" },
                { status: 400 }
            );
        }

        let selections = normalizeSelections(selectionsRaw);

        if (selections.length === 0 && Array.isArray(serviceIds) && serviceIds.length > 0) {
            selections = serviceIds.map((id) => ({
                groupId: String(id),
                customPrompt: `Lav en holistisk kanal-audit for ${id} for den valgte periode med konkrete prioriterede handlinger.`,
            }));
        }

        if (selections.length === 0) {
            return NextResponse.json({ error: "Select at least one analysis" }, { status: 400 });
        }

        const customer = await getCustomerById(customerId);
        const plain = typeof customer.toObject === "function" ? customer.toObject() : customer;
        const customerName = plain.customerName || "Customer";

        const comparison =
            comparisonEnabled === true &&
            comparisonDateRange?.startDate &&
            comparisonDateRange?.endDate
                ? {
                      startDate: String(comparisonDateRange.startDate),
                      endDate: String(comparisonDateRange.endDate),
                  }
                : null;

        const auditContext = await buildAuditContext({
            customer: plain,
            customerId: String(customerId),
            startDate,
            endDate,
            comparisonDateRange: comparison,
            selections,
            pageSnapshot: dataSnapshot,
        });

        let report;
        if (!isAuditAiConfigured()) {
            report = buildFallbackAuditReport(customerName, selections, startDate, endDate);
            report.methodologyNote +=
                " Configure CLAUDE_CODE_API_KEY in environment variables for full Claude audit.";
        } else {
            const analysisResults = await runAuditAnalyses({
                customerName,
                dateRange: { startDate, endDate },
                comparisonDateRange: comparison,
                selections,
                auditContext,
            });
            report = assembleAuditReport(analysisResults, {
                customerName,
                dateRange: { startDate, endDate },
                comparisonDateRange: comparison,
                outputFormat,
            });
        }

        normalizeAuditReport(report);

        await connectToDatabase();
        const createdByUserId =
            session.user?.id && mongoose.Types.ObjectId.isValid(String(session.user.id))
                ? new mongoose.Types.ObjectId(String(session.user.id))
                : null;

        const ids = serviceIdsFromSelections(selections);

        const doc = await CustomerChannelAudit.create({
            customerId: plain._id,
            createdByUserId,
            dateRange: { startDate, endDate },
            comparisonDateRange: comparison,
            serviceIds: ids,
            auditSelections: selections,
            outputFormat: outputFormat || "json",
            report,
            canonicalOverall: report.canonicalOverall || { score: null, grade: "—" },
            customerNameSnapshot: customerName,
        });

        const auditId = String(doc._id);

        return NextResponse.json({
            auditId,
            report,
            customerName,
            customerId: String(plain._id),
            dateRange: { startDate, endDate },
            comparisonDateRange: comparison,
            services: ids.map((id) => ({ id })),
            analysisCount: Array.isArray(report.analyses) ? report.analyses.length : 0,
        });
    } catch (e) {
        console.error("[dashboard-audit/run]", e);
        const msg = e?.message === "Customer not found" ? "Customer not found" : "Audit failed";
        const status = e?.message === "Customer not found" ? 404 : 500;
        return NextResponse.json({ error: msg }, { status });
    }
}
