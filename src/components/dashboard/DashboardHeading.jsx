import React, { useState } from "react";

export default function DashboardHeading({ title, label, right, showComparisonMethodToggler = false, comparisonMethod, onComparisonMethodChange }) {
    const [toggleComparisonMethod, setToggleComparisonMethod] = useState("Last Period");

    const currentMethod = comparisonMethod || toggleComparisonMethod;
    const setMethod = onComparisonMethodChange || setToggleComparisonMethod;

    return (
        <div className="w-full bg-white border border-gray-200 rounded-xl px-4 py-4 md:px-8 md:py-6 mb-8 flex flex-col gap-4 md:gap-6">
            {/* Header and Right Content */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-6">
                {/* Title Section */}
                <div className="flex-1">
                    {label && <span className="mb-2 inline-block text-xs text-gray-400 bg-gray-50 rounded px-2 py-1">{label}</span>}
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-0">{title}</h1>
                </div>

                {/* Right Section - Responsive */}
                {right && (
                    <div className="flex flex-col sm:flex-row md:items-center gap-3 md:gap-4 w-full md:w-auto">
                        {showComparisonMethodToggler && (
                            <div id="dateComparisonToggler" className="w-full sm:w-auto order-2 md:order-1">
                                <div className="flex border border-gray-200 bg-gray-100 rounded-lg overflow-hidden">
                                    <button
                                        className={`flex-1 sm:flex-none px-3 sm:px-4 py-1 text-xs sm:text-sm font-medium focus:outline-none transition-colors duration-150 ${currentMethod === 'Last Year' ? 'bg-white text-[var(--color-primary-searchmind)] shadow-sm' : 'text-gray-500 hover:text-[var(--color-primary-searchmind)]'}`}
                                        style={{ borderRadius: '8px 0 0 8px' }}
                                        onClick={() => setMethod('Last Year')}
                                    >
                                        Last Year
                                    </button>
                                    <button
                                        className={`flex-1 sm:flex-none px-3 sm:px-4 py-1 text-xs sm:text-sm font-medium focus:outline-none transition-colors duration-150 ${currentMethod === 'Last Period' ? 'bg-white text-[var(--color-primary-searchmind)] shadow-sm' : 'text-gray-500 hover:text-[var(--color-primary-searchmind)]'}`}
                                        style={{ borderRadius: '0 8px 8px 0' }}
                                        onClick={() => setMethod('Last Period')}
                                    >
                                        Last Period
                                    </button>
                                </div>
                            </div>
                        )}
                        {/* Right Component (DateRangePicker, buttons, etc.) */}
                        <div className="order-1 md:order-2">
                            {right}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
