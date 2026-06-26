"use client";

import React from "react";
import { FiFilter, FiTag, FiTarget } from "react-icons/fi";
import { appliedFiltersForSection } from "@/lib/seoKeywordFilters";

const FILTER_ICONS = {
    brand: FiTag,
    exact: FiTarget,
    partial: FiFilter,
};

export default function SeoAppliedFilterBadges({ sectionId, appliedFilters = [] }) {
    const filters = appliedFiltersForSection(sectionId, appliedFilters);
    if (!filters.length) return null;

    return (
        <div className="apex-seo-filter-badges" aria-label="Active keyword filters">
            {filters.map((filter) => {
                const Icon = FILTER_ICONS[filter.type] || FiFilter;
                return (
                    <span
                        key={`${filter.type}-${filter.id}`}
                        className={`apex-seo-filter-badge is-${filter.type}`}
                        title={`Filter: ${filter.name}`}
                    >
                        <Icon aria-hidden />
                        {filter.name}
                    </span>
                );
            })}
        </div>
    );
}
