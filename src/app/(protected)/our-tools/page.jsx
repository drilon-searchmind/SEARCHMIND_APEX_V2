"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/Spinner";
import { showToast } from "@/components/ui/ToastProvider";
import {
    FiSearch,
    FiTrendingUp,
    FiActivity,
    FiBarChart2,
    FiGrid,
    FiExternalLink,
    FiUsers,
    FiImage,
    FiFileText,
    FiClock,
    FiLayers,
    FiEdit2,
    FiTrash2,
    FiList,
} from "react-icons/fi";
import { inlineTagStyle } from "@/components/content-tags/tagPresets";
import { TOOL_CATEGORIES } from "./toolsData";
import ToolItemModal from "./components/ToolItemModal";

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
    FiSearch,
};

function hasVisitUrl(url) {
    const u = (url || "").trim();
    return /^https?:\/\//i.test(u);
}

function ToolCard({ tool, onEdit, onDelete, tagMeta = {} }) {
    const Icon = ICON_MAP[tool.icon] || FiGrid;
    const bgUrl = (tool.backgroundImage || "").trim();
    const previewUrl = (tool.previewImage || "").trim();
    const showImageLayer = Boolean(previewUrl && !bgUrl);
    const showPlaceholder = !bgUrl && !previewUrl;

    const inner = (
        <>
            <div
                className={`relative h-40 shrink-0 flex items-center justify-center overflow-hidden ${
                    bgUrl || previewUrl ? "bg-gray-100" : "bg-gray-100"
                }`}
                style={
                    bgUrl
                        ? {
                              backgroundImage: `url(${bgUrl})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                          }
                        : undefined
                }
            >
                {showImageLayer && (
                    <img
                        src={previewUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                )}
                {showPlaceholder && (
                    <div className="w-16 h-16 rounded-xl bg-gray-200 flex items-center justify-center">
                        <Icon className="w-8 h-8 text-gray-500" />
                    </div>
                )}
                {tool.badge && (
                    <span className="absolute top-3 right-3 text-xs font-medium bg-white border border-gray-200 text-gray-700 px-2 py-1 rounded z-[1]">
                        {tool.badge}
                    </span>
                )}
            </div>

            <div className="p-5 flex-1 flex flex-col min-h-0">
                <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 min-h-[3.25rem] group-hover:text-[var(--color-primary-searchmind)] transition-colors">
                    {tool.title}
                </h3>
                <p className="text-sm text-gray-500 line-clamp-2 mb-4 min-h-[2.5rem]">{tool.description}</p>
                <div className="flex flex-wrap gap-1.5 flex-1 items-start content-start">
                    {(tool.tags || []).slice(0, 4).map((slug) => {
                        const meta = tagMeta[slug];
                        const label = meta?.label || slug;
                        return (
                            <span
                                key={slug}
                                className="text-xs px-2 py-0.5 rounded-md font-medium"
                                style={inlineTagStyle(meta?.color)}
                            >
                                {label}
                            </span>
                        );
                    })}
                </div>
                <div className="mt-auto pt-4">
                    {hasVisitUrl(tool.url) ? (
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary-searchmind)] group-hover:gap-2 transition-all">
                            Visit
                            <FiExternalLink className="w-4 h-4" />
                        </span>
                    ) : (
                        <span className="text-sm text-gray-400">No link — edit to add a URL</span>
                    )}
                </div>
            </div>
        </>
    );

    const shellClass =
        "group flex flex-col h-full min-h-0 bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-[var(--color-primary-searchmind)]/40 hover:shadow-lg transition-all duration-200 text-left w-full";

    return (
        <div className="relative h-full min-h-0">
            <div className="absolute top-3 left-3 z-[2] flex gap-1">
                <button
                    type="button"
                    className="p-2 rounded-lg bg-white/95 border border-gray-200 text-gray-600 hover:text-[var(--color-primary-searchmind)] shadow-sm"
                    aria-label="Edit tool"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onEdit(tool);
                    }}
                >
                    <FiEdit2 className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    className="p-2 rounded-lg bg-white/95 border border-gray-200 text-gray-600 hover:text-red-600 shadow-sm"
                    aria-label="Delete tool"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDelete(tool);
                    }}
                >
                    <FiTrash2 className="w-4 h-4" />
                </button>
            </div>

            {hasVisitUrl(tool.url) ? (
                <a
                    href={tool.url.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={shellClass}
                >
                    {inner}
                </a>
            ) : (
                <div className={shellClass}>{inner}</div>
            )}
        </div>
    );
}

function ToolListRow({ tool, onEdit, onDelete, tagMeta = {} }) {
    const Icon = ICON_MAP[tool.icon] || FiGrid;
    const bgUrl = (tool.backgroundImage || "").trim();
    const previewUrl = (tool.previewImage || "").trim();
    const catLabel =
        TOOL_CATEGORIES.find((c) => c.id === tool.category)?.label || tool.category;

    const thumb = (
        <div
            className="h-20 w-20 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center shrink-0"
            style={
                bgUrl
                    ? {
                          backgroundImage: `url(${bgUrl})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                      }
                    : undefined
            }
        >
            {previewUrl && !bgUrl ? (
                <img src={previewUrl} alt="" className="w-full h-full object-cover" />
            ) : null}
            {!bgUrl && !previewUrl ? <Icon className="w-8 h-8 text-gray-400" /> : null}
        </div>
    );

    return (
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 bg-white border border-gray-200 rounded-xl p-4 min-h-[5.5rem] hover:border-[var(--color-primary-searchmind)]/35 hover:shadow-md transition-all pr-24">
            <div className="absolute top-3 right-3 flex gap-1">
                <button
                    type="button"
                    className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:text-[var(--color-primary-searchmind)] shadow-sm"
                    aria-label="Edit tool"
                    onClick={() => onEdit(tool)}
                >
                    <FiEdit2 className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:text-red-600 shadow-sm"
                    aria-label="Delete tool"
                    onClick={() => onDelete(tool)}
                >
                    <FiTrash2 className="w-4 h-4" />
                </button>
            </div>

            {thumb}

            <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_auto] sm:gap-6 sm:items-center w-full">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-gray-900 line-clamp-1">{tool.title}</h3>
                        {tool.badge ? (
                            <span className="text-[0.65rem] font-medium bg-gray-50 border border-gray-200 text-gray-700 px-1.5 py-0.5 rounded">
                                {tool.badge}
                            </span>
                        ) : null}
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2 mt-1">{tool.description}</p>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-2 sm:mt-0">
                    {(tool.tags || []).map((slug) => {
                        const meta = tagMeta[slug];
                        const label = meta?.label || slug;
                        return (
                            <span
                                key={slug}
                                className="text-xs px-2 py-0.5 rounded-md font-medium"
                                style={inlineTagStyle(meta?.color)}
                            >
                                {label}
                            </span>
                        );
                    })}
                </div>

                <div className="flex flex-row sm:flex-col sm:items-end gap-2 mt-2 sm:mt-0 shrink-0">
                    <span className="text-[0.7rem] font-semibold text-gray-500 whitespace-nowrap">{catLabel}</span>
                    {hasVisitUrl(tool.url) ? (
                        <a
                            href={tool.url.trim()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary-searchmind)]"
                        >
                            Visit
                            <FiExternalLink className="w-4 h-4" />
                        </a>
                    ) : (
                        <span className="text-xs text-gray-400">No link</span>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function OurToolsPage() {
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("all");
    const [tagFilter, setTagFilter] = useState(null);
    const [viewMode, setViewMode] = useState("grid");
    const [contentTags, setContentTags] = useState([]);
    const [tools, setTools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toolModal, setToolModal] = useState(null);

    const loadTools = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/our-tools");
            if (res.status === 401) {
                showToast({
                    message: "You need to be signed in to view tools.",
                    type: "error",
                    position: "top-center",
                });
                setTools([]);
                return;
            }
            if (!res.ok) throw new Error("Failed to load tools");
            const data = await res.json();
            setTools(Array.isArray(data) ? data : []);
        } catch {
            showToast({
                message: "Failed to load tools",
                type: "error",
                position: "top-center",
            });
            setTools([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTools();
    }, [loadTools]);

    useEffect(() => {
        (async () => {
            try {
                const r = await fetch("/api/content-tags?scope=tools");
                const d = await r.json();
                if (r.ok) setContentTags(Array.isArray(d.tags) ? d.tags : []);
            } catch {
                setContentTags([]);
            }
        })();
    }, []);

    const tagMeta = useMemo(() => {
        const m = Object.create(null);
        for (const t of contentTags) {
            m[t.slug] = { label: t.label, color: t.color };
        }
        return m;
    }, [contentTags]);

    const filteredTools = useMemo(() => {
        let list = tools;
        if (category !== "all") {
            list = list.filter((t) => t.category === category);
        }
        if (tagFilter) {
            list = list.filter((t) => (t.tags || []).includes(tagFilter));
        }
        if (search.trim()) {
            const q = search.toLowerCase().trim();
            list = list.filter(
                (t) =>
                    (t.title || "").toLowerCase().includes(q) ||
                    (t.description || "").toLowerCase().includes(q) ||
                    (t.tags || []).some((slug) => {
                        const lab = (tagMeta[slug]?.label || "").toLowerCase();
                        return (slug || "").toLowerCase().includes(q) || lab.includes(q);
                    })
            );
        }
        return list;
    }, [search, category, tagFilter, tools, tagMeta]);

    const handleSaveTool = async (payload) => {
        const isEdit = toolModal?.mode === "edit" && toolModal?.tool;
        const url = isEdit ? `/api/our-tools/${toolModal.tool.id}` : "/api/our-tools";
        const method = isEdit ? "PUT" : "POST";
        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const errBody = await res.json().catch(() => ({}));
        if (!res.ok) {
            showToast({
                message: errBody.error || "Could not save tool",
                type: "error",
                position: "top-center",
            });
            throw new Error(errBody.error || "save failed");
        }
        showToast({
            message: isEdit ? "Tool updated" : "Tool added",
            type: "success",
            position: "top-center",
        });
        await loadTools();
    };

    const handleDeleteTool = async (tool) => {
        if (!window.confirm(`Delete “${tool.title}”? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/our-tools/${tool.id}`, { method: "DELETE" });
            const errBody = await res.json().catch(() => ({}));
            if (!res.ok) {
                showToast({
                    message: errBody.error || "Could not delete tool",
                    type: "error",
                    position: "top-center",
                });
                return;
            }
            showToast({
                message: "Tool removed",
                type: "success",
                position: "top-center",
            });
            await loadTools();
        } catch {
            showToast({
                message: "Could not delete tool",
                type: "error",
                position: "top-center",
            });
        }
    };

    if (loading) {
        return (
            <div id="OurToolsPage" className="w-full flex justify-center py-24">
                <Spinner />
            </div>
        );
    }

    return (
        <div id="OurToolsPage" className="w-full">
            <DashboardHeading
                title="Our Tools"
                label="External Tools"
                right={
                    <Button
                        type="button"
                        size="sm"
                        className="text-white bg-[var(--color-primary-searchmind)] hover:bg-[var(--color-primary-searchmind-lighter)] shadow-none border-0 rounded-lg"
                        onClick={() => setToolModal({ mode: "create" })}
                    >
                        + Add tool
                    </Button>
                }
                showAnalyzeWithAi={false}
                showRight
                showPdfExport={false}
            />

            <div className="flex flex-col gap-6">
                <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 space-y-4">
                    <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
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
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-gray-500 hidden sm:inline">View</span>
                            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                                <button
                                    type="button"
                                    aria-pressed={viewMode === "grid"}
                                    onClick={() => setViewMode("grid")}
                                    className={`p-2.5 ${viewMode === "grid" ? "bg-[var(--color-primary-searchmind)] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                                    aria-label="Grid view"
                                >
                                    <FiGrid className="w-5 h-5" />
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={viewMode === "list"}
                                    onClick={() => setViewMode("list")}
                                    className={`p-2.5 border-l border-gray-200 ${viewMode === "list" ? "bg-[var(--color-primary-searchmind)] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                                    aria-label="List view"
                                >
                                    <FiList className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>

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

                    <div>
                        <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                            Tags
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setTagFilter(null)}
                                className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                                    tagFilter === null
                                        ? "border-[var(--color-primary-searchmind)] bg-[var(--color-primary-searchmind)]/10 text-[var(--color-primary-searchmind)]"
                                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                                }`}
                            >
                                All tags
                            </button>
                            {contentTags.map((t) => (
                                <button
                                    key={t.slug}
                                    type="button"
                                    onClick={() => setTagFilter((cur) => (cur === t.slug ? null : t.slug))}
                                    className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-opacity ${
                                        tagFilter === t.slug ? "ring-2 ring-offset-1 ring-[var(--color-primary-searchmind)]" : "opacity-90 hover:opacity-100"
                                    }`}
                                    style={inlineTagStyle(t.color)}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <p className="text-sm text-gray-500">
                    {filteredTools.length} tool{filteredTools.length !== 1 ? "s" : ""} found
                </p>

                {filteredTools.length > 0 ? (
                    viewMode === "grid" ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredTools.map((tool) => (
                                <ToolCard
                                    key={tool.id}
                                    tool={tool}
                                    tagMeta={tagMeta}
                                    onEdit={(t) => setToolModal({ mode: "edit", tool: t })}
                                    onDelete={handleDeleteTool}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {filteredTools.map((tool) => (
                                <ToolListRow
                                    key={tool.id}
                                    tool={tool}
                                    tagMeta={tagMeta}
                                    onEdit={(t) => setToolModal({ mode: "edit", tool: t })}
                                    onDelete={handleDeleteTool}
                                />
                            ))}
                        </div>
                    )
                ) : (
                    <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                        <FiSearch className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-700 mb-2">No tools found</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            {tools.length === 0
                                ? "Add your first external tool, or adjust filters if you already have some."
                                : "Try adjusting your search or filter to find what you need."}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                            {tools.length === 0 && (
                                <Button
                                    type="button"
                                    className="text-white bg-[var(--color-primary-searchmind)] hover:bg-[var(--color-primary-searchmind-lighter)] rounded-lg"
                                    onClick={() => setToolModal({ mode: "create" })}
                                >
                                    + Add tool
                                </Button>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    setSearch("");
                                    setCategory("all");
                                    setTagFilter(null);
                                }}
                                className="text-sm font-medium text-[var(--color-primary-searchmind)] hover:underline"
                            >
                                Clear filters
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <ToolItemModal
                open={!!toolModal}
                onClose={() => setToolModal(null)}
                onSave={handleSaveTool}
                mode={toolModal?.mode === "edit" ? "edit" : "create"}
                initialTool={toolModal?.tool}
            />
        </div>
    );
}
