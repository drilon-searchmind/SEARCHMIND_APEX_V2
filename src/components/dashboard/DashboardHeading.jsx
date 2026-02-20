"use client"

import React, { useState } from "react";
import { LuBrainCircuit } from "react-icons/lu";
import AiAnalysisModal from "../ai-analysis/AiAnalysisModal";
import { useUser } from "@/contexts/UserContext";

export default function DashboardHeading({
    title,
    label,
    right,
    comparisonMethod = "Last Period",
    showAnalyzeWithAi = true,
    customerId,
    dateRange,
    dataSnapshot = {},
    dashboardType = 'other',
    loading = false,
}) {
    const user = useUser();
    const [showAnalyzeWithAiModal, setShowAnalyzeWithAiModal] = useState(false);

    const handleOpenAiModal = () => {
        setShowAnalyzeWithAiModal(true);
    };

    const handleCloseAiModal = () => {
        setShowAnalyzeWithAiModal(false);
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
                {right && (
                    <div 
                        className={`flex flex-col sm:flex-row md:items-center gap-3 md:gap-4 w-full md:w-auto ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {/* Right Component (DateRangePicker, buttons, etc.) */}
                        <div className="flex gap-2">
                            {showAnalyzeWithAi && user?.isAdmin && (
                                <div className="w-full h-full">
                                    <button 
                                        onClick={handleOpenAiModal}
                                        disabled={loading}
                                        className={`w-full shadow-none bg-purple-50 border border-purple-500 text-purple-700 py-2 px-4 text-xs rounded-lg flex items-center gap-2 transition-colors ${
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
