import React from "react";

export default function VerticalTabs({ tabs, activeTab, onTabChange }) {
    return (
        <div className="apex-config-tabs">
            <nav className="apex-config-tabs__nav" aria-label="Configuration sections">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        className={`apex-config-tabs__btn${activeTab === tab.key ? " is-active" : ""}`}
                        onClick={() => onTabChange(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>
            <div className="apex-config-tabs__content">
                {tabs.find((tab) => tab.key === activeTab)?.content}
            </div>
        </div>
    );
}
