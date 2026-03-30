"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { inlineTagStyle } from "@/components/content-tags/tagPresets";

export default function NewsArticlePage() {
    const params = useParams();
    const slug = params?.slug;
    const [post, setPost] = useState(null);
    const [contentTags, setContentTags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        (async () => {
            try {
                const r = await fetch("/api/content-tags?scope=news");
                const d = await r.json();
                if (r.ok) setContentTags(Array.isArray(d.tags) ? d.tags : []);
            } catch {
                setContentTags([]);
            }
        })();
    }, []);

    useEffect(() => {
        if (!slug) return;
        (async () => {
            try {
                const res = await fetch(`/api/news/${encodeURIComponent(slug)}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Not found");
                setPost(data.post);
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [slug]);

    const tagMeta = useMemo(() => {
        const m = Object.create(null);
        for (const t of contentTags) {
            m[t.slug] = { label: t.label, color: t.color };
        }
        return m;
    }, [contentTags]);

    return (
        <div className="max-w-3xl mx-auto">
            <Link href="/news" className="text-sm text-[var(--color-primary-searchmind)] font-semibold mb-6 inline-block">
                ← Back to news
            </Link>

            {loading && <p className="text-gray-500">Loading…</p>}
            {error && <p className="text-red-600">{error}</p>}

            {post && !loading && (
                <article className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {post.coverImageUrl ? (
                        <div className="relative w-full h-56 md:h-72 bg-gray-100">
                            <Image
                                src={post.coverImageUrl}
                                alt=""
                                fill
                                className="object-cover"
                                unoptimized
                                priority
                            />
                        </div>
                    ) : null}
                    <div className="p-6 md:p-10">
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">{post.title}</h1>
                        <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-8">
                            {post.publishedAt && (
                                <time dateTime={post.publishedAt}>
                                    {new Date(post.publishedAt).toLocaleDateString(undefined, {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                    })}
                                </time>
                            )}
                            {(post.tags || []).map((s) => {
                                const meta = tagMeta[s];
                                const label = meta?.label || s;
                                return (
                                    <span
                                        key={s}
                                        className="px-2 py-0.5 rounded-full font-medium text-xs"
                                        style={inlineTagStyle(meta?.color)}
                                    >
                                        {label}
                                    </span>
                                );
                            })}
                        </div>
                        <div id="newsContent" className="prose prose-sm md:prose-base max-w-none text-gray-800 prose-headings:text-gray-900 prose-a:text-[var(--color-primary-searchmind)]">
                            <ReactMarkdown>{post.content}</ReactMarkdown>
                        </div>
                    </div>
                </article>
            )}
        </div>
    );
}
