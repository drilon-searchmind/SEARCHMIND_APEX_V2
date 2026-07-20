"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import CobaltLoader from "@/components/ui/CobaltLoader";
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
import "./our-tools.css";

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

function ToolCardActions({ onEdit, onDelete, tool }) {
    return (
        <div className="apex-tools-card-actions">
            <button
                type="button"
                className="apex-tools-icon-btn"
                aria-label="Edit tool"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEdit(tool);
                }}
            >
                <FiEdit2 aria-hidden />
            </button>
            <button
                type="button"
                className="apex-tools-icon-btn apex-tools-icon-btn--danger"
                aria-label="Delete tool"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete(tool);
                }}
            >
                <FiTrash2 aria-hidden />
            </button>
        </div>
    );
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
                className="apex-tools-card__media"
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
                {showImageLayer ? (
                    <img src={previewUrl} alt="" />
                ) : null}
                {showPlaceholder ? (
                    <div className="apex-tools-card__placeholder">
                        <Icon aria-hidden />
                    </div>
                ) : null}
                {tool.badge ? (
                    <span className="apex-tools-card__badge">{tool.badge}</span>
                ) : null}
            </div>

            <div className="apex-tools-card__body">
                <h3 className="apex-tools-card__title">{tool.title}</h3>
                <p className="apex-tools-card__desc">{tool.description}</p>
                <div className="apex-tools-card__tags">
                    {(tool.tags || []).slice(0, 4).map((slug) => {
                        const meta = tagMeta[slug];
                        const label = meta?.label || slug;
                        return (
                            <span
                                key={slug}
                                className="apex-tools-chip"
                                style={inlineTagStyle(meta?.color)}
                            >
                                {label}
                            </span>
                        );
                    })}
                </div>
                <div className="apex-tools-card__footer">
                    {hasVisitUrl(tool.url) ? (
                        <span className="apex-tools-card__link">
                            Visit
                            <FiExternalLink aria-hidden />
                        </span>
                    ) : (
                        <span className="apex-tools-card__no-link">No link — edit to add a URL</span>
                    )}
                </div>
            </div>
        </>
    );

    return (
        <div className="apex-tools-card-wrap">
            <ToolCardActions tool={tool} onEdit={onEdit} onDelete={onDelete} />
            {hasVisitUrl(tool.url) ? (
                <a
                    href={tool.url.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="apex-tools-card"
                >
                    {inner}
                </a>
            ) : (
                <div className="apex-tools-card">{inner}</div>
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

    return (
        <div className="apex-tools-row">
            <div className="apex-tools-row__actions">
                <button
                    type="button"
                    className="apex-tools-icon-btn"
                    aria-label="Edit tool"
                    onClick={() => onEdit(tool)}
                >
                    <FiEdit2 aria-hidden />
                </button>
                <button
                    type="button"
                    className="apex-tools-icon-btn apex-tools-icon-btn--danger"
                    aria-label="Delete tool"
                    onClick={() => onDelete(tool)}
                >
                    <FiTrash2 aria-hidden />
                </button>
            </div>

            <div
                className="apex-tools-row__thumb"
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
                    <img src={previewUrl} alt="" />
                ) : null}
                {!bgUrl && !previewUrl ? <Icon aria-hidden /> : null}
            </div>

            <div className="apex-tools-row__main">
                <div className="min-w-0">
                    <div className="apex-tools-row__title-row">
                        <h3 className="apex-tools-row__title">{tool.title}</h3>
                        {tool.badge ? (
                            <span className="apex-tools-row__badge">{tool.badge}</span>
                        ) : null}
                    </div>
                    <p className="apex-tools-row__desc">{tool.description}</p>
                </div>

                <div className="apex-tools-row__tags">
                    {(tool.tags || []).map((slug) => {
                        const meta = tagMeta[slug];
                        const label = meta?.label || slug;
                        return (
                            <span
                                key={slug}
                                className="apex-tools-chip"
                                style={inlineTagStyle(meta?.color)}
                            >
                                {label}
                            </span>
                        );
                    })}
                </div>

                <div className="apex-tools-row__aside">
                    <span className="apex-tools-row__cat">{catLabel}</span>
                    {hasVisitUrl(tool.url) ? (
                        <a
                            href={tool.url.trim()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="apex-tools-card__link"
                        >
                            Visit
                            <FiExternalLink aria-hidden />
                        </a>
                    ) : (
                        <span className="apex-tools-card__no-link">No link</span>
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

    return (
        <div id="OurToolsPage" className="apex-perf w-full apex-tools-stack">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Our Tools"
                label="External Tools"
                showAnalyzeWithAi={false}
                showPdfExport={false}
                showRight
                right={
                    <button
                        type="button"
                        className="apex-perf-btn apex-perf-btn--primary"
                        onClick={() => setToolModal({ mode: "create" })}
                    >
                        + Add tool
                    </button>
                }
            />

            <div className="apex-tools-toolbar">
                <div className="apex-tools-toolbar__row">
                    <div className="apex-tools-search">
                        <FiSearch className="apex-tools-search__icon" aria-hidden />
                        <input
                            type="search"
                            placeholder="Search tools..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            aria-label="Search tools"
                        />
                    </div>
                    <div className="apex-tools-view">
                        <span className="apex-tools-view__label">View</span>
                        <div className="apex-tools-view-toggle">
                            <button
                                type="button"
                                aria-pressed={viewMode === "grid"}
                                onClick={() => setViewMode("grid")}
                                className={`apex-tools-view-toggle__btn${viewMode === "grid" ? " is-active" : ""}`}
                                aria-label="Grid view"
                            >
                                <FiGrid aria-hidden />
                            </button>
                            <button
                                type="button"
                                aria-pressed={viewMode === "list"}
                                onClick={() => setViewMode("list")}
                                className={`apex-tools-view-toggle__btn${viewMode === "list" ? " is-active" : ""}`}
                                aria-label="List view"
                            >
                                <FiList aria-hidden />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="apex-tools-categories">
                    {TOOL_CATEGORIES.map((cat) => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setCategory(cat.id)}
                            className={`apex-tools-category${category === cat.id ? " is-active" : ""}`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                <div>
                    <p className="apex-tools-tags__label">Tags</p>
                    <div className="apex-tools-tags">
                        <button
                            type="button"
                            onClick={() => setTagFilter(null)}
                            className={`apex-tools-tag-filter${tagFilter === null ? " is-active" : ""}`}
                        >
                            All tags
                        </button>
                        {contentTags.map((t) => (
                            <button
                                key={t.slug}
                                type="button"
                                onClick={() => setTagFilter((cur) => (cur === t.slug ? null : t.slug))}
                                className={`apex-tools-tag-filter${tagFilter === t.slug ? " is-active" : ""}`}
                                style={tagFilter === t.slug ? undefined : inlineTagStyle(t.color)}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="apex-perf-loading">
                    <CobaltLoader variant="block" title="Loading tools" request="GET /api/our-tools" />
                </div>
            ) : (
                <>
                    <p className="apex-tools-meta">
                        {filteredTools.length} tool{filteredTools.length !== 1 ? "s" : ""} found
                    </p>

                    {filteredTools.length > 0 ? (
                        viewMode === "grid" ? (
                            <div className="apex-tools-grid">
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
                            <div className="apex-tools-list">
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
                        <div className="apex-tools-empty">
                            <FiSearch className="apex-tools-empty__icon" aria-hidden />
                            <h3 className="apex-tools-empty__title">No tools found</h3>
                            <p className="apex-tools-empty__text">
                                {tools.length === 0
                                    ? "Add your first external tool, or adjust filters if you already have some."
                                    : "Try adjusting your search or filter to find what you need."}
                            </p>
                            <div className="apex-tools-empty__actions">
                                {tools.length === 0 ? (
                                    <button
                                        type="button"
                                        className="apex-perf-btn apex-perf-btn--primary"
                                        onClick={() => setToolModal({ mode: "create" })}
                                    >
                                        + Add tool
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearch("");
                                        setCategory("all");
                                        setTagFilter(null);
                                    }}
                                    className="apex-tools-link-btn"
                                >
                                    Clear filters
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

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
