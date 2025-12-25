import React from "react";

export default function VerticalTabs({ tabs, activeTab, onTabChange }) {
    return (
        <div className="flex w-full">
            {/* Tabs */}
            <div className="flex flex-col min-w-[250px] border-r border-gray-200 bg-gray-50 rounded-l-xl py-6 px-6">
                {tabs.map((tab, idx) => (
                    <button
                        key={tab.key}
                        className={`text-left px-4 py-3 rounded-lg mb-1 font-semibold transition-colors ${activeTab === tab.key
                                ? "bg-[var(--color-primary-searchmind-lighter-opacity)] text-[var(--color-primary-searchmind)]"
                                : "text-gray-500 hover:bg-gray-100"
                            }`}
                        onClick={() => onTabChange(tab.key)}
                        style={{ outline: "none" }}
                    >
                        <h6 className="text-sm">{tab.label}</h6>
                    </button>
                ))}
            </div>
            {/* Content */}
            <div className="flex-1 bg-white rounded-r-xl p-8 min-h-[320px]">
                {tabs.find((tab) => tab.key === activeTab)?.content}
            </div>
        </div>
    );
}
