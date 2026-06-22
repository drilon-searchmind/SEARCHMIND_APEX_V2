import React from "react";

export default function VerticalTabs({ tabs = [], activeTab, onTabChange }) {
    return (
        <div className="apex-admin-tabs">
            <nav className="apex-admin-tabs__nav" aria-label="Admin sections">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        className={`apex-admin-tabs__btn${activeTab === tab.key ? " is-active" : ""}`}
                        onClick={() => onTabChange?.(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>
            <div className="apex-admin-tabs__content">
                {tabs.find((t) => t.key === activeTab)?.content}
            </div>
        </div>
    );
}
