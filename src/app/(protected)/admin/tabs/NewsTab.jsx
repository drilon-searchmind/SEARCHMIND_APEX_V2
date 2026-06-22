"use client";

import React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import FormInputText from "@/components/form/FormInputText";
import FormLabel from "@/components/form/FormLabel";
import ContentTagPicker from "@/components/content-tags/ContentTagPicker";
import { showToast } from "@/components/ui/ToastProvider";
import CobaltLoader from "@/components/ui/CobaltLoader";

export default function NewsTab() {
    const { data: session } = useSession();
    const canCreateTags = !!session?.user?.isAdmin;
    const [posts, setPosts] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [title, setTitle] = React.useState("");
    const [excerpt, setExcerpt] = React.useState("");
    const [content, setContent] = React.useState("");
    const [coverImageUrl, setCoverImageUrl] = React.useState("");
    const [selectedTagSlugs, setSelectedTagSlugs] = React.useState([]);
    const [published, setPublished] = React.useState(false);
    const [saving, setSaving] = React.useState(false);

    const load = React.useCallback(() => {
        setLoading(true);
        fetch("/api/admin/news")
            .then((r) => r.json())
            .then((d) => setPosts(Array.isArray(d.posts) ? d.posts : []))
            .catch(() => setPosts([]))
            .finally(() => setLoading(false));
    }, []);

    React.useEffect(() => {
        load();
    }, [load]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) {
            showToast({ type: "error", message: "Title and content required" });
            return;
        }
        setSaving(true);
        try {
            const payload = {
                title: title.trim(),
                excerpt: excerpt.trim(),
                content,
                coverImageUrl: coverImageUrl.trim(),
                tags: selectedTagSlugs,
                published,
            };
            const res = await fetch("/api/admin/news", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                console.error("[NewsTab] POST /api/admin/news failed", {
                    status: res.status,
                    body: data,
                    payloadPreview: { ...payload, content: `[${payload.content?.length ?? 0} chars]` },
                });
                throw new Error(data.error || "Failed to create");
            }
            showToast({ type: "success", message: "News post created" });
            setTitle("");
            setExcerpt("");
            setContent("");
            setCoverImageUrl("");
            setSelectedTagSlugs([]);
            setPublished(false);
            load();
        } catch (err) {
            console.error("[NewsTab] handleCreate error", err?.name, err?.message, err?.stack);
            showToast({ type: "error", message: err.message });
        } finally {
            setSaving(false);
        }
    };

    const togglePublished = async (post) => {
        try {
            const res = await fetch(`/api/admin/news/${post.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ published: !post.published }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Update failed");
            load();
        } catch (e) {
            showToast({ type: "error", message: e.message });
        }
    };

    const remove = async (post) => {
        if (!confirm(`Delete "${post.title}"?`)) return;
        try {
            const res = await fetch(`/api/admin/news/${post.id}`, { method: "DELETE" });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || "Delete failed");
            }
            showToast({ type: "success", message: "Deleted" });
            load();
        } catch (e) {
            showToast({ type: "error", message: e.message });
        }
    };

    return (
        <div className="apex-admin-tab apex-admin-stack-section">
            <div>
                <h2 className="apex-admin-section__title">Create news post</h2>
                <p className="apex-admin-section__subtitle">
                    Markdown-friendly body (renders on the public news article page). Cover image:
                    paste a URL.
                </p>
                <form onSubmit={handleCreate} className="apex-admin-form apex-admin-form--panel">
                    <div>
                        <FormLabel htmlFor="news-title">Title</FormLabel>
                        <FormInputText
                            id="news-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>
                    <div>
                        <FormLabel htmlFor="news-excerpt">Excerpt</FormLabel>
                        <FormInputText
                            id="news-excerpt"
                            value={excerpt}
                            onChange={(e) => setExcerpt(e.target.value)}
                            placeholder="Short summary for listing cards"
                        />
                    </div>
                    <div>
                        <FormLabel htmlFor="news-cover">Cover image URL</FormLabel>
                        <FormInputText
                            id="news-cover"
                            value={coverImageUrl}
                            onChange={(e) => setCoverImageUrl(e.target.value)}
                            placeholder="https://..."
                        />
                    </div>
                    <ContentTagPicker
                        scope="news"
                        value={selectedTagSlugs}
                        onChange={setSelectedTagSlugs}
                        canCreate={canCreateTags}
                        disabled={saving}
                    />
                    <div>
                        <FormLabel htmlFor="news-content">Content</FormLabel>
                        <textarea
                            id="news-content"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={14}
                            className="font-mono"
                            placeholder="## Heading&#10;&#10;Your markdown or plain text…"
                        />
                    </div>
                    <label className="apex-admin-checkbox-row">
                        <input
                            type="checkbox"
                            checked={published}
                            onChange={(e) => setPublished(e.target.checked)}
                        />
                        Publish immediately
                    </label>
                    <div className="apex-admin-actions">
                        <button
                            type="submit"
                            className="apex-perf-btn apex-perf-btn--primary"
                            disabled={saving}
                        >
                            {saving ? "Saving…" : "Create post"}
                        </button>
                    </div>
                </form>
            </div>

            <div>
                <h2 className="apex-admin-section__title">All posts</h2>
                {loading ? (
                    <CobaltLoader variant="block" title="Loading posts" />
                ) : posts.length === 0 ? (
                    <p className="apex-admin-empty">No posts yet.</p>
                ) : (
                    <div className="apex-admin-table-wrap">
                        <table className="apex-admin-table">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Slug</th>
                                    <th>Status</th>
                                    <th className="is-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {posts.map((p) => (
                                    <tr key={p.id}>
                                        <td>{p.title}</td>
                                        <td className="is-empty">{p.slug}</td>
                                        <td>
                                            <span
                                                className={`apex-admin-badge ${
                                                    p.published
                                                        ? "apex-admin-badge--ok"
                                                        : "apex-admin-badge--draft"
                                                }`}
                                            >
                                                {p.published ? "Published" : "Draft"}
                                            </span>
                                        </td>
                                        <td className="is-right">
                                            <div className="apex-admin-table-actions">
                                                {p.published && (
                                                    <Link href={`/news/${p.slug}`} className="apex-admin-link">
                                                        View
                                                    </Link>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => togglePublished(p)}
                                                    className="apex-admin-link-btn"
                                                >
                                                    {p.published ? "Unpublish" : "Publish"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => remove(p)}
                                                    className="apex-admin-link-btn apex-admin-link-btn--danger"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
