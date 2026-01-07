import React, { useState } from "react";

export default function DashboardHeading({ title, label, right, showComparisonMethodToggler = false, comparisonMethod, onComparisonMethodChange }) {
    const [toggleComparisonMethod, setToggleComparisonMethod] = useState("Last Period");

    const currentMethod = comparisonMethod || toggleComparisonMethod;
    const setMethod = onComparisonMethodChange || setToggleComparisonMethod;

    return (
        <div className="w-full bg-white border border-gray-200 rounded-xl px-8 py-6 mb-8 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-end justify-between w-full ">
                <div>
                    {label && <span className="mb-4 inline-block text-xs text-gray-400 bg-gray-50 rounded px-2 py-1 ">{label}</span>}
                    <h1 className="text-2xl font-bold text-gray-900 mb-0">{title}</h1>

                </div>
                {right &&
                    <div className="flex items-center gap-4">
                        {showComparisonMethodToggler && (
                            <div id="dateComparisonToggler">
                                <div className="flex border border-gray-200 bg-gray-100 rounded-lg overflow-hidden">
                                    <button
                                        className={`px-4 py-1 text-sm font-medium focus:outline-none transition-colors duration-150 ${currentMethod === 'Last Year' ? 'bg-white text-[var(--color-primary-searchmind)] shadow-sm' : 'text-gray-500 hover:text-[var(--color-primary-searchmind)]'}`}
                                        style={{ borderRadius: '8px 0 0 8px' }}
                                        onClick={() => setMethod('Last Year')}
                                    >
                                        Last Year
                                    </button>
                                    <button
                                        className={`px-4 py-1 text-sm font-medium focus:outline-none transition-colors duration-150 ${currentMethod === 'Last Period' ? 'bg-white text-[var(--color-primary-searchmind)] shadow-sm' : 'text-gray-500 hover:text-[var(--color-primary-searchmind)]'}`}
                                        style={{ borderRadius: '0 8px 8px 0' }}
                                        onClick={() => setMethod('Last Period')}
                                    >
                                        Last Period
                                    </button>
                                </div>
                            </div>
                        )}
                        {right}
                    </div>
                }
            </div>
        </div>
    );
}
