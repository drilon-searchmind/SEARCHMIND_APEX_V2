"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { inlineTagStyle } from "@/components/content-tags/tagPresets";
import "../news.css";

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
        <div id="NewsArticlePage" className="apex-perf w-full apex-news-stack apex-news-stack--article">
            <Link href="/news" className="apex-news-back">
                ← Back to news
            </Link>

            {loading ? (
                <div className="apex-perf-loading">
                    <CobaltLoader variant="block" title="Loading article" request={`GET /api/news/${slug}`} />
                </div>
            ) : null}

            {error ? <p className="apex-news-error">{error}</p> : null}

            {post && !loading ? (
                <article className="apex-news-article">
                    {post.coverImageUrl ? (
                        <div className="apex-news-article__cover">
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
                    <div className="apex-news-article__content">
                        <h1 className="apex-news-article__title">{post.title}</h1>
                        <div className="apex-news-article__meta">
                            {post.publishedAt ? (
                                <time dateTime={post.publishedAt}>
                                    {new Date(post.publishedAt).toLocaleDateString(undefined, {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                    })}
                                </time>
                            ) : null}
                            {(post.tags || []).map((s) => {
                                const meta = tagMeta[s];
                                const label = meta?.label || s;
                                return (
                                    <span
                                        key={s}
                                        className="apex-news-chip"
                                        style={inlineTagStyle(meta?.color)}
                                    >
                                        {label}
                                    </span>
                                );
                            })}
                        </div>
                        <div id="newsContent" className="apex-news-article__body">
                            <ReactMarkdown>{post.content}</ReactMarkdown>
                        </div>
                    </div>
                </article>
            ) : null}
        </div>
    );
}
