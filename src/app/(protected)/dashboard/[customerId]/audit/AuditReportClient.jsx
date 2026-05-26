"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { FiArrowLeft, FiClipboard, FiList, FiShare2 } from "react-icons/fi";
import { LuBrainCircuit } from "react-icons/lu";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import AuditFollowUpModal from "@/components/audit-followup/AuditFollowUpModal";
import Spinner from "@/components/ui/Spinner";
import { showToast } from "@/components/ui/ToastProvider";
import {
    gradeFromNumericScore,
    isMongoObjectIdString,
    meanAnalysisHealthFromReport,
    meanChannelHealthFromReport,
    pickModelGrade,
    resolveAnalysisHealthScore,
} from "@/lib/channelAuditReport";
import { buildAuditDeveloperDiagnostics } from "@/lib/audit/auditDeveloperDiagnostics";
import { useUser } from "@/contexts/UserContext";
const STORAGE_PREFIX = "apex_audit:";

const GROUP_TAB_LABELS = {
    cross: "Cross-channel",
    ppc: "Google Ads",
    ps: "Meta",
    seo: "SEO",
    em: "Klaviyo",
};

const CROSS_NOTES_TAB_ID = "__cross_channel_notes__";

function normalizeGroupLabel(groupId, groupLabel) {
    if (groupId && GROUP_TAB_LABELS[groupId]) return GROUP_TAB_LABELS[groupId];
    const g = String(groupLabel || "").trim();
    if (/overordnet/i.test(g)) return "Cross-channel";
    if (/google|ppc/i.test(g)) return "Google Ads";
    if (/meta|paid social/i.test(g)) return "Meta";
    if (/klaviyo|email/i.test(g)) return "Klaviyo";
    return g || groupId || "Other";
}

function formatSeverityLabel(severity) {
    const x = String(severity || "").toLowerCase();
    const map = {
        kritisk: "Critical",
        critical: "Critical",
        høj: "High",
        hoj: "High",
        high: "High",
        medium: "Medium",
        lav: "Low",
        low: "Low",
    };
    return map[x] || (severity ? String(severity) : "—");
}

function formatTagLabel(tag) {
    const x = String(tag || "").trim();
    const map = {
        Vækst: "Growth",
        Struktur: "Structure",
        Optimering: "Optimization",
        Afkast: "ROI",
        Alarm: "Alert",
        Kreativ: "Creative",
        Plan: "Plan",
    };
    return map[x] || x;
}

function severityStyles(severity) {
    const x = String(severity || "").toLowerCase();
    if (x === "critical" || x === "kritisk") {
        return "bg-red-50 text-red-900 border-red-200";
    }
    if (x === "high" || x === "høj" || x === "hoj") {
        return "bg-orange-50 text-orange-900 border-orange-200";
    }
    if (x === "medium") {
        return "bg-amber-50 text-amber-900 border-amber-200";
    }
    if (x === "low" || x === "lav") {
        return "bg-emerald-50 text-emerald-900 border-emerald-200";
    }
    return "bg-gray-50 text-gray-800 border-gray-200";
}

function FindingCard({ finding, showActionLabel = "Action", onAnalyzeFinding }) {
    const severity = finding.severity;
    const recommendation = finding.recommendation || finding.recommendedAction;
    const recommendationLabel =
        showActionLabel === "Action" ? "Recommendation" : showActionLabel;

    return (
        <li
            className={`flex flex-col gap-3 rounded-lg border px-3 py-3 sm:flex-row sm:items-start sm:gap-4 ${severityStyles(severity)}`}
        >
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="font-semibold text-sm">{finding.title}</span>
                    <span className="text-[0.65rem] font-semibold uppercase tracking-wide opacity-80">
                        {formatSeverityLabel(severity)}
                    </span>
                </div>
                {finding.rationale || finding.evidence ? (
                    <p className="mt-1.5 text-xs leading-relaxed opacity-90">
                        {finding.rationale || finding.evidence}
                    </p>
                ) : null}
                {finding.impact ? (
                    <p className="mt-1.5 text-xs opacity-90">
                        <span className="font-semibold">Impact:</span> {finding.impact}
                    </p>
                ) : null}
                {recommendation || finding.business_case ? (
                    <div className="mt-3 space-y-2">
                        {recommendation ? (
                            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-800">
                                <p className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--color-primary-searchmind)] mb-1">
                                    {recommendationLabel}
                                </p>
                                <p className="text-xs leading-relaxed text-gray-700">{recommendation}</p>
                            </div>
                        ) : null}
                        {finding.business_case ? (
                            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-800">
                                <p className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--color-primary-searchmind)] mb-1">
                                    Business case
                                </p>
                                <p className="text-xs leading-relaxed text-gray-700">
                                    {finding.business_case}
                                </p>
                            </div>
                        ) : null}
                    </div>
                ) : null}
                {finding.expected_effect ? (
                    <p className="mt-1.5 text-xs opacity-90">
                        <span className="font-semibold">Expected effect:</span> {finding.expected_effect}
                    </p>
                ) : null}
                {finding.confidence || finding.effort ? (
                    <p className="mt-1.5 text-xs text-gray-600">
                        {finding.confidence ? (
                            <span>
                                <span className="font-semibold">Confidence:</span> {finding.confidence}
                            </span>
                        ) : null}
                        {finding.confidence && finding.effort ? " · " : null}
                        {finding.effort ? (
                            <span>
                                <span className="font-semibold">Effort:</span> {finding.effort}
                            </span>
                        ) : null}
                    </p>
                ) : null}
            </div>
            {onAnalyzeFinding ? (
                <button
                    type="button"
                    onClick={() => onAnalyzeFinding(finding)}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start whitespace-nowrap rounded-lg border border-purple-500 bg-purple-50 px-3 py-2 text-[0.65rem] font-semibold text-purple-700 transition-colors hover:bg-purple-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-searchmind)] sm:max-w-[9.5rem] sm:text-xs"
                >
                    <LuBrainCircuit className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Analyze this with AI
                </button>
            ) : null}
        </li>
    );
}

function scoreTierClasses(score) {
    if (score == null || !Number.isFinite(Number(score))) {
        return {
            pill: "border border-gray-200 bg-white text-gray-800",
            gradeWrap: "border border-gray-200 bg-white text-gray-700",
            gradeAccent: "text-gray-600",
        };
    }
    const s = Number(score);
    if (s >= 75) {
        return {
            pill: "border border-emerald-200 bg-white text-gray-900",
            gradeWrap: "border border-gray-200 bg-white text-gray-700",
            gradeAccent: "text-emerald-700",
        };
    }
    if (s >= 25) {
        return {
            pill: "border border-amber-200 bg-white text-gray-900",
            gradeWrap: "border border-gray-200 bg-white text-gray-700",
            gradeAccent: "text-amber-700",
        };
    }
    return {
        pill: "border border-red-200 bg-white text-gray-900",
        gradeWrap: "border border-gray-200 bg-white text-gray-700",
        gradeAccent: "text-red-700",
    };
}

function ScoreHighlight({ score, gradeLabel, size = "lg" }) {
    const hasScore = score != null && Number.isFinite(Number(score));
    const grade =
        gradeLabel != null && String(gradeLabel).trim() && String(gradeLabel) !== "—"
            ? String(gradeLabel).trim()
            : hasScore
              ? gradeFromNumericScore(score)
              : null;
    if (!hasScore && !grade) return null;

    const isLg = size === "lg";
    const tier = scoreTierClasses(score);
    const gradeTier =
        score != null && Number.isFinite(Number(score)) ? tier : scoreTierClasses(null);

    return (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span
                className={`inline-flex min-h-[3rem] items-baseline justify-center gap-0.5 rounded-lg font-bold tabular-nums ${tier.pill} ${
                    isLg ? "min-w-[5.5rem] px-4 py-3" : "min-w-[4.5rem] px-3 py-2"
                }`}
            >
                {score != null && Number.isFinite(Number(score)) ? (
                    <>
                        <span className={isLg ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"}>
                            {Math.round(Number(score))}
                        </span>
                        <span
                            className={
                                isLg
                                    ? "text-base sm:text-lg font-semibold text-gray-500"
                                    : "text-sm font-semibold text-gray-500"
                            }
                        >
                            / 100
                        </span>
                    </>
                ) : (
                    <span className={isLg ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"}>—</span>
                )}
            </span>
            {grade ? (
                <span
                    className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold ${gradeTier.gradeWrap}`}
                >
                    Grade <span className={`ml-1.5 tabular-nums ${gradeTier.gradeAccent}`}>{grade}</span>
                </span>
            ) : null}
        </div>
    );
}

function ScoreMetricCard({ title, score, gradeLabel }) {
    return (
        <div className="flex flex-1 flex-col rounded-xl border border-gray-200 bg-white overflow-hidden min-w-[120px] max-w-[200px]">
            <div className="px-4 py-3">
                <div className="text-xs font-medium text-gray-500 mb-2 truncate" title={title}>
                    {title}
                </div>
                <ScoreHighlight score={score} gradeLabel={gradeLabel} size="sm" />
            </div>
        </div>
    );
}

function AnalysisArticle({ analysis, onAnalyzeFinding }) {
    const groupLabel = normalizeGroupLabel(analysis.groupId, analysis.groupLabel);
    const tag = formatTagLabel(analysis.tag);

    return (
        <article className="rounded-xl border border-gray-200 bg-white p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4 mb-4">
                <div className="min-w-0 pr-2">
                    <p className="text-[0.65rem] font-bold uppercase tracking-wide text-gray-400">
                        {groupLabel}
                        {tag ? ` · ${tag}` : ""}
                    </p>
                    <h3 className="text-base font-bold text-gray-900">{analysis.title}</h3>
                </div>
                <ScoreHighlight
                    score={analysis.health_score}
                    gradeLabel={analysis.grade}
                    size="sm"
                />
            </div>
            {analysis.summary ? (
                <div className="text-sm text-gray-700 mb-4 whitespace-pre-wrap leading-relaxed">
                    {analysis.summary}
                </div>
            ) : null}
            {analysis.thresholds_used ? (
                <p className="text-xs text-gray-500 mb-4 border-l-2 border-gray-200 pl-3">
                    <span className="font-semibold text-gray-600">Thresholds:</span> {analysis.thresholds_used}
                </p>
            ) : null}
            {(Array.isArray(analysis.findings) ? analysis.findings : []).length > 0 ? (
                <ul className="space-y-3">
                    {analysis.findings.map((f, i) => (
                        <FindingCard key={i} finding={f} onAnalyzeFinding={onAnalyzeFinding} />
                    ))}
                </ul>
            ) : null}
            {analysis.data_gaps ? (
                <p className="mt-4 text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 whitespace-pre-wrap">
                    <span className="font-semibold">Data gaps:</span> {analysis.data_gaps}
                </p>
            ) : null}
            {Array.isArray(analysis.prioritized_actions) && analysis.prioritized_actions.length > 0 ? (
                <div className="mt-4 border-t border-gray-100 pt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Prioritized actions
                    </p>
                    <ol className="list-decimal pl-5 space-y-2 text-xs text-gray-700">
                        {analysis.prioritized_actions.map((p, i) => (
                            <li key={p.rank ?? i} className="leading-relaxed">
                                <span className="font-medium text-gray-900">{p.action}</span>
                                {p.channel ? (
                                    <span className="text-gray-500"> ({p.channel})</span>
                                ) : null}
                                {p.why ? <span className="block mt-0.5">{p.why}</span> : null}
                                {p.business_case ? (
                                    <span className="block mt-0.5 text-gray-600">{p.business_case}</span>
                                ) : null}
                            </li>
                        ))}
                    </ol>
                </div>
            ) : null}
        </article>
    );
}

function ChannelPrioritySection({ channel, onAnalyzeFinding }) {
    const priorities = Array.isArray(channel.topPriorities) ? channel.topPriorities : [];
    if (priorities.length === 0) return null;

    return (
        <section className="rounded-xl border border-gray-200 bg-white p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4 mb-4">
                <h3 className="text-base font-bold text-gray-900">
                    {normalizeGroupLabel(channel.id, channel.label)}
                </h3>
                <ScoreHighlight
                    score={channel.healthScore}
                    gradeLabel={
                        channel.grade != null
                            ? String(channel.grade)
                            : gradeFromNumericScore(channel.healthScore)
                    }
                    size="sm"
                />
            </div>
            {channel.summary ? (
                <p className="text-sm text-gray-600 mb-4 leading-relaxed">{channel.summary}</p>
            ) : null}
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Top priorities</p>
            <ul className="space-y-3">
                {priorities.map((p, i) => (
                    <FindingCard
                        key={i}
                        finding={{
                            title: p.title,
                            severity: p.severity,
                            rationale: p.rationale,
                            recommendedAction: p.recommendedAction,
                        }}
                        onAnalyzeFinding={onAnalyzeFinding}
                    />
                ))}
            </ul>
        </section>
    );
}

const DIAGNOSTIC_CATEGORY_LABELS = {
    data_fetch: "Data fetch",
    analysis: "AI analysis",
    config: "Configuration",
    integration: "Integration",
};

function formatDiagnosticDetail(detail) {
    if (detail == null) return "";
    try {
        return JSON.stringify(detail, null, 2);
    } catch {
        return String(detail);
    }
}

function AuditDeveloperDiagnosticsPanel({ diagnostics }) {
    const items = Array.isArray(diagnostics?.items) ? diagnostics.items : [];
    const hasItems = items.length > 0;

    return (
        <section className="mt-8 rounded-xl border border-slate-300 bg-slate-950 text-slate-100 overflow-hidden">
            <details open={hasItems} className="group">
                <summary className="cursor-pointer list-none px-4 py-3 md:px-5 md:py-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/80 hover:bg-slate-900">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                            Developer diagnostics
                        </p>
                        <p className="text-sm text-slate-300 mt-0.5">
                            {hasItems
                                ? `${items.length} issue${items.length === 1 ? "" : "s"} recorded during this audit run`
                                : "No issues recorded for this audit run"}
                        </p>
                    </div>
                    {hasItems ? (
                        <span className="inline-flex items-center rounded-md bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/30">
                            {items.length} total
                        </span>
                    ) : (
                        <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/20">
                            All clear
                        </span>
                    )}
                </summary>

                <div className="px-4 py-4 md:px-5 md:py-5 space-y-4">
                    {diagnostics?.collectedAt ? (
                        <p className="text-xs text-slate-500">
                            Collected {new Date(diagnostics.collectedAt).toLocaleString()}
                            {diagnostics?.byCategory ? (
                                <>
                                    {" "}
                                    · Data fetch {diagnostics.byCategory.data_fetch || 0} · AI{" "}
                                    {diagnostics.byCategory.analysis || 0} · Config{" "}
                                    {diagnostics.byCategory.config || 0}
                                </>
                            ) : null}
                        </p>
                    ) : null}

                    {hasItems ? (
                        <ul className="space-y-3">
                            {items.map((row, idx) => (
                                <li
                                    key={`${row.source}-${idx}`}
                                    className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 md:p-4"
                                >
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <span className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-400">
                                            {DIAGNOSTIC_CATEGORY_LABELS[row.category] ||
                                                row.category}
                                        </span>
                                        <span className="text-[0.65rem] font-mono text-cyan-300/90 bg-slate-800 px-1.5 py-0.5 rounded">
                                            {row.source}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                                        {row.message}
                                    </p>
                                    {row.detail != null ? (
                                        <pre className="mt-3 max-h-48 overflow-auto rounded-md bg-black/40 border border-slate-800 p-3 text-[0.7rem] leading-relaxed text-slate-400 font-mono">
                                            {formatDiagnosticDetail(row.detail)}
                                        </pre>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-slate-400">
                            Data sources and analyses completed without logged errors. Re-run the audit
                            after changing integrations or prompts if you expected issues here.
                        </p>
                    )}
                </div>
            </details>
        </section>
    );
}

function readLegacySessionPayload(auditId, customerId) {
    if (typeof window === "undefined" || !auditId || !customerId) {
        return { payload: null, loadError: null };
    }
    if (isMongoObjectIdString(auditId)) {
        return { payload: null, loadError: null };
    }
    try {
        const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${auditId}`);
        if (!raw) {
            return {
                payload: null,
                loadError: "Audit not found in this session. Run a new audit from the dashboard.",
            };
        }
        const parsed = JSON.parse(raw);
        if (String(parsed.customerId) !== String(customerId)) {
            return { payload: null, loadError: "This audit belongs to another customer." };
        }
        return { payload: parsed, loadError: null };
    } catch (e) {
        console.error(e);
        return { payload: null, loadError: "Could not load audit." };
    }
}

export default function AuditReportClient() {
    const user = useUser();
    const params = useParams();
    const searchParams = useSearchParams();
    const customerId = params?.customerId;
    const auditId = searchParams.get("audit_id");

    const [serverPayload, setServerPayload] = useState(null);
    const [serverError, setServerError] = useState(null);
    const [serverLoading, setServerLoading] = useState(false);
    const [detailTab, setDetailTab] = useState("all");
    const [followUpOpen, setFollowUpOpen] = useState(false);
    const [followUpFinding, setFollowUpFinding] = useState(null);

    const handleAnalyzeFinding = (finding) => {
        setFollowUpFinding(finding);
        setFollowUpOpen(true);
    };

    const handleCloseFollowUp = () => {
        setFollowUpOpen(false);
        setFollowUpFinding(null);
    };

    const mongoAudit = Boolean(auditId && isMongoObjectIdString(auditId));

    useEffect(() => {
        if (!auditId || !customerId || !mongoAudit) {
            setServerPayload(null);
            setServerError(null);
            setServerLoading(false);
            return undefined;
        }
        let cancelled = false;
        setServerLoading(true);
        setServerError(null);
        setServerPayload(null);
        (async () => {
            try {
                const url = `/api/dashboard-audit?customerId=${encodeURIComponent(customerId)}&auditId=${encodeURIComponent(auditId)}`;
                const res = await fetch(url);
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || "Failed to load audit");
                if (cancelled) return;
                setServerPayload({
                    auditId: data.auditId,
                    customerId: data.customerId,
                    customerName: data.customerName,
                    dateRange: data.dateRange,
                    comparisonDateRange: data.comparisonDateRange || null,
                    services: data.services,
                    report: data.report,
                    generatedAt: data.generatedAt,
                });
            } catch (e) {
                if (!cancelled) setServerError(e?.message || "Failed to load audit");
            } finally {
                if (!cancelled) setServerLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [auditId, customerId, mongoAudit]);

    const { payload: legacyPayload, loadError: legacyError } = useMemo(
        () => readLegacySessionPayload(auditId, customerId),
        [auditId, customerId]
    );

    const missingParams = !auditId || !customerId;
    const payload = serverPayload ?? (!mongoAudit ? legacyPayload : null);

    let loadError = null;
    if (missingParams) loadError = "Missing audit or customer.";
    else if (mongoAudit) {
        if (serverLoading) loadError = null;
        else if (serverError) loadError = serverError;
        else if (!serverPayload && !serverLoading) loadError = "Audit not found.";
    } else {
        loadError = legacyError;
    }

    const report = payload?.report;
    const channels = useMemo(() => {
        const r = payload?.report;
        return Array.isArray(r?.channels) ? r.channels : [];
    }, [payload]);

    const analyses = useMemo(() => {
        const r = payload?.report;
        const raw = Array.isArray(r?.analyses) ? r.analyses : [];
        return raw.map((a) => {
            const findings = Array.isArray(a.findings) ? a.findings : [];
            const health_score = resolveAnalysisHealthScore(findings, a.health_score);
            return {
                ...a,
                health_score,
                grade: pickModelGrade(a.grade, health_score),
            };
        });
    }, [payload]);

    const isV2Report = report?.version === 2 || analyses.length > 0;

    const crossChannelNotes = useMemo(
        () => (Array.isArray(report?.crossChannelNotes) ? report.crossChannelNotes : []),
        [report]
    );

    /** One tab per analysis (and optional cross-channel notes), plus All */
    const sectionTabs = useMemo(() => {
        const tabs = [{ id: "all", label: "All" }];

        if (analyses.length > 0) {
            for (const a of analyses) {
                const id = String(a.id || "").trim();
                if (!id) continue;
                tabs.push({
                    id,
                    label: String(a.title || id).trim() || "Analysis",
                });
            }
        } else {
            for (const ch of channels) {
                const id = String(ch.id || "").trim();
                if (!id) continue;
                tabs.push({
                    id,
                    label: normalizeGroupLabel(ch.id, ch.label),
                });
            }
        }

        if (crossChannelNotes.length > 0) {
            tabs.push({ id: CROSS_NOTES_TAB_ID, label: "Cross-channel notes" });
        }

        return tabs;
    }, [analyses, channels, crossChannelNotes]);

    useEffect(() => {
        if (!sectionTabs.some((t) => t.id === detailTab)) {
            setDetailTab("all");
        }
    }, [sectionTabs, detailTab]);

    const filteredAnalyses = useMemo(() => {
        if (detailTab === "all") return analyses;
        if (detailTab === CROSS_NOTES_TAB_ID) return [];
        return analyses.filter((a) => String(a.id) === detailTab);
    }, [analyses, detailTab]);

    const filteredChannels = useMemo(() => {
        if (detailTab === "all") return channels;
        if (detailTab === CROSS_NOTES_TAB_ID) return [];
        return channels.filter((ch) => String(ch.id) === detailTab);
    }, [channels, detailTab]);

    const showCrossNotesPanel =
        crossChannelNotes.length > 0 &&
        (detailTab === "all" || detailTab === CROSS_NOTES_TAB_ID);

    const headingLabel = payload?.customerName || "Audit";

    const overall = useMemo(() => {
        if (!report) return { score: null, grade: "—" };
        if (isV2Report && analyses.length > 0) {
            return meanAnalysisHealthFromReport({ analyses });
        }
        const c = report.canonicalOverall;
        if (c?.score != null && Number.isFinite(Number(c.score))) {
            const sc = Number(c.score);
            return {
                score: sc,
                grade: c.grade && String(c.grade) !== "—" ? String(c.grade) : gradeFromNumericScore(sc),
            };
        }
        return meanChannelHealthFromReport(report);
    }, [report, isV2Report, analyses]);

    const handleShareLink = async () => {
        if (typeof window === "undefined") return;
        try {
            await navigator.clipboard.writeText(window.location.href);
            showToast({ message: "Link copied", type: "success", position: "top-center" });
        } catch {
            showToast({ message: "Could not copy link", type: "error", position: "top-center" });
        }
    };

    const showSpinner = mongoAudit && serverLoading && !payload;
    const backHref = `/dashboard/${customerId}/performance-dashboard`;
    const showV2Details = isV2Report && analyses.length > 0;
    const showLegacyChannels = !showV2Details && channels.length > 0;
    const executiveSummaryText = String(report?.executiveSummary || "").trim();
    const showExecutiveSummary = executiveSummaryText.length > 0;
    const showOverallHealth = overall.score != null && Number.isFinite(Number(overall.score));
    const showDeveloperDiagnostics = user?.isAdmin === true;

    const developerDiagnostics = useMemo(() => {
        if (report?.developerDiagnostics?.items) {
            return report.developerDiagnostics;
        }
        if (!report) return null;
        return buildAuditDeveloperDiagnostics(null, {
            failedAnalyses: Array.isArray(report.failedAnalyses) ? report.failedAnalyses : [],
            aiConfigured: true,
        });
    }, [report]);

    return (
        <div className="w-full">
            <DashboardHeading
                title="Channel audit"
                label={headingLabel}
                customerId={customerId}
                showAnalyzeWithAi={false}
                showPdfExport={false}
                showRunAudit={false}
                right={
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={handleShareLink}
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-searchmind)]"
                        >
                            <FiShare2 className="h-4 w-4 shrink-0" aria-hidden />
                            Share link
                        </button>
                        <Link
                            href={`/dashboard/${customerId}/audit`}
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-searchmind)]"
                        >
                            <FiList className="h-4 w-4 shrink-0" aria-hidden />
                            View all audits
                        </Link>
                        <Link
                            href={backHref}
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-searchmind)]"
                        >
                            <FiArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                            Back to dashboard
                        </Link>
                    </div>
                }
            />

            {loadError ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-900 mb-8">
                    <p>{loadError}</p>
                    {customerId ? (
                        <div className="mt-4 flex flex-wrap justify-center gap-3">
                            <Link
                                href={`/dashboard/${customerId}/audit`}
                                className="text-sm font-semibold text-[var(--color-primary-searchmind)] underline"
                            >
                                View all audits
                            </Link>
                            <Link href={backHref} className="text-sm font-semibold text-gray-700 underline">
                                Back to dashboard
                            </Link>
                        </div>
                    ) : null}
                </div>
            ) : showSpinner ? (
                <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-gray-200 bg-white">
                    <Spinner size={40} color="#406969" />
                </div>
            ) : !payload ? (
                <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
                    Loading…
                </div>
            ) : (
                <>
                    <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 md:p-6">
                        <div
                            className={
                                showOverallHealth
                                    ? "flex flex-col gap-6 lg:flex-row lg:items-start"
                                    : "flex flex-col gap-6"
                            }
                        >
                            <div
                                className={
                                    showOverallHealth
                                        ? "min-w-0 w-full lg:flex-[3] lg:min-w-0"
                                        : "min-w-0 w-full"
                                }
                            >
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    {showExecutiveSummary ? (
                                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                            <FiClipboard
                                                className="h-5 w-5 text-[var(--color-primary-searchmind)] shrink-0"
                                                aria-hidden
                                            />
                                            Executive summary
                                        </h2>
                                    ) : (
                                        <h2 className="text-lg font-bold text-gray-900">Audit report</h2>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setFollowUpOpen(true)}
                                        className="inline-flex shrink-0 items-center justify-center whitespace-nowrap bg-purple-50 border border-purple-500 text-purple-700 py-2 px-4 text-xs rounded-lg gap-2 transition-colors shadow-none hover:bg-purple-100"
                                    >
                                        <LuBrainCircuit className="text-base shrink-0" aria-hidden />
                                        Analyze with AI
                                    </button>
                                </div>

                                {showExecutiveSummary ? (
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                        {executiveSummaryText}
                                    </p>
                                ) : null}
                                {report?.methodologyNote ? (
                                    <p
                                        className={`text-xs text-gray-400 ${
                                            showExecutiveSummary
                                                ? "mt-3 border-t border-gray-100 pt-3"
                                                : ""
                                        }`}
                                    >
                                        {report.methodologyNote}
                                    </p>
                                ) : null}

                                {!showOverallHealth ? (
                                    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 border-t border-gray-100 pt-5 text-sm text-gray-600">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                                Audit ID
                                            </p>
                                            <p className="mt-1 font-mono text-xs text-gray-800 break-all">
                                                {payload.auditId}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                                Period
                                            </p>
                                            <p className="mt-1">
                                                {payload.dateRange?.startDate} → {payload.dateRange?.endDate}
                                            </p>
                                        </div>
                                        {payload.comparisonDateRange?.startDate ? (
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                                    Compare
                                                </p>
                                                <p className="mt-1 text-xs">
                                                    {payload.comparisonDateRange.startDate} →{" "}
                                                    {payload.comparisonDateRange.endDate}
                                                </p>
                                            </div>
                                        ) : null}
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                                Generated
                                            </p>
                                            <p className="mt-1 text-xs text-gray-500">
                                                {new Date(payload.generatedAt).toLocaleString()}
                                                {showV2Details
                                                    ? ` · ${analyses.length} analyses`
                                                    : ""}
                                            </p>
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            {showOverallHealth ? (
                                <aside className="flex w-full shrink-0 flex-col gap-4 lg:flex-[1] lg:min-w-[220px] lg:max-w-[280px] lg:sticky lg:top-4">
                                    <div className="rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-4">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                            Audit ID
                                        </p>
                                        <p className="mt-1 font-mono text-sm text-gray-800 break-all">
                                            {payload.auditId}
                                        </p>
                                        <div className="mt-4 space-y-2 text-sm text-gray-600 border-t border-gray-200/80 pt-4">
                                            <p>
                                                <span className="font-semibold text-gray-500">Period:</span>{" "}
                                                {payload.dateRange?.startDate} → {payload.dateRange?.endDate}
                                            </p>
                                            {payload.comparisonDateRange?.startDate ? (
                                                <p className="text-xs text-gray-500">
                                                    Compare: {payload.comparisonDateRange.startDate} →{" "}
                                                    {payload.comparisonDateRange.endDate}
                                                </p>
                                            ) : null}
                                            {showV2Details ? (
                                                <p className="text-xs text-gray-500">
                                                    {analyses.length} analyses
                                                </p>
                                            ) : null}
                                            <p className="text-xs text-gray-400">
                                                Generated {new Date(payload.generatedAt).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-gray-200 bg-gray-50/40 px-4 py-4">
                                        <div className="text-sm font-medium text-gray-500 mb-1">
                                            Overall health
                                        </div>
                                        <div className="text-[0.65rem] text-gray-400 mb-3">
                                            {showV2Details && analyses.length > 0
                                                ? `Average across ${analyses.length} section${analyses.length === 1 ? "" : "s"}`
                                                : "Average across channels"}
                                        </div>
                                        <ScoreHighlight
                                            score={overall.score}
                                            gradeLabel={overall.grade}
                                            size="lg"
                                        />
                                    </div>
                                </aside>
                            ) : null}
                        </div>

                        {!showV2Details && channels.some((ch) => ch.healthScore != null) ? (
                            <div className="mt-6 flex flex-wrap gap-3 items-stretch border-t border-gray-100 pt-6">
                                {channels
                                    .filter((ch) => ch.healthScore != null)
                                    .map((ch) => (
                                        <ScoreMetricCard
                                            key={ch.id || ch.label}
                                            title={normalizeGroupLabel(ch.id, ch.label)}
                                            score={ch.healthScore}
                                            gradeLabel={
                                                ch.grade != null
                                                    ? String(ch.grade)
                                                    : gradeFromNumericScore(ch.healthScore)
                                            }
                                        />
                                    ))}
                            </div>
                        ) : null}
                    </section>

                    {(showV2Details || showLegacyChannels) && sectionTabs.length > 1 ? (
                        <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-gray-200">
                            {sectionTabs.map((tab) => {
                                const active = detailTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setDetailTab(tab.id)}
                                        title={tab.label}
                                        className={`max-w-[14rem] truncate inline-flex px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                                            active
                                                ? "border-[var(--color-primary-searchmind)] text-gray-900"
                                                : "border-transparent text-gray-500 hover:text-gray-800"
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>
                    ) : null}

                    {showV2Details && detailTab !== CROSS_NOTES_TAB_ID ? (
                        <section className="space-y-5">
                            {filteredAnalyses.length === 0 && detailTab !== "all" ? (
                                <p className="text-sm text-gray-500 rounded-xl border border-gray-200 bg-white px-4 py-8 text-center">
                                    This section was not found in the report.
                                </p>
                            ) : (
                                filteredAnalyses.map((a) => (
                                    <AnalysisArticle
                                        key={a.id}
                                        analysis={a}
                                        onAnalyzeFinding={handleAnalyzeFinding}
                                    />
                                ))
                            )}
                        </section>
                    ) : null}

                    {showLegacyChannels && detailTab !== CROSS_NOTES_TAB_ID ? (
                        <section className="space-y-5">
                            {filteredChannels.length === 0 && detailTab !== "all" ? (
                                <p className="text-sm text-gray-500 rounded-xl border border-gray-200 bg-white px-4 py-8 text-center">
                                    This section was not found in the report.
                                </p>
                            ) : (
                                filteredChannels.map((ch) => (
                                    <ChannelPrioritySection
                                        key={ch.id || ch.label}
                                        channel={ch}
                                        onAnalyzeFinding={handleAnalyzeFinding}
                                    />
                                ))
                            )}
                        </section>
                    ) : null}

                    {showCrossNotesPanel ? (
                        <section
                            className={`rounded-xl border border-gray-200 bg-white p-5 md:p-6 ${
                                detailTab === "all" ? "mt-6" : ""
                            }`}
                        >
                            <h3 className="text-sm font-bold text-gray-800 mb-3">Cross-channel notes</h3>
                            <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
                                {crossChannelNotes.map((n, i) => (
                                    <li key={i}>{n}</li>
                                ))}
                            </ul>
                        </section>
                    ) : null}

                    {showDeveloperDiagnostics && developerDiagnostics ? (
                        <AuditDeveloperDiagnosticsPanel diagnostics={developerDiagnostics} />
                    ) : null}
                </>
            )}

            {followUpOpen && payload && report ? (
                <AuditFollowUpModal
                    onClose={handleCloseFollowUp}
                    customerId={customerId}
                    auditId={payload.auditId}
                    dateRange={payload.dateRange}
                    comparisonDateRange={payload.comparisonDateRange}
                    auditReportSnapshot={report}
                    customerName={payload.customerName || headingLabel}
                    initialFinding={followUpFinding}
                    formatSeverity={formatSeverityLabel}
                />
            ) : null}
        </div>
    );
}
