"use client";

import React, { useState, useMemo } from "react";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import {
    FiSearch,
    FiTrendingUp,
    FiActivity,
    FiBarChart2,
    FiGrid,
    FiChevronRight,
    FiExternalLink,
    FiUsers,
    FiImage,
    FiFileText,
    FiClock,
    FiLayers,
} from "react-icons/fi";
import { TOOLS, TOOL_CATEGORIES } from "./toolsData";

// Category colors (from globals.css) — used for tags when filter is active
const CATEGORY_COLORS = {
    analytics: "bg-[var(--color-primary-searchmind)]/10 text-[var(--color-primary-searchmind)]",
    collaboration: "bg-[var(--color-primary-searchmind-lighter)]/15 text-[var(--color-primary-searchmind-lighter)]",
    design: "bg-[var(--color-secondary-searchmind)]/60 text-[var(--color-dark-green)]",
    productivity: "bg-[var(--color-lime)]/30 text-[var(--color-green)]",
    ppc: "bg-[var(--color-light-green)]/25 text-[var(--color-green)]",
    ps: "bg-[var(--color-light-natural)] text-[var(--color-dark-green)]",
    seo: "bg-[var(--color-dark-natural)]/80 text-[var(--color-primary-searchmind)]",
    em: "bg-[var(--color-primary-searchmind-lighter)]/20 text-[var(--color-primary-searchmind)]",
};

const TAG_DEFAULT = "bg-gray-100 text-gray-600";

const ICON_MAP = {
    FiTrendingUp,
    FiActivity,
    FiBarChart2,
    FiGrid,
    FiUsers,
    FiImage,
    FiFileText,
    FiClock,
    FiLayers,
};

function ToolCard({ tool, activeCategory }) {
    const Icon = ICON_MAP[tool.icon] || FiGrid;
    const hasPreviewImage = tool.previewImage;

    return (
        <a
            href={tool.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-[var(--color-primary-searchmind)]/40 hover:shadow-lg transition-all duration-200"
        >
            {/* Preview image or placeholder */}
            <div
                className={`relative h-40 flex items-center justify-center overflow-hidden ${
                    hasPreviewImage ? "bg-gray-100" : "bg-gray-100"
                }`}
            >
                {hasPreviewImage ? (
                    <img
                        src={tool.previewImage}
                        alt={tool.title}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                ) : (
                    <div className="w-16 h-16 rounded-xl bg-gray-200 flex items-center justify-center">
                        <Icon className="w-8 h-8 text-gray-500" />
                    </div>
                )}
                {tool.badge && (
                    <span className="absolute top-3 right-3 text-xs font-medium bg-white border border-gray-200 text-gray-700 px-2 py-1 rounded">
                        {tool.badge}
                    </span>
                )}
            </div>

            <div className="p-5">
                <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-[var(--color-primary-searchmind)] transition-colors">
                    {tool.title}
                </h3>
                <p className="text-sm text-gray-500 line-clamp-2 mb-4">{tool.description}</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                    {tool.tags.slice(0, 4).map((tag) => (
                        <span
                            key={tag}
                            className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                                activeCategory && activeCategory !== "all" ? CATEGORY_COLORS[tool.category] || TAG_DEFAULT : TAG_DEFAULT
                            }`}
                        >
                            {tag}
                        </span>
                    ))}
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary-searchmind)] group-hover:gap-2 transition-all">
                    Visit
                    <FiExternalLink className="w-4 h-4" />
                </span>
            </div>
        </a>
    );
}

export default function OurToolsPage() {
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("all");

    const filteredTools = useMemo(() => {
        let list = TOOLS;
        if (category !== "all") {
            list = list.filter((t) => t.category === category);
        }
        if (search.trim()) {
            const q = search.toLowerCase().trim();
            list = list.filter(
                (t) =>
                    t.title.toLowerCase().includes(q) ||
                    t.description.toLowerCase().includes(q) ||
                    t.tags.some((tag) => tag.toLowerCase().includes(q))
            );
        }
        return list;
    }, [search, category]);

    return (
        <div id="OurToolsPage" className="w-full">
            <DashboardHeading
                title="Our Tools"
                label="External Tools"
                showRight={false}
                showPdfExport={false}
            />

            <div className="flex flex-col gap-6">
                {/* Search + Filters */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <div className="relative flex-1">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search tools..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)]/30 focus:border-[var(--color-primary-searchmind)]"
                            />
                        </div>

                        {/* Category filters */}
                        <div className="flex flex-wrap gap-2">
                            {TOOL_CATEGORIES.map((cat) => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setCategory(cat.id)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        category === cat.id
                                            ? "bg-[var(--color-primary-searchmind)] text-white"
                                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    }`}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Results count */}
                <p className="text-sm text-gray-500">
                    {filteredTools.length} tool{filteredTools.length !== 1 ? "s" : ""} found
                </p>

                {/* Tool grid */}
                {filteredTools.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredTools.map((tool) => (
                            <ToolCard key={tool.id} tool={tool} activeCategory={category} />
                        ))}
                    </div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                        <FiSearch className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-700 mb-2">No tools found</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Try adjusting your search or filter to find what you need.
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                setSearch("");
                                setCategory("all");
                            }}
                            className="text-sm font-medium text-[var(--color-primary-searchmind)] hover:underline"
                        >
                            Clear filters
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
