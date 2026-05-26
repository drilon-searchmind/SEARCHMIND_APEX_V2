import {
    assembleAuditReport,
    runAuditAnalyses,
} from "./auditReportBuilder";
import { buildAuditContext } from "./auditContextBuilder";
import {
    ahrefsErrorsFromDiagnosticItems,
    suggestAhrefsRepairsViaClaude,
} from "./auditAhrefsRepair";
import { isAuditAiConfigured } from "./auditAnthropic";
import { getServiceDashboardConfigWarnings } from "@/lib/customerServiceIntegrations";
import { auditGroupIdFromCardId } from "./auditPromptCatalog";

/**
 * @param {unknown[]} selections
 */
function selectionsForSeoAndCross(selections) {
    if (!Array.isArray(selections)) return [];
    return selections.filter((sel) => {
        if (!sel || typeof sel !== "object") return false;
        const groupId =
            sel.groupId ||
            (sel.cardId ? auditGroupIdFromCardId(String(sel.cardId)) : "");
        return groupId === "seo" || groupId === "cross";
    });
}

/**
 * Re-fetch Ahrefs with repair hints and re-run SEO + cross analyses.
 * @param {{
 *   customer: object,
 *   customerId: string,
 *   customerName: string,
 *   dateRange: { startDate: string, endDate: string },
 *   comparisonDateRange: { startDate: string, endDate: string } | null,
 *   auditSelections: unknown[],
 *   existingReport: object,
 *   repairHints?: Record<string, { select: string, order_by?: string }>,
 * }} opts
 */
export async function rerunAuditWithAhrefsRepairs(opts) {
    const {
        customer,
        customerId,
        customerName,
        dateRange,
        comparisonDateRange,
        auditSelections,
        existingReport,
        repairHints: repairHintsIn,
    } = opts;

    const diagnosticItems = existingReport?.developerDiagnostics?.items || [];
    const ahrefsErrors = ahrefsErrorsFromDiagnosticItems(diagnosticItems);

    const repairHints =
        repairHintsIn ||
        (ahrefsErrors.length > 0
            ? await suggestAhrefsRepairsViaClaude(ahrefsErrors)
            : {});

    const auditContext = await buildAuditContext({
        customer,
        customerId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        comparisonDateRange,
        selections: auditSelections,
        pageSnapshot: {},
        ahrefsRepairHints: Object.keys(repairHints).length > 0 ? repairHints : undefined,
    });

    const toRerun = selectionsForSeoAndCross(auditSelections);
    const selectionsToRun =
        toRerun.length > 0
            ? toRerun
            : auditSelections.filter((s) => s && typeof s === "object");

    if (!isAuditAiConfigured()) {
        return {
            ok: false,
            error: "Audit AI is not configured",
            repairHints,
            auditContext,
        };
    }

    const analysisResults = await runAuditAnalyses({
        customerName,
        dateRange,
        comparisonDateRange,
        selections: selectionsToRun,
        auditContext,
    });

    const settings = customer?.CustomerSettings || {};
    const partialReport = assembleAuditReport(
        analysisResults,
        {
            customerName,
            dateRange,
            comparisonDateRange,
            integrationWarnings: getServiceDashboardConfigWarnings(settings),
            aiConfigured: true,
        },
        auditContext
    );

    const mergedAnalyses = mergeAnalysesIntoReport(
        existingReport,
        partialReport.analyses || []
    );

    const mergedFailed = mergeFailedAnalyses(
        existingReport?.failedAnalyses,
        partialReport.failedAnalyses || [],
        new Set((partialReport.analyses || []).map((a) => a.id))
    );

    const fullLayout = assembleAuditReport(
        mergedAnalyses.map((a) => ({
            ok: true,
            cardId: a.id,
            groupId: a.groupId,
            title: a.title,
            tag: a.tag,
            custom: a.custom === true,
            result: {
                summary: a.summary,
                thresholds_used: a.thresholds_used,
                findings: a.findings,
                prioritized_actions: a.prioritized_actions,
                data_gaps: a.data_gaps,
                health_score: a.health_score,
                grade: a.grade,
                period: a.period,
                comparison: a.comparison,
            },
        })),
        {
            customerName,
            dateRange,
            comparisonDateRange,
            integrationWarnings: getServiceDashboardConfigWarnings(settings),
            aiConfigured: true,
        },
        auditContext
    );

    const report = {
        ...existingReport,
        analyses: mergedAnalyses,
        channels: fullLayout.channels,
        crossChannelNotes: fullLayout.crossChannelNotes,
        failedAnalyses: mergedFailed,
        developerDiagnostics: partialReport.developerDiagnostics,
        ahrefsRepairApplied: {
            at: new Date().toISOString(),
            repairHints,
            rerunGroups: ["seo", "cross"],
            rerunAnalysisCount: (partialReport.analyses || []).length,
        },
    };

    return {
        ok: true,
        report,
        repairHints,
        auditContext,
        rerunCount: partialReport.analyses?.length || 0,
    };
}

/**
 * @param {object} existingReport
 * @param {object[]} newAnalyses
 */
function mergeAnalysesIntoReport(existingReport, newAnalyses) {
    const existing = Array.isArray(existingReport?.analyses)
        ? existingReport.analyses
        : [];
    const replaceIds = new Set(newAnalyses.map((a) => a.id));
    const kept = existing.filter((a) => !replaceIds.has(a.id));
    return [...kept, ...newAnalyses];
}

/**
 * @param {unknown} existingFailed
 * @param {unknown} newFailed
 * @param {Set<string>} succeededIds
 */
function mergeFailedAnalyses(existingFailed, newFailed, succeededIds) {
    const existing = Array.isArray(existingFailed) ? existingFailed : [];
    const withoutSucceeded = existing.filter((f) => !succeededIds.has(f?.id));
    const added = Array.isArray(newFailed) ? newFailed : [];
    const byId = new Map();
    for (const f of withoutSucceeded) {
        if (f?.id) byId.set(f.id, f);
    }
    for (const f of added) {
        if (f?.id) byId.set(f.id, f);
    }
    return [...byId.values()];
}
