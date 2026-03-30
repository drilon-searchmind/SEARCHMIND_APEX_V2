"use client";

import React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import FormButton from "@/components/form/FormButton";
import FormInputText from "@/components/form/FormInputText";
import FormLabel from "@/components/form/FormLabel";
import ContentTagPicker from "@/components/content-tags/ContentTagPicker";
import { showToast } from "@/components/ui/ToastProvider";

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
            const res = await fetch("/api/admin/news", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    excerpt: excerpt.trim(),
                    content,
                    coverImageUrl: coverImageUrl.trim(),
                    tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
                    published,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to create");
            showToast({ type: "success", message: "News post created" });
            setTitle("");
            setExcerpt("");
            setContent("");
            setCoverImageUrl("");
            setSelectedTagSlugs([]);
            setPublished(false);
            load();
        } catch (err) {
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
        if (!confirm(`Delete “${post.title}”?`)) return;
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
        <div className="flex flex-col gap-8">
            <div>
                <h5 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-2">Create news post</h5>
                <p className="text-sm text-gray-600 mb-4">
                    Markdown-friendly body (renders on the public news article page). Cover image: paste a URL.
                </p>
                <form onSubmit={handleCreate} className="space-y-4 bg-gray-50 border border-gray-200 rounded-xl p-6 max-w-3xl">
                    <div>
                        <FormLabel htmlFor="news-title">Title</FormLabel>
                        <FormInputText id="news-title" value={title} onChange={(e) => setTitle(e.target.value)} />
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
                            className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 font-mono"
                            placeholder="## Heading&#10;&#10;Your markdown or plain text…"
                        />
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                            type="checkbox"
                            checked={published}
                            onChange={(e) => setPublished(e.target.checked)}
                        />
                        Publish immediately
                    </label>
                    <FormButton type="submit" disabled={saving} borderType="primary">
                        {saving ? "Saving…" : "Create post"}
                    </FormButton>
                </form>
            </div>

            <div>
                <h5 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-3">All posts</h5>
                {loading ? (
                    <p className="text-sm text-gray-500">Loading…</p>
                ) : (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left">Title</th>
                                    <th className="px-4 py-2 text-left">Slug</th>
                                    <th className="px-4 py-2 text-left">Status</th>
                                    <th className="px-4 py-2 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {posts.map((p) => (
                                    <tr key={p.id} className="border-t border-gray-100">
                                        <td className="px-4 py-2 font-medium text-gray-900">{p.title}</td>
                                        <td className="px-4 py-2 text-gray-600">{p.slug}</td>
                                        <td className="px-4 py-2">
                                            {p.published ? (
                                                <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded text-xs">
                                                    Published
                                                </span>
                                            ) : (
                                                <span className="text-gray-600 bg-gray-100 px-2 py-0.5 rounded text-xs">
                                                    Draft
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-right space-x-2">
                                            {p.published && (
                                                <Link
                                                    href={`/news/${p.slug}`}
                                                    className="text-[var(--color-primary-searchmind)] text-xs font-semibold"
                                                >
                                                    View
                                                </Link>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => togglePublished(p)}
                                                className="text-xs font-semibold text-gray-700 underline"
                                            >
                                                {p.published ? "Unpublish" : "Publish"}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => remove(p)}
                                                className="text-xs font-semibold text-red-600 underline"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {posts.length === 0 && (
                            <p className="px-4 py-8 text-center text-gray-500 text-sm">No posts yet.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
