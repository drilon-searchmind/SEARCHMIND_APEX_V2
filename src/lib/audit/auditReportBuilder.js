import {
    AUDIT_OUTPUT_SCHEMA_INSTRUCTION,
    getAuditSystemPrompt,
    getTaskPromptForCardId,
} from "./auditPromptLibrary";
import { minusOneYearDate } from "./auditDateUtils";
import {
    auditGroupIdFromCardId,
    getAuditCatalogCard,
    getAuditCatalogGroup,
} from "./auditPromptCatalog";
import { callAuditAnthropic, isAuditAiConfigured } from "./auditAnthropic";
import {
    gradeFromNumericScore,
    resolveAnalysisHealthScore,
} from "@/lib/channelAuditReport";

/**
 * @param {string} raw
 */
export function parseAuditJsonLoose(raw) {
    const s = String(raw || "").trim();
    const unfenced = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
    return JSON.parse(unfenced);
}

export { minusOneYearDate };

/**
 * @typedef {{ cardId?: string, groupId?: string, customPrompt?: string }} AuditSelectionInput
 */

/**
 * @param {object} opts
 * @param {string} opts.customerName
 * @param {{ startDate: string, endDate: string }} opts.dateRange
 * @param {{ startDate: string, endDate: string }|null} [opts.comparisonDateRange]
 * @param {AuditSelectionInput[]} opts.selections
 * @param {object} [opts.dataSnapshot]
 */
export async function runAuditAnalyses({
    customerName,
    dateRange,
    comparisonDateRange = null,
    selections,
    dataSnapshot = {},
}) {
    const system = await getAuditSystemPrompt();
    const results = [];
    const concurrency = 4;
    const queue = [...selections];

    async function runOne(sel) {
        const cardId = sel.cardId;
        const groupId = sel.groupId || (cardId ? auditGroupIdFromCardId(cardId) : "cross");
        const catalog = cardId ? getAuditCatalogCard(cardId) : null;
        const group = getAuditCatalogGroup(groupId);
        const meta = cardId ? await getTaskPromptForCardId(cardId) : null;

        let title = catalog?.card?.title || group?.label || "Custom analysis";
        let tag = catalog?.card?.tag || "Custom";
        let taskPrompt = sel.customPrompt?.trim() || "";

        if (cardId && meta) {
            taskPrompt = meta.taskPrompt;
            title = meta.title;
            tag = meta.tag;
        } else if (!taskPrompt) {
            return {
                ok: false,
                cardId: cardId || `custom-${groupId}`,
                groupId,
                error: "Missing task prompt",
            };
        }

        const userMsg = buildUserMessage({
            customerName,
            cardId: cardId || `custom-${groupId}`,
            title,
            tag,
            dataLine: meta?.dataLine || "",
            taskPrompt,
            dateRange,
            comparisonDateRange,
            dataSnapshot,
        });

        try {
            const raw = await callAuditAnthropic({
                system: `${system}\n\n${AUDIT_OUTPUT_SCHEMA_INSTRUCTION}`,
                user: userMsg,
                maxTokens: 8192,
            });
            const parsed = parseAuditJsonLoose(raw);
            return {
                ok: true,
                cardId: cardId || `custom-${groupId}`,
                groupId,
                title,
                tag,
                custom: !cardId,
                result: parsed,
            };
        } catch (e) {
            return {
                ok: false,
                cardId: cardId || `custom-${groupId}`,
                groupId,
                title,
                tag,
                error: e?.message || "Analysis failed",
            };
        }
    }

    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
        while (queue.length > 0) {
            const sel = queue.shift();
            if (!sel) break;
            results.push(await runOne(sel));
        }
    });
    await Promise.all(workers);

    return results;
}

function buildUserMessage({
    customerName,
    cardId,
    title,
    tag,
    dataLine,
    taskPrompt,
    dateRange,
    comparisonDateRange,
    dataSnapshot,
}) {
    const periodBlock = `Period: ${dateRange.startDate} to ${dateRange.endDate}
Currency: DKK (kr) where relevant.
${comparisonDateRange ? `Comparison period: ${comparisonDateRange.startDate} to ${comparisonDateRange.endDate}` : "Comparison period: none"}`;

    return `Customer: ${customerName}
Analysis id: ${cardId}
Card: ${title} (${tag})
${dataLine ? `Expected data sources for this card: ${dataLine}` : ""}

${periodBlock}

Dashboard snapshot (may be incomplete — list data_gaps if needed):
${JSON.stringify(dataSnapshot, null, 2)}

---
TASK:
${taskPrompt}`;
}

/**
 * Build v2 report + legacy channels for existing UI components.
 * @param {Awaited<ReturnType<typeof runAuditAnalyses>>} analysisResults
 * @param {{ customerName: string, dateRange: object, comparisonDateRange: object|null, outputFormat?: string }} meta
 */
export function assembleAuditReport(analysisResults, meta) {
    const analyses = [];
    const failed = [];

    for (const row of analysisResults) {
        if (!row.ok) {
            failed.push(row);
            continue;
        }
        const r = row.result || {};
        const findings = Array.isArray(r.findings) ? r.findings : [];
        const health_score = resolveAnalysisHealthScore(findings, r.health_score);
        analyses.push({
            id: row.cardId,
            groupId: row.groupId,
            groupLabel: getAuditCatalogGroup(row.groupId)?.label || row.groupId,
            title: row.title,
            tag: row.tag,
            custom: row.custom === true,
            summary: r.summary || "",
            thresholds_used: r.thresholds_used || "",
            findings,
            prioritized_actions: Array.isArray(r.prioritized_actions) ? r.prioritized_actions : [],
            data_gaps: r.data_gaps || "",
            health_score,
            grade: gradeFromNumericScore(health_score),
            period: r.period || meta.dateRange,
            comparison: r.comparison ?? meta.comparisonDateRange,
        });
    }

    const channels = buildLegacyChannelsFromAnalyses(analyses);
    const executiveSummary = buildExecutiveSummary(analyses, meta.customerName, failed);
    const crossChannelNotes = analyses
        .filter((a) => a.groupId === "cross")
        .flatMap((a) =>
            (a.prioritized_actions || []).slice(0, 2).map((p) => p.action || p.why).filter(Boolean)
        )
        .slice(0, 6);

    const report = {
        version: 2,
        outputFormat: meta.outputFormat || "json",
        executiveSummary,
        methodologyNote:
            "Data-driven audit via Claude (Apex prompt library). Recommendations are ready to implement; no auto-execution.",
        comparisonDateRange: meta.comparisonDateRange,
        analyses,
        channels,
        crossChannelNotes,
        failedAnalyses: failed.map((f) => ({
            id: f.cardId,
            title: f.title,
            error: f.error,
        })),
    };

    return report;
}

function buildExecutiveSummary(analyses, customerName, failed) {
    const crossPlan = analyses.find((a) => a.id === "cross-5");
    if (crossPlan?.summary) {
        return crossPlan.summary;
    }
    const summaries = analyses
        .map((a) => a.summary)
        .filter(Boolean)
        .slice(0, 4);
    let text = summaries.join(" ");
    if (!text) {
        text = `${customerName}: Audit completed with ${analyses.length} analysis(es).`;
    }
    if (failed.length > 0) {
        text += ` ${failed.length} analysis(es) failed and are not included in the report.`;
    }
    return text.trim();
}

function buildLegacyChannelsFromAnalyses(analyses) {
    /** @type {Record<string, typeof analyses>} */
    const byGroup = {};
    for (const a of analyses) {
        const g = a.groupId || "cross";
        if (!byGroup[g]) byGroup[g] = [];
        byGroup[g].push(a);
    }

    const groupLabels = {
        ppc: "PPC (Google Ads)",
        ps: "PS (Meta Paid Social)",
        seo: "SEO",
        em: "EM (Klaviyo)",
        cross: "Cross-channel",
    };

    return Object.entries(byGroup).map(([id, rows]) => {
        const scores = rows
            .map((r) => r.health_score)
            .filter((n) => n != null && Number.isFinite(Number(n)))
            .map(Number);
        const healthScore =
            scores.length > 0
                ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
                : null;
        const topPriorities = rows
            .flatMap((r) =>
                (Array.isArray(r.findings) ? r.findings : []).map((f) => ({
                    title: f.title || r.title,
                    severity: mapSeverityToEn(f.severity),
                    rationale: f.evidence || f.impact || "",
                    recommendedAction: f.recommendation || "",
                }))
            )
            .slice(0, 7);

        return {
            id,
            label: groupLabels[id] || id,
            healthScore,
            grade: gradeFromNumericScore(healthScore),
            summary: rows.map((r) => r.summary).filter(Boolean).join(" ") || "",
            topPriorities,
        };
    });
}

function mapSeverityToEn(sev) {
    const s = String(sev || "").toLowerCase();
    if (s === "kritisk" || s === "critical") return "critical";
    if (s === "høj" || s === "hoj" || s === "high") return "high";
    if (s === "medium") return "medium";
    if (s === "lav" || s === "low") return "low";
    return "low";
}

export function buildFallbackAuditReport(customerName, selections, startDate, endDate) {
    const pseudo = selections.map((sel) => ({
        ok: true,
        cardId: sel.cardId || `custom-${sel.groupId || "cross"}`,
        groupId: sel.groupId || auditGroupIdFromCardId(sel.cardId) || "cross",
        title: getAuditCatalogCard(sel.cardId)?.card?.title || "Analyse",
        tag: "—",
        result: {
            summary: `Placeholder — configure CLAUDE_CODE_API_KEY for full AI audit (${startDate}–${endDate}).`,
            findings: [],
            prioritized_actions: [],
            health_score: null,
            grade: "—",
        },
    }));
    return assembleAuditReport(pseudo, {
        customerName,
        dateRange: { startDate, endDate },
        comparisonDateRange: null,
    });
}

export { isAuditAiConfigured };
