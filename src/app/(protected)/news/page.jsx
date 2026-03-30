"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { FiGrid, FiList, FiSearch } from "react-icons/fi";
import { inlineTagStyle } from "@/components/content-tags/tagPresets";

function NewsListCard({ post, tagMeta, compact }) {
    const inner = (
        <>
            <div className="flex flex-col md:flex-row">
                {post.coverImageUrl ? (
                    <div
                        className={`relative w-full bg-gray-100 shrink-0 overflow-hidden ${
                            compact ? "h-36 md:w-40 md:min-h-[120px]" : "h-40 md:w-52 md:min-h-[160px]"
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
                <div className={`p-5 flex-1 ${compact ? "py-4" : ""}`}>
                    <h2
                        className={`font-semibold text-[var(--color-primary-searchmind)] mb-2 ${
                            compact ? "text-base line-clamp-1" : "text-lg"
                        }`}
                    >
                        {post.title}
                    </h2>
                    {post.excerpt ? (
                        <p className={`text-sm text-gray-600 mb-3 ${compact ? "line-clamp-2" : "line-clamp-2"}`}>
                            {post.excerpt}
                        </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2 items-center text-xs text-gray-500">
                        {post.publishedAt && (
                            <time dateTime={post.publishedAt}>
                                {new Date(post.publishedAt).toLocaleDateString(undefined, {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                })}
                            </time>
                        )}
                        {(post.tags || []).map((slug) => {
                            const meta = tagMeta[slug];
                            const label = meta?.label || slug;
                            return (
                                <span
                                    key={slug}
                                    className="px-2 py-0.5 rounded-full font-medium"
                                    style={inlineTagStyle(meta?.color)}
                                >
                                    {label}
                                </span>
                            );
                        })}
                    </div>
                </div>
            </div>
        </>
    );

    return (
        <Link
            href={`/news/${post.slug}`}
            className="block bg-white rounded-xl border border-gray-200 hover:border-[var(--color-primary-searchmind)] transition-colors overflow-hidden"
        >
            {inner}
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
        <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">News</h1>
            <p className="text-gray-600 text-sm mb-6">Apex updates, tips, and announcements.</p>

            <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 space-y-4 mb-6">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                    <div className="relative flex-1">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="search"
                            placeholder="Search articles..."
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

                <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Tags</p>
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
                                className={`text-xs px-3 py-1.5 rounded-full font-medium border ${
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

            {loading && <p className="text-gray-500">Loading…</p>}
            {error && <p className="text-red-600 text-sm">{error}</p>}

            {!loading && !error && (
                <>
                    <p className="text-sm text-gray-500 mb-4">
                        {filteredPosts.length} article{filteredPosts.length !== 1 ? "s" : ""}
                    </p>
                    {filteredPosts.length > 0 ? (
                        viewMode === "grid" ? (
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {filteredPosts.map((p) => (
                                    <li key={p.id}>
                                        <NewsListCard post={p} tagMeta={tagMeta} compact />
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <ul className="space-y-6">
                                {filteredPosts.map((p) => (
                                    <li key={p.id}>
                                        <NewsListCard post={p} tagMeta={tagMeta} />
                                    </li>
                                ))}
                            </ul>
                        )
                    ) : (
                        <p className="text-gray-500 text-sm">
                            {posts.length === 0 ? "No published articles yet." : "No articles match your filters."}
                        </p>
                    )}
                    {posts.length > 0 && filteredPosts.length === 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearch("");
                                setTagFilter(null);
                            }}
                            className="mt-3 text-sm font-medium text-[var(--color-primary-searchmind)] hover:underline"
                        >
                            Clear filters
                        </button>
                    )}
                </>
            )}
        </div>
    );
}
