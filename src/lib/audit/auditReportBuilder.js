import {
    getAuditOutputSchemaInstruction,
    getAuditSystemPrompt,
    getTaskPromptForPromptId,
} from "./auditPromptLibrary";
import { parseAuditJsonLoose } from "./auditJsonParse";
import { minusOneYearDate } from "./auditDateUtils";
import { getAuditCatalogGroup } from "./auditPromptCatalog";
import { callAuditAnthropic, isAuditAiConfigured } from "./auditAnthropic";
import {
    gradeFromNumericScore,
    pickModelGrade,
    resolveAnalysisHealthScore,
} from "@/lib/channelAuditReport";
import { buildAuditDeveloperDiagnostics } from "./auditDeveloperDiagnostics";

export { parseAuditJsonLoose } from "./auditJsonParse";
export { minusOneYearDate };

/**
 * @typedef {{ promptId?: string, groupId?: string, customPrompt?: string }} AuditSelectionInput
 */

/**
 * @param {object} opts
 * @param {string} opts.customerName
 * @param {{ startDate: string, endDate: string }} opts.dateRange
 * @param {{ startDate: string, endDate: string }|null} [opts.comparisonDateRange]
 * @param {AuditSelectionInput[]} opts.selections
 * @param {object} [opts.auditContext] — server-built context (page snapshot + enrichments)
 * @param {object} [opts.dataSnapshot] — @deprecated use auditContext; kept for backward compatibility
 */
export async function runAuditAnalyses({
    customerName,
    dateRange,
    comparisonDateRange = null,
    selections,
    auditContext,
    dataSnapshot = {},
}) {
    const contextForPrompt =
        auditContext && typeof auditContext === "object"
            ? auditContext
            : { pageSnapshot: dataSnapshot, serverEnrichment: null };
    const system = await getAuditSystemPrompt();
    const outputSchema = getAuditOutputSchemaInstruction();

    async function runOne(sel) {
        const promptId = sel.promptId ? String(sel.promptId) : "";
        let cardId = "";
        let groupId = sel.groupId || (promptId ? "" : "cross");

        let title = "Custom analysis";
        let tag = "Custom";
        let dataLine = "";
        let taskPrompt = sel.customPrompt?.trim() || "";

        if (promptId) {
            const meta = await getTaskPromptForPromptId(promptId);
            if (!meta?.taskPrompt) {
                return {
                    ok: false,
                    cardId: `prompt-${promptId}`,
                    groupId: groupId || "cross",
                    error: "Prompt not found in audit prompt library",
                };
            }
            cardId = `prompt-${promptId}`;
            groupId = meta.groupId || groupId;
            title = meta.title;
            tag = meta.tag;
            dataLine = meta.dataLine;
            taskPrompt = meta.taskPrompt;
        } else {
            const group = getAuditCatalogGroup(groupId);
            title = group?.label || title;
        }

        if (!taskPrompt) {
            return {
                ok: false,
                cardId: cardId || `custom-${groupId}`,
                groupId: groupId || "cross",
                error: "Missing task prompt",
            };
        }

        const userMsg = buildUserMessage({
            customerName,
            cardId: cardId || `custom-${groupId}`,
            title,
            tag,
            dataLine,
            taskPrompt,
            dateRange,
            comparisonDateRange,
            auditContext: contextForPrompt,
        });

        try {
            const systemPrompt = outputSchema.trim()
                ? `${system}\n\n${outputSchema}`
                : system;
            const raw = await callAuditAnthropic({
                system: systemPrompt,
                user: userMsg,
            });
            const parsed = await parseAuditResponseWithRepair({
                system,
                outputSchema,
                raw,
                analysisTitle: title,
            });
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

    return Promise.all(selections.map((sel) => runOne(sel)));
}

/**
 * @param {{ system: string, outputSchema: string, raw: string, analysisTitle: string }} opts
 */
async function parseAuditResponseWithRepair({ system, outputSchema, raw, analysisTitle }) {
    try {
        return parseAuditJsonLoose(raw);
    } catch (parseErr) {
        const repairSystem = outputSchema.trim()
            ? `${system}\n\n${outputSchema}`
            : system;
        const repairRaw = await callAuditAnthropic({
            system: `${repairSystem}\n\nCRITICAL: Your entire reply must be exactly one JSON object. No markdown fences, no preamble, no text before or after the JSON.`,
            user: `The previous reply for "${analysisTitle}" was not valid JSON.

Convert it into ONLY one valid JSON object. Preserve all facts and structure from the original reply. Do not invent new data.

Previous reply:
---
${String(raw).slice(0, 80_000)}
---`,
            temperature: 0.1,
        });
        try {
            return parseAuditJsonLoose(repairRaw);
        } catch (repairParseErr) {
            const detail = repairParseErr?.message || parseErr?.message || "Invalid JSON";
            throw new Error(detail);
        }
    }
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
    auditContext,
}) {
    const periodBlock = `Period: ${dateRange.startDate} to ${dateRange.endDate}
Currency: DKK (kr) where relevant.
${comparisonDateRange ? `Comparison period: ${comparisonDateRange.startDate} to ${comparisonDateRange.endDate}` : "Comparison period: none"}`;

    const ahrefsNote =
        auditContext?.ahrefsAnalystNote && String(auditContext.ahrefsAnalystNote).trim()
            ? `\n\n${auditContext.ahrefsAnalystNote}`
            : "";

    return `Customer: ${customerName}
Analysis id: ${cardId}
Card: ${title} (${tag})
${dataLine ? `Expected data sources for this card: ${dataLine}` : ""}

${periodBlock}

Audit data context:
- pageSnapshot: metrics from the Apex page where the audit was started (always include if present).
- serverEnrichment: additional data fetched server-side for this audit only (Shopify, ad platforms, Search Console, Ahrefs, Klaviyo, etc.). Prefer serverEnrichment over pageSnapshot when both exist for the same metric.
- List data_gaps for anything the task needs that is missing from both sections.

${JSON.stringify(auditContext, null, 2)}${ahrefsNote}

---
TASK:
${taskPrompt}`;
}

/**
 * Build v2 report + legacy channels for existing UI components.
 * @param {Awaited<ReturnType<typeof runAuditAnalyses>>} analysisResults
 * @param {{ customerName: string, dateRange: object, comparisonDateRange: object|null, outputFormat?: string, integrationWarnings?: Record<string, boolean>, aiConfigured?: boolean }} meta
 * @param {object|null} [auditContext]
 */
export function assembleAuditReport(analysisResults, meta, auditContext = null) {
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
            grade: pickModelGrade(r.grade, health_score),
            period: r.period || meta.dateRange,
            comparison: r.comparison ?? meta.comparisonDateRange,
        });
    }

    const channels = buildLegacyChannelsFromAnalyses(analyses);
    const crossChannelNotes = analyses
        .filter((a) => a.groupId === "cross")
        .flatMap((a) =>
            (a.prioritized_actions || []).map((p) => {
                const parts = [p.action, p.why, p.business_case].filter(Boolean);
                return parts.length > 0 ? parts.join(" — ") : null;
            })
        )
        .filter(Boolean);

    const report = {
        version: 2,
        outputFormat: meta.outputFormat || "json",
        comparisonDateRange: meta.comparisonDateRange,
        analyses,
        channels,
        crossChannelNotes,
        failedAnalyses: failed.map((f) => ({
            id: f.cardId,
            title: f.title,
            error: f.error,
        })),
        developerDiagnostics: buildAuditDeveloperDiagnostics(auditContext, {
            failedAnalyses: failed.map((f) => ({
                id: f.cardId,
                title: f.title,
                error: f.error,
            })),
            integrationWarnings: meta.integrationWarnings,
            aiConfigured: meta.aiConfigured !== false,
        }),
    };

    return report;
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
            );

        const channelGrade =
            scores.length === 1 && rows[0]?.grade
                ? pickModelGrade(rows[0].grade, healthScore)
                : healthScore != null
                  ? gradeFromNumericScore(healthScore)
                  : null;

        return {
            id,
            label: groupLabels[id] || id,
            healthScore,
            grade: channelGrade,
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

export async function buildFallbackAuditReport(
    customerName,
    selections,
    startDate,
    endDate,
    integrationWarnings = {},
    auditContext = null
) {
    const pseudo = [];
    for (const sel of selections) {
        let title = "Analysis";
        let groupId = sel.groupId || "cross";
        let cardId = `custom-${groupId}`;

        if (sel.promptId) {
            const meta = await getTaskPromptForPromptId(String(sel.promptId));
            title = meta?.title || title;
            groupId = meta?.groupId || groupId;
            cardId = `prompt-${sel.promptId}`;
        } else {
            const group = getAuditCatalogGroup(groupId);
            title = group?.label || title;
        }

        pseudo.push({
            ok: true,
            cardId,
            groupId,
            title,
            tag: "—",
            result: {
                summary: `Placeholder — configure CLAUDE_CODE_API_KEY for full AI audit (${startDate}–${endDate}).`,
                findings: [],
                prioritized_actions: [],
                health_score: null,
                grade: "—",
            },
        });
    }
    return assembleAuditReport(
        pseudo,
        {
            customerName,
            dateRange: { startDate, endDate },
            comparisonDateRange: null,
            integrationWarnings,
            aiConfigured: false,
        },
        auditContext
    );
}

export { isAuditAiConfigured };
