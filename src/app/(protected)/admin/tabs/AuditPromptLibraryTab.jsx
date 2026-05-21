"use client";

import React from "react";
import FormButton from "@/components/form/FormButton";
import FormLabel from "@/components/form/FormLabel";
import { showToast } from "@/components/ui/ToastProvider";
import Spinner from "@/components/ui/Spinner";

export default function AuditPromptLibraryTab() {
    const [prompts, setPrompts] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [activeSlug, setActiveSlug] = React.useState("system");
    const [draftBody, setDraftBody] = React.useState("");
    const [draftTitle, setDraftTitle] = React.useState("");
    const [draftDescription, setDraftDescription] = React.useState("");
    const [saving, setSaving] = React.useState(false);
    const [dirty, setDirty] = React.useState(false);

    const active = prompts.find((p) => p.slug === activeSlug) || null;

    const load = React.useCallback(() => {
        setLoading(true);
        fetch("/api/admin/audit-prompts")
            .then((r) => r.json())
            .then((d) => {
                const list = Array.isArray(d.prompts) ? d.prompts : [];
                setPrompts(list);
                setActiveSlug((prev) =>
                    list.length && !list.some((p) => p.slug === prev) ? list[0].slug : prev
                );
            })
            .catch(() => {
                setPrompts([]);
                showToast({ type: "error", message: "Failed to load audit prompts" });
            })
            .finally(() => setLoading(false));
    }, []);

    React.useEffect(() => {
        load();
    }, [load]);

    React.useEffect(() => {
        if (!active) return;
        setDraftBody(active.body || "");
        setDraftTitle(active.title || "");
        setDraftDescription(active.description || "");
        setDirty(false);
    }, [active?.slug, active?.updatedAt]);

    const selectSlug = (slug) => {
        if (dirty && !confirm("You have unsaved changes. Discard them?")) return;
        setActiveSlug(slug);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!activeSlug || !draftBody.trim()) {
            showToast({ type: "error", message: "Prompt body cannot be empty" });
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/audit-prompts/${activeSlug}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    body: draftBody,
                    title: draftTitle,
                    description: draftDescription,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to save");
            showToast({ type: "success", message: "Audit prompt saved" });
            setDirty(false);
            setPrompts((prev) =>
                prev.map((p) => (p.slug === activeSlug ? { ...p, ...data.prompt } : p))
            );
        } catch (err) {
            showToast({ type: "error", message: err.message });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-16">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h5 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-1">
                    Audit Prompt Library
                </h5>
                <p className="text-sm text-gray-600 max-w-3xl">
                    Edit the shared system prompt and five modular analysis prompts used when running
                    channel audits. Prompts are stored in the database; changes apply to new audit runs.
                    Prompts cannot be deleted and must always contain text.
                </p>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 min-h-[28rem]">
                <nav
                    className="lg:w-72 shrink-0 rounded-xl border border-gray-200 bg-gray-50/80 overflow-hidden"
                    aria-label="Audit prompt sections"
                >
                    <ul className="divide-y divide-gray-200">
                        {prompts.map((p) => {
                            const isActive = p.slug === activeSlug;
                            return (
                                <li key={p.slug}>
                                    <button
                                        type="button"
                                        onClick={() => selectSlug(p.slug)}
                                        className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                                            isActive
                                                ? "bg-white border-l-4 border-l-[var(--color-primary-searchmind)] font-semibold text-gray-900"
                                                : "text-gray-700 hover:bg-white/80"
                                        }`}
                                    >
                                        <span className="block">{p.title}</span>
                                        {p.slug === "system" ? (
                                            <span className="mt-0.5 block text-[0.65rem] font-normal text-gray-500">
                                                Reused on all analyses
                                            </span>
                                        ) : null}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {active ? (
                    <form
                        className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-4"
                        onSubmit={handleSave}
                    >
                        <div>
                            <FormLabel htmlFor="prompt-title">Display title</FormLabel>
                            <input
                                id="prompt-title"
                                type="text"
                                value={draftTitle}
                                onChange={(e) => {
                                    setDraftTitle(e.target.value);
                                    setDirty(true);
                                }}
                                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)]/20"
                            />
                        </div>
                        <div>
                            <FormLabel htmlFor="prompt-description">Description (admin only)</FormLabel>
                            <input
                                id="prompt-description"
                                type="text"
                                value={draftDescription}
                                onChange={(e) => {
                                    setDraftDescription(e.target.value);
                                    setDirty(true);
                                }}
                                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)]/20"
                            />
                        </div>
                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <FormLabel htmlFor="prompt-body" required>
                                    Prompt text
                                </FormLabel>
                                <span className="text-xs text-gray-400 tabular-nums">
                                    {draftBody.length} characters
                                </span>
                            </div>
                            <textarea
                                id="prompt-body"
                                value={draftBody}
                                onChange={(e) => {
                                    setDraftBody(e.target.value);
                                    setDirty(true);
                                }}
                                required
                                rows={18}
                                className="flex-1 min-h-[16rem] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono text-gray-800 leading-relaxed focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)]/20 resize-y"
                            />
                        </div>
                        {active.updatedAt ? (
                            <p className="text-xs text-gray-400">
                                Last saved {new Date(active.updatedAt).toLocaleString()}
                            </p>
                        ) : null}
                        <div className="w-full md:w-40">
                            <FormButton disabled={saving || !draftBody.trim()}>
                                {saving ? "Saving…" : dirty ? "Save changes" : "Save"}
                            </FormButton>
                        </div>
                    </form>
                ) : (
                    <div className="flex-1 rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500">
                        No prompt selected.
                    </div>
                )}
            </div>
        </div>
    );
}
