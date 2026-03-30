"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function NewsPage() {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/news");
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Failed to load");
                setPosts(data.posts || []);
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">News</h1>
            <p className="text-gray-600 text-sm mb-8">Apex updates, tips, and announcements.</p>

            {loading && <p className="text-gray-500">Loading…</p>}
            {error && <p className="text-red-600 text-sm">{error}</p>}

            {!loading && !error && (
                <ul className="space-y-6">
                    {posts.map((p) => (
                        <li key={p.id}>
                            <Link
                                href={`/news/${p.slug}`}
                                className="block bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-[var(--color-primary-searchmind)] transition-colors"
                            >
                                <div className="flex flex-col md:flex-row">
                                    {p.coverImageUrl ? (
                                        <div className="relative w-full md:w-52 h-40 md:h-auto md:min-h-[160px] shrink-0 bg-gray-100">
                                            <Image
                                                src={p.coverImageUrl}
                                                alt=""
                                                fill
                                                className="object-cover"
                                                unoptimized
                                            />
                                        </div>
                                    ) : null}
                                    <div className="p-5 flex-1">
                                        <h2 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-2">
                                            {p.title}
                                        </h2>
                                        {p.excerpt ? (
                                            <p className="text-sm text-gray-600 line-clamp-2 mb-3">{p.excerpt}</p>
                                        ) : null}
                                        <div className="flex flex-wrap gap-2 items-center text-xs text-gray-500">
                                            {p.publishedAt && (
                                                <time dateTime={p.publishedAt}>
                                                    {new Date(p.publishedAt).toLocaleDateString(undefined, {
                                                        year: "numeric",
                                                        month: "short",
                                                        day: "numeric",
                                                    })}
                                                </time>
                                            )}
                                            {(p.tags || []).map((t) => (
                                                <span
                                                    key={t}
                                                    className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full"
                                                >
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}

            {!loading && !error && posts.length === 0 && (
                <p className="text-gray-500 text-sm">No published articles yet.</p>
            )}
        </div>
    );
}
