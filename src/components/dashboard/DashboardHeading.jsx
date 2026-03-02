"use client"

import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { FiDownload } from "react-icons/fi";
import { LuBrainCircuit } from "react-icons/lu";
import AiAnalysisModal from "../ai-analysis/AiAnalysisModal";
import PdfReportContent from "./PdfReportContent";
import { useUser } from "@/contexts/UserContext";
import { exportElementToPdf } from "@/lib/pdfExport";
import { showToast } from "@/components/ui/ToastProvider";

export default function DashboardHeading({
    title,
    label,
    right,
    comparisonMethod = "Last Year",
    showAnalyzeWithAi = true,
    customerId,
    dateRange,
    dataSnapshot = {},
    dashboardType = 'other',
    loading = false,
    showRight = true,
    showPdfExport = true,
}) {
    const user = useUser();
    const [showAnalyzeWithAiModal, setShowAnalyzeWithAiModal] = useState(false);
    const [isExportingPdf, setIsExportingPdf] = useState(false);

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

    return (
        <div className="w-full bg-white border border-gray-200 rounded-xl px-4 py-4 md:px-8 md:py-6 mb-8 flex flex-col gap-4 md:gap-6">
            {/* Header and Right Content */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-6">
                {/* Title Section */}
                <div className="flex-1">
                    {label && <span className="mb-2 inline-block text-xs text-gray-400 bg-gray-50 rounded px-2 py-1">{label}</span>}
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-0">{title}</h1>
                </div>

                {/* Right Section - Responsive */}
                {(showRight && (right || showAnalyzeWithAi)) && (
                    <div 
                        className={`flex flex-col sm:flex-row md:items-center gap-3 md:gap-4 w-full md:w-auto ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {/* Right Component (DateRangePicker, buttons, etc.) */}
                        <div className="flex gap-2">
                            {showPdfExport && (
                                <button
                                    type="button"
                                    onClick={handleExportPdf}
                                    disabled={loading || isExportingPdf}
                                    className={`w-full shadow-none bg-[var(--color-primary-searchmind)] text-white py-2 px-4 text-xs rounded-lg flex items-center gap-2 transition-colors ${
                                        loading || isExportingPdf
                                            ? "opacity-50 cursor-not-allowed"
                                            : "hover:bg-[var(--color-primary-searchmind-hover)]"
                                    }`}
                                >
                                    <FiDownload className="text-base" />
                                    {isExportingPdf ? "Exporting…" : "Export to PDF"}
                                </button>
                            )}
                            {showAnalyzeWithAi && user?.isAdmin && (
                                <div className="w-full h-full">
                                    <button 
                                        onClick={handleOpenAiModal}
                                        disabled={loading}
                                        className={`whitespace-nowrap w-full shadow-none bg-purple-50 border border-purple-500 text-purple-700 py-2 px-4 text-xs rounded-lg flex items-center gap-2 transition-colors ${
                                            loading 
                                                ? 'opacity-50 cursor-not-allowed hover:bg-purple-50' 
                                                : 'hover:bg-purple-100'
                                        }`}
                                    >
                                        <LuBrainCircuit className="text-base" />
                                        Analyze with AI
                                    </button>
                                </div>
                            )}
                            {right}
                        </div>
                    </div>
                )}
            </div>

            {showAnalyzeWithAiModal && (
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
