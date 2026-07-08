"use client"

import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { FiDownload, FiClipboard, FiChevronDown } from "react-icons/fi";
import { LuBrainCircuit } from "react-icons/lu";
import AiAnalysisModal from "../ai-analysis/AiAnalysisModal";
import RunAuditModal, { canUserRunAudit } from "./RunAuditModal";
import PdfReportContent from "./PdfReportContent";
import { useUser } from "@/contexts/UserContext";
import { exportElementToPdf } from "@/lib/pdfExport";
import { showToast } from "@/components/ui/ToastProvider";
import { ANALYZE_WITH_AI_ENABLED } from "@/lib/featureFlags";

/**
 * Optional Shopify Markets filter (only passed when enabled for the customer).
 * Checkbox list like Group view: all markets included by default (`excludedMarkets[id] !== true`).
 * @typedef {object} ShopifyMarketFilterProps
 * @property {boolean} loading
 * @property {Array<{ shopifyqlMarketId: string, name: string, handle?: string }>} [options]
 * @property {Record<string, boolean>} excludedMarkets — when `excludedMarkets[id] === true`, that market is excluded
 * @property {(marketId: string, included: boolean) => void} onToggleMarket — `included` true = include in revenue aggregate
 * @property {Record<string, boolean>} [appliedExcludedMarkets] — for button summary (defaults to draft `excludedMarkets`)
 * @property {() => void} [onMenuWillOpen] — copy applied → draft before opening dropdown
 * @property {() => void} [onApplyMarkets] — commit draft; closes menu
 * @property {boolean} [filterAdSpendByMarket] — draft: match Meta/Google spend to selected market countries
 * @property {boolean} [appliedFilterAdSpendByMarket] — applied toggle state for summary
 * @property {(enabled: boolean) => void} [onFilterAdSpendByMarketChange]
 * @typedef {object} AdSpendPlatformFilterProps
 * @property {boolean} [loading=false]
 * @property {Array<{ id: string, label: string }>} [options]
 * @property {Record<string, boolean>} excludedPlatforms — `true` = excluded from aggregates
 * @property {Record<string, boolean>} [appliedExcludedPlatforms]
 * @property {(platformId: string, included: boolean) => void} [onTogglePlatform]
 * @property {() => void} [onMenuWillOpen]
 * @property {() => void} [onApplySpend]
 */

export default function DashboardHeading({
    title,
    label,
    subtitle,
    right,
    comparisonMethod = "Last Year",
    showAnalyzeWithAi = true,
    customerId,
    dateRange,
    dataSnapshot = {},
    dashboardType = 'other',
    loading = false,
    showRight = true,
    showPdfExport = false,
    showRunAudit = true,
    variant = "default",
    /** @type {ShopifyMarketFilterProps | null} */
    shopifyMarketFilter = null,
    /** @type {AdSpendPlatformFilterProps | null} */
    adSpendPlatformFilter = null,
}) {
    const user = useUser();
    const analyzeWithAiActive = ANALYZE_WITH_AI_ENABLED && showAnalyzeWithAi;
    const [showAnalyzeWithAiModal, setShowAnalyzeWithAiModal] = useState(false);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [runAuditOpen, setRunAuditOpen] = useState(false);

    const auditEligible = Boolean(showRunAudit && customerId && canUserRunAudit(user));

    const [shopifyMarketMenuOpen, setShopifyMarketMenuOpen] = useState(false);
    const [adSpendMenuOpen, setAdSpendMenuOpen] = useState(false);
    const shopifyMarketMenuRef = useRef(null);
    const adSpendMenuRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(e) {
            const m = shopifyMarketMenuRef.current?.contains(e.target);
            const s = adSpendMenuRef.current?.contains(e.target);
            if (m || s) return;
            setShopifyMarketMenuOpen(false);
            setAdSpendMenuOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleOpenAiModal = () => {
        setShowAnalyzeWithAiModal(true);
    };

    const handleCloseAiModal = () => {
        setShowAnalyzeWithAiModal(false);
    };

    const handleExportPdf = async () => {
        if (isExportingPdf) return;
        setIsExportingPdf(true);
        const container = document.createElement("div");
        container.style.cssText = "position:fixed;top:0;left:0;width:800px;opacity:0;pointer-events:none;z-index:-1;overflow:auto;";
        document.body.appendChild(container);
        const root = createRoot(container);
        const cleanup = () => {
            try { root.unmount(); } catch (_) {}
            if (container.parentNode) document.body.removeChild(container);
            setIsExportingPdf(false);
        };
        try {
            root.render(
                <PdfReportContent
                    title={title}
                    label={label}
                    dateRange={dateRange}
                    comparisonMethod={comparisonMethod}
                    dataSnapshot={dataSnapshot}
                    dashboardType={dashboardType}
                />
            );
            await new Promise((r) => setTimeout(r, 500));
            const el = container.querySelector("#pdf-report-content");
            if (el) {
                const safeName = (title || "report").replace(/[^a-zA-Z0-9-_]/g, "_");
                const datePart = [dateRange?.startDate, dateRange?.endDate].filter(Boolean).join("_");
                await exportElementToPdf(el, datePart ? `${safeName}_${datePart}` : safeName);
                showToast({ message: "PDF exported successfully", type: "success", position: "top-center" });
            } else {
                showToast({ message: "Could not generate PDF report", type: "error", position: "top-center" });
            }
        } catch (err) {
            console.error("PDF export failed:", err);
            showToast({ message: err?.message || "PDF export failed", type: "error", position: "top-center" });
        } finally {
            cleanup();
        }
    };

    const isCobalt = variant === "cobalt";

    return (
        <div className={isCobalt ? "apex-perf-heading" : "w-full bg-white border border-gray-200 rounded-xl px-4 py-4 md:px-8 md:py-6 mb-8 flex flex-col gap-4 md:gap-6"}>
            {/* Header and Right Content */}
            <div className={isCobalt ? "apex-perf-heading__row" : "flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-6"}>
                {/* Title Section */}
                <div className="flex-1">
                    {label && (
                        <span className={isCobalt ? "apex-perf-heading__label" : "mb-2 inline-block text-xs text-gray-400 bg-gray-50 rounded px-2 py-1"}>
                            {label}
                        </span>
                    )}
                    <h1 className={isCobalt ? "apex-perf-heading__title" : "text-xl md:text-2xl font-bold text-gray-900 mb-0"}>{title}</h1>
                    {subtitle && (
                        <p className={isCobalt ? "apex-perf-heading__subtitle" : "text-sm text-gray-500 mt-1 mb-0"}>{subtitle}</p>
                    )}
                </div>

                {/* Right Section - Responsive */}
                {(showRight &&
                    (right ||
                        shopifyMarketFilter ||
                        adSpendPlatformFilter ||
                        analyzeWithAiActive ||
                        showPdfExport ||
                        auditEligible)) && (
                    <div
                        className={`${isCobalt ? "apex-perf-heading__actions" : "flex flex-col lg:flex-row lg:items-end lg:justify-end gap-3 lg:gap-4 w-full lg:w-auto lg:min-w-0 lg:shrink-0"} ${
                            loading ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                    >
                        <div className={isCobalt ? "apex-perf-heading__btn-row" : "flex flex-wrap items-center justify-end gap-2"}>
                            {auditEligible && (
                                <button
                                    type="button"
                                    onClick={() => setRunAuditOpen(true)}
                                    disabled={loading}
                                    className={isCobalt
                                        ? "apex-perf-btn apex-perf-btn--ghost"
                                        : `inline-flex shrink-0 items-center justify-center border border-[var(--color-primary-searchmind)] text-[var(--color-primary-searchmind)] py-2 px-4 text-xs rounded-lg gap-2 transition-colors bg-white shadow-none ${loading ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"}`}
                                >
                                    <FiClipboard className="text-base shrink-0" aria-hidden />
                                    Run audit
                                </button>
                            )}
                            {showPdfExport && (
                                <button
                                    type="button"
                                    onClick={handleExportPdf}
                                    disabled={loading || isExportingPdf}
                                    className={isCobalt
                                        ? "apex-perf-btn apex-perf-btn--primary"
                                        : `inline-flex shrink-0 items-center justify-center bg-[var(--color-primary-searchmind)] text-white py-2 px-4 text-xs rounded-lg gap-2 transition-colors shadow-none ${loading || isExportingPdf ? "opacity-50 cursor-not-allowed" : "hover:bg-[var(--color-primary-searchmind-hover)]"}`}
                                >
                                    <FiDownload className="text-base shrink-0" />
                                    {isExportingPdf ? "Exporting…" : "Export to PDF"}
                                </button>
                            )}
                            {analyzeWithAiActive && user?.isAdmin && (
                                <button
                                    type="button"
                                    onClick={handleOpenAiModal}
                                    disabled={loading}
                                    className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap bg-purple-50 border border-purple-500 text-purple-700 py-2 px-4 text-xs rounded-lg gap-2 transition-colors shadow-none ${
                                        loading
                                            ? "opacity-50 cursor-not-allowed hover:bg-purple-50"
                                            : "hover:bg-purple-100"
                                    }`}
                                >
                                    <LuBrainCircuit className="text-base shrink-0" />
                                    Analyze with AI
                                </button>
                            )}
                        </div>
                        {(shopifyMarketFilter || adSpendPlatformFilter || right) ? (
                            <div className="flex flex-wrap items-center justify-end gap-2 min-w-0 w-full lg:w-auto">
                                {shopifyMarketFilter ? (
                                    <div
                                        className="inline-flex max-w-full min-w-0 shrink-0 items-center gap-2"
                                        ref={shopifyMarketMenuRef}
                                    >
                                        <span className="text-sm text-gray-600 whitespace-nowrap">
                                            market(s)
                                        </span>
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const next = !shopifyMarketMenuOpen;
                                                    if (next) {
                                                        shopifyMarketFilter.onMenuWillOpen?.();
                                                        setAdSpendMenuOpen(false);
                                                    }
                                                    setShopifyMarketMenuOpen(next);
                                                }}
                                                disabled={loading || shopifyMarketFilter.loading}
                                                className="flex items-center justify-between gap-2 min-w-[140px] px-3 py-2 text-sm text-left bg-white border border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <span className="text-gray-700 truncate">
                                                    {(() => {
                                                        const appl =
                                                            shopifyMarketFilter.appliedExcludedMarkets ??
                                                            shopifyMarketFilter.excludedMarkets ??
                                                            {};
                                                        return (shopifyMarketFilter.options || []).filter(
                                                            (m) =>
                                                                appl[m.shopifyqlMarketId] !== true
                                                        ).length;
                                                    })()}
                                                    {" "}
                                                    of {(shopifyMarketFilter.options || []).length} selected
                                                </span>
                                                <FiChevronDown
                                                    className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${shopifyMarketMenuOpen ? "rotate-180" : ""}`}
                                                />
                                            </button>
                                            {shopifyMarketMenuOpen && (
                                                <div className="absolute right-0 mt-1 flex w-64 flex-col max-h-[min(20rem,calc(100vh-12rem))] rounded-lg border border-gray-200 bg-white shadow-lg z-50 overflow-hidden">
                                                    <div className="overflow-y-auto py-2 flex-1 min-h-0">
                                                    {(shopifyMarketFilter.options || []).length === 0 ? (
                                                        <div className="px-3 py-2 text-sm text-gray-500">
                                                            No markets
                                                        </div>
                                                    ) : (
                                                        (shopifyMarketFilter.options || []).map((m) => {
                                                            const isIncluded =
                                                                shopifyMarketFilter.excludedMarkets?.[
                                                                    m.shopifyqlMarketId
                                                                ] !== true;
                                                            return (
                                                                <label
                                                                    key={m.shopifyqlMarketId}
                                                                    className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isIncluded}
                                                                        onChange={(e) =>
                                                                            shopifyMarketFilter.onToggleMarket?.(
                                                                                m.shopifyqlMarketId,
                                                                                e.target.checked
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            loading ||
                                                                            shopifyMarketFilter.loading
                                                                        }
                                                                        className="rounded border-gray-300 text-[var(--color-primary-searchmind)] focus:ring-[var(--color-primary-searchmind)] shrink-0"
                                                                    />
                                                                    <span className="text-sm text-gray-800 truncate">
                                                                        {m.name}
                                                                    </span>
                                                                </label>
                                                            );
                                                        })
                                                    )}
                                                    </div>
                                                    <div className="border-t border-gray-100 px-3 py-2 bg-gray-50/50 shrink-0">
                                                        <label className="flex items-start gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={
                                                                    shopifyMarketFilter.filterAdSpendByMarket ===
                                                                    true
                                                                }
                                                                onChange={(e) =>
                                                                    shopifyMarketFilter.onFilterAdSpendByMarketChange?.(
                                                                        e.target.checked
                                                                    )
                                                                }
                                                                disabled={
                                                                    loading ||
                                                                    shopifyMarketFilter.loading
                                                                }
                                                                className="mt-0.5 rounded border-gray-300 text-[var(--color-primary-searchmind)] focus:ring-[var(--color-primary-searchmind)] shrink-0"
                                                            />
                                                            <span className="text-xs text-gray-700 leading-snug">
                                                                Filter marketing spend by markets
                                                            </span>
                                                        </label>
                                                    </div>
                                                    <div className="border-t border-gray-100 p-2 bg-gray-50/80 shrink-0">
                                                        <button
                                                            type="button"
                                                            disabled={loading || shopifyMarketFilter.loading}
                                                            onClick={() => {
                                                                shopifyMarketFilter.onApplyMarkets?.();
                                                                setShopifyMarketMenuOpen(false);
                                                            }}
                                                            className="w-full rounded-lg bg-[var(--color-primary-searchmind)] text-white text-xs py-2 px-3 font-medium shadow-none hover:bg-[var(--color-primary-searchmind-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                        >
                                                            Apply
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : null}
                                {adSpendPlatformFilter && (adSpendPlatformFilter.options || []).length > 0 ? (
                                    <div
                                        className="inline-flex max-w-full min-w-0 shrink-0 items-center gap-2"
                                        ref={adSpendMenuRef}
                                    >
                                        <span className="text-sm text-gray-600 whitespace-nowrap">
                                            Adspend
                                        </span>
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const next = !adSpendMenuOpen;
                                                    if (next) {
                                                        adSpendPlatformFilter.onMenuWillOpen?.();
                                                        setShopifyMarketMenuOpen(false);
                                                    }
                                                    setAdSpendMenuOpen(next);
                                                }}
                                                disabled={loading || adSpendPlatformFilter.loading}
                                                className="flex items-center justify-between gap-2 min-w-[140px] px-3 py-2 text-sm text-left bg-white border border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <span className="text-gray-700 truncate">
                                                    {(() => {
                                                        const appl =
                                                            adSpendPlatformFilter.appliedExcludedPlatforms ??
                                                            adSpendPlatformFilter.excludedPlatforms ??
                                                            {};
                                                        return (adSpendPlatformFilter.options || []).filter(
                                                            (c) => appl[c.id] !== true
                                                        ).length;
                                                    })()}
                                                    {" "}
                                                    of {(adSpendPlatformFilter.options || []).length}{" "}
                                                    included
                                                </span>
                                                <FiChevronDown
                                                    className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${adSpendMenuOpen ? "rotate-180" : ""}`}
                                                />
                                            </button>
                                            {adSpendMenuOpen && (
                                                <div className="absolute right-0 mt-1 flex w-64 flex-col max-h-[min(20rem,calc(100vh-12rem))] rounded-lg border border-gray-200 bg-white shadow-lg z-50 overflow-hidden">
                                                    <div className="overflow-y-auto py-2 flex-1 min-h-0">
                                                    {(adSpendPlatformFilter.options || []).map((c) => {
                                                        const included =
                                                            adSpendPlatformFilter.excludedPlatforms?.[c.id] !== true;
                                                        return (
                                                            <label
                                                                key={c.id}
                                                                className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={included}
                                                                    onChange={(e) =>
                                                                        adSpendPlatformFilter.onTogglePlatform?.(
                                                                            c.id,
                                                                            e.target.checked
                                                                        )
                                                                    }
                                                                    disabled={loading || adSpendPlatformFilter.loading}
                                                                    className="rounded border-gray-300 text-[var(--color-primary-searchmind)] focus:ring-[var(--color-primary-searchmind)] shrink-0"
                                                                />
                                                                <span className="text-sm text-gray-800 truncate">
                                                                    {c.label}
                                                                </span>
                                                            </label>
                                                        );
                                                    })}
                                                    </div>
                                                    <div className="border-t border-gray-100 p-2 bg-gray-50/80 shrink-0">
                                                        <button
                                                            type="button"
                                                            disabled={loading || adSpendPlatformFilter.loading}
                                                            onClick={() => {
                                                                adSpendPlatformFilter.onApplySpend?.();
                                                                setAdSpendMenuOpen(false);
                                                            }}
                                                            className="w-full rounded-lg bg-[var(--color-primary-searchmind)] text-white text-xs py-2 px-3 font-medium shadow-none hover:bg-[var(--color-primary-searchmind-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                        >
                                                            Apply
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : null}
                                {right}
                            </div>
                        ) : null}
                    </div>
                )}
            </div>

            {auditEligible ? (
                <RunAuditModal
                    open={runAuditOpen}
                    onClose={() => setRunAuditOpen(false)}
                    customerId={customerId}
                    dateRange={dateRange}
                    dataSnapshot={dataSnapshot}
                />
            ) : null}

            {analyzeWithAiActive && showAnalyzeWithAiModal && (
                <AiAnalysisModal 
                    onClose={handleCloseAiModal}
                    customerId={customerId}
                    dateRange={dateRange}
                    comparisonMethod={comparisonMethod}
                    dataSnapshot={dataSnapshot}
                    dashboardType={dashboardType}
                />
            )}
        </div>
    );
}
