"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { FiArrowLeft, FiClipboard } from "react-icons/fi";
import DashboardHeading from "@/components/dashboard/DashboardHeading";

const STORAGE_PREFIX = "apex_audit:";

function severityStyles(s) {
    const x = String(s || "").toLowerCase();
    if (x === "critical") return "bg-red-50 text-red-800 border-red-200";
    if (x === "high") return "bg-orange-50 text-orange-800 border-orange-200";
    if (x === "medium") return "bg-amber-50 text-amber-900 border-amber-200";
    return "bg-gray-50 text-gray-700 border-gray-200";
}

function gradeFromNumericScore(score) {
    if (score == null || !Number.isFinite(Number(score))) return "—";
    const s = Number(score);
    if (s >= 90) return "A";
    if (s >= 75) return "B";
    if (s >= 60) return "C";
    if (s >= 40) return "D";
    return "F";
}

function aggregateChannels(channels) {
    const nums = (channels || [])
        .map((c) => c.healthScore)
        .filter((n) => n != null && Number.isFinite(Number(n)))
        .map(Number);
    if (nums.length === 0) return { avg: null, grade: "—" };
    const avg = Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
    return { avg, grade: gradeFromNumericScore(avg) };
}

/**
 * Three tiers aligned to 25 / 75 (50 marks the midpoint of orange): red, orange, green.
 */
function scoreTierClasses(score) {
    if (score == null || !Number.isFinite(Number(score))) {
        return {
            pill: "border border-gray-200 bg-gray-50 text-gray-800",
            gradeWrap: "border border-gray-200 bg-white text-gray-800",
            gradeAccent: "text-[var(--color-primary-searchmind)]",
        };
    }
    const s = Number(score);
    if (s >= 75) {
        return {
            pill: "border border-emerald-300 bg-emerald-50 text-emerald-900",
            gradeWrap: "border border-emerald-200 bg-emerald-50/60 text-emerald-900",
            gradeAccent: "text-emerald-800",
        };
    }
    if (s >= 25) {
        return {
            pill: "border border-orange-300 bg-orange-50 text-orange-900",
            gradeWrap: "border border-orange-200 bg-orange-50/60 text-orange-900",
            gradeAccent: "text-orange-800",
        };
    }
    return {
        pill: "border border-red-300 bg-red-50 text-red-900",
        gradeWrap: "border border-red-200 bg-red-50/60 text-red-900",
        gradeAccent: "text-red-800",
    };
}

/** Large pill + grade chip: rounded-lg, no shadow, tiered colors. */
function ScoreHighlight({ score, gradeLabel, size = "lg" }) {
    const isLg = size === "lg";
    const grade = gradeLabel ?? gradeFromNumericScore(score);
    const tier = scoreTierClasses(score);

    /** Grade chip tracks same numeric tiers when score exists; neutral when missing. */
    const gradeTier =
        score != null && Number.isFinite(Number(score))
            ? tier
            : scoreTierClasses(null);

    return (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span
                className={`inline-flex min-h-[3rem] items-center justify-center rounded-lg font-bold tabular-nums ${tier.pill} ${
                    isLg ? "min-w-[4.5rem] px-5 py-3 text-3xl sm:text-4xl" : "min-w-[3.5rem] px-4 py-2 text-2xl sm:text-3xl"
                }`}
            >
                {score != null ? score : "—"}
            </span>
            <span
                className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold ${gradeTier.gradeWrap}`}
            >
                Grade{" "}
                <span className={`ml-1.5 tabular-nums ${gradeTier.gradeAccent}`}>{grade}</span>
            </span>
        </div>
    );
}

function ScoreMetricCard({ title, score, gradeLabel }) {
    return (
        <div className="flex flex-1 flex-col rounded-xl border border-gray-200 bg-white overflow-hidden min-w-[140px] max-w-[220px] sm:max-w-none">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                <div className="text-xs font-medium text-gray-500 mb-3 truncate" title={title}>
                    {title}
                </div>
                <ScoreHighlight score={score} gradeLabel={gradeLabel} size="sm" />
            </div>
        </div>
    );
}

export default function AuditReportClient() {
    const params = useParams();
    const searchParams = useSearchParams();
    const customerId = params?.customerId;
    const auditId = searchParams.get("audit_id");

    const { payload, loadError } = useMemo(() => {
        if (typeof window === "undefined") {
            return { payload: null, loadError: null };
        }
        if (!auditId || !customerId) {
            return { payload: null, loadError: "Missing audit or customer." };
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
    }, [auditId, customerId]);

    const report = payload?.report;
    const channels = useMemo(() => {
        const r = payload?.report;
        return Array.isArray(r?.channels) ? r.channels : [];
    }, [payload]);

    const headingLabel = payload?.customerName || "Audit";

    const { avg: aggregateScore, grade: aggregateGrade } = useMemo(
        () => aggregateChannels(channels),
        [channels]
    );

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
                    <Link
                        href={`/dashboard/${customerId}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-searchmind)]"
                    >
                        <FiArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                        Back to dashboard
                    </Link>
                }
            />

            {loadError ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-900 mb-8">
                    <p>{loadError}</p>
                    {customerId ? (
                        <Link
                            href={`/dashboard/${customerId}`}
                            className="mt-4 inline-block text-sm font-semibold text-[var(--color-primary-searchmind)] underline"
                        >
                            Go back
                        </Link>
                    ) : null}
                </div>
            ) : !payload ? (
                <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
                    Loading…
                </div>
            ) : (
                <>
                    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 md:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Audit ID</p>
                                <p className="font-mono text-sm text-gray-800">{payload.auditId}</p>
                            </div>
                            <div className="text-right text-sm text-gray-600">
                                <p>
                                    <span className="font-semibold text-gray-500">Period:</span>{" "}
                                    {payload.dateRange?.startDate} → {payload.dateRange?.endDate}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                    Generated {new Date(payload.generatedAt).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>

                    <section className="mb-8 rounded-xl border border-gray-200 bg-white p-5 md:p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <FiClipboard className="h-5 w-5 text-[var(--color-primary-searchmind)] shrink-0" aria-hidden />
                            Executive summary
                        </h2>

                        <div className="mb-6 flex flex-wrap gap-4 items-stretch">
                            <div className="flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden min-w-[min(100%,220px)] flex-[1.15]">
                                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 h-full">
                                    <div className="text-sm font-medium text-gray-500 mb-1">Overall health</div>
                                    <div className="text-[0.65rem] text-gray-400 mb-3">Average across audited channels</div>
                                    <ScoreHighlight score={aggregateScore} gradeLabel={aggregateGrade} size="lg" />
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-4 flex-1 min-w-0 justify-start">
                                {channels.map((ch) => (
                                    <ScoreMetricCard
                                        key={ch.id || ch.label}
                                        title={ch.label || ch.id}
                                        score={ch.healthScore}
                                        gradeLabel={ch.grade != null ? String(ch.grade) : gradeFromNumericScore(ch.healthScore)}
                                    />
                                ))}
                            </div>
                        </div>

                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {report?.executiveSummary || "—"}
                        </p>
                        {report?.methodologyNote ? (
                            <p className="mt-3 text-xs text-gray-400 border-t border-gray-100 pt-3">
                                {report.methodologyNote}
                            </p>
                        ) : null}
                    </section>

                    <div className="grid gap-6 lg:grid-cols-2">
                        {channels.map((ch) => (
                            <section
                                key={ch.id || ch.label}
                                className="rounded-xl border border-gray-200 bg-white p-5 md:p-6 flex flex-col"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4 mb-4">
                                    <h3 className="text-base font-bold text-gray-900">{ch.label || ch.id}</h3>
                                    <ScoreHighlight
                                        score={ch.healthScore}
                                        gradeLabel={ch.grade != null ? String(ch.grade) : gradeFromNumericScore(ch.healthScore)}
                                        size="sm"
                                    />
                                </div>
                                <p className="text-sm text-gray-600 mb-4">{ch.summary || ""}</p>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                    Top priorities
                                </p>
                                <ul className="space-y-3 flex-1">
                                    {(Array.isArray(ch.topPriorities) ? ch.topPriorities : []).map((p, i) => (
                                        <li
                                            key={i}
                                            className={`rounded-lg border px-3 py-2 ${severityStyles(p.severity)}`}
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <span className="font-semibold text-sm">{p.title}</span>
                                                <span className="text-[0.65rem] font-bold uppercase tracking-wide opacity-90">
                                                    {p.severity || "—"}
                                                </span>
                                            </div>
                                            {p.rationale ? (
                                                <p className="mt-1 text-xs opacity-90">{p.rationale}</p>
                                            ) : null}
                                            {p.recommendedAction ? (
                                                <p className="mt-2 text-xs font-medium border-t border-black/5 pt-2">
                                                    Action: {p.recommendedAction}
                                                </p>
                                            ) : null}
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>

                    {Array.isArray(report?.crossChannelNotes) && report.crossChannelNotes.length > 0 ? (
                        <section className="mt-8 rounded-xl border border-gray-200 bg-gray-50/80 p-5 md:p-6">
                            <h3 className="text-sm font-bold text-gray-800 mb-3">Cross-channel</h3>
                            <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
                                {report.crossChannelNotes.map((n, i) => (
                                    <li key={i}>{n}</li>
                                ))}
                            </ul>
                        </section>
                    ) : null}
                </>
            )}
        </div>
    );
}
