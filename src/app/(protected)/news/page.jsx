"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { FiGrid, FiList, FiSearch } from "react-icons/fi";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { inlineTagStyle } from "@/components/content-tags/tagPresets";
import "./news.css";

function NewsListCard({ post, tagMeta, compact }) {
    return (
        <Link
            href={`/news/${post.slug}`}
            className={`apex-news-card${compact ? " apex-news-card--compact" : ""}`}
        >
            <div className="apex-news-card__inner">
                {post.coverImageUrl ? (
                    <div
                        className={`apex-news-card__media ${
                            compact ? "apex-news-card__media--grid" : "apex-news-card__media--list"
                        }`}
                    >
                        <Image
                            src={post.coverImageUrl}
                            alt=""
                            fill
                            className="object-cover"
                            unoptimized
                        />
                    </div>
                ) : null}
                <div className="apex-news-card__body">
                    <h2 className="apex-news-card__title">{post.title}</h2>
                    {post.excerpt ? (
                        <p className="apex-news-card__excerpt">{post.excerpt}</p>
                    ) : null}
                    <div className="apex-news-card__meta">
                        {post.publishedAt ? (
                            <time dateTime={post.publishedAt}>
                                {new Date(post.publishedAt).toLocaleDateString(undefined, {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                })}
                            </time>
                        ) : null}
                        {(post.tags || []).map((slug) => {
                            const meta = tagMeta[slug];
                            const label = meta?.label || slug;
                            return (
                                <span
                                    key={slug}
                                    className="apex-news-chip"
                                    style={inlineTagStyle(meta?.color)}
                                >
                                    {label}
                                </span>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Link>
    );
}

export default function NewsPage() {
    const [posts, setPosts] = useState([]);
    const [contentTags, setContentTags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [tagFilter, setTagFilter] = useState(null);
    const [viewMode, setViewMode] = useState("list");

    useEffect(() => {
        (async () => {
            try {
                const [newsRes, tagsRes] = await Promise.all([
                    fetch("/api/news"),
                    fetch("/api/content-tags?scope=news"),
                ]);
                const data = await newsRes.json();
                const tagData = await tagsRes.json().catch(() => ({}));
                if (!newsRes.ok) throw new Error(data.error || "Failed to load");
                setPosts(Array.isArray(data.posts) ? data.posts : []);
                if (tagsRes.ok) setContentTags(Array.isArray(tagData.tags) ? tagData.tags : []);
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
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

    const filteredPosts = useMemo(() => {
        let list = posts;
        if (tagFilter) {
            list = list.filter((p) => (p.tags || []).includes(tagFilter));
        }
        if (search.trim()) {
            const q = search.toLowerCase().trim();
            list = list.filter(
                (p) =>
                    (p.title || "").toLowerCase().includes(q) ||
                    (p.excerpt || "").toLowerCase().includes(q) ||
                    (p.tags || []).some((slug) => {
                        const lab = (tagMeta[slug]?.label || "").toLowerCase();
                        return (slug || "").toLowerCase().includes(q) || lab.includes(q);
                    })
            );
        }
        return list;
    }, [posts, search, tagFilter, tagMeta]);

    return (
        <div id="NewsPage" className="cobalt-perf w-full apex-news-stack" data-theme="cobalt">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="News"
                label="Apex updates, tips, and announcements"
            />

            <div className="apex-news-toolbar">
                <div className="apex-news-toolbar__row">
                    <div className="apex-news-search">
                        <FiSearch className="apex-news-search__icon" aria-hidden />
                        <input
                            type="search"
                            placeholder="Search articles..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            aria-label="Search articles"
                        />
                    </div>
                    <div className="apex-news-view">
                        <span className="apex-news-view__label">View</span>
                        <div className="apex-news-view-toggle">
                            <button
                                type="button"
                                aria-pressed={viewMode === "grid"}
                                onClick={() => setViewMode("grid")}
                                className={`apex-news-view-toggle__btn${viewMode === "grid" ? " is-active" : ""}`}
                                aria-label="Grid view"
                            >
                                <FiGrid aria-hidden />
                            </button>
                            <button
                                type="button"
                                aria-pressed={viewMode === "list"}
                                onClick={() => setViewMode("list")}
                                className={`apex-news-view-toggle__btn${viewMode === "list" ? " is-active" : ""}`}
                                aria-label="List view"
                            >
                                <FiList aria-hidden />
                            </button>
                        </div>
                    </div>
                </div>

                <div>
                    <p className="apex-news-tags__label">Tags</p>
                    <div className="apex-news-tags">
                        <button
                            type="button"
                            onClick={() => setTagFilter(null)}
                            className={`apex-news-tag-filter${tagFilter === null ? " is-active" : ""}`}
                        >
                            All tags
                        </button>
                        {contentTags.map((t) => (
                            <button
                                key={t.slug}
                                type="button"
                                onClick={() => setTagFilter((cur) => (cur === t.slug ? null : t.slug))}
                                className={`apex-news-tag-filter${tagFilter === t.slug ? " is-active" : ""}`}
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
                    <CobaltLoader variant="block" title="Loading news" request="GET /api/news" />
                </div>
            ) : null}

            {error ? <p className="apex-news-error">{error}</p> : null}

            {!loading && !error ? (
                <>
                    <p className="apex-news-meta">
                        {filteredPosts.length} article{filteredPosts.length !== 1 ? "s" : ""}
                    </p>
                    {filteredPosts.length > 0 ? (
                        viewMode === "grid" ? (
                            <ul className="apex-news-grid apex-news-grid--grid">
                                {filteredPosts.map((p) => (
                                    <li key={p.id}>
                                        <NewsListCard post={p} tagMeta={tagMeta} compact />
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <ul className="apex-news-list">
                                {filteredPosts.map((p) => (
                                    <li key={p.id}>
                                        <NewsListCard post={p} tagMeta={tagMeta} />
                                    </li>
                                ))}
                            </ul>
                        )
                    ) : (
                        <p className="apex-news-empty">
                            {posts.length === 0 ? "No published articles yet." : "No articles match your filters."}
                        </p>
                    )}
                    {posts.length > 0 && filteredPosts.length === 0 ? (
                        <button
                            type="button"
                            onClick={() => {
                                setSearch("");
                                setTagFilter(null);
                            }}
                            className="apex-news-link-btn"
                        >
                            Clear filters
                        </button>
                    ) : null}
                </>
            ) : null}
        </div>
    );
}
