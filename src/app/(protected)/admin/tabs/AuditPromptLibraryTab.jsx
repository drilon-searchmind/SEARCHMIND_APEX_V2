"use client";

import React from "react";
import FormButton from "@/components/form/FormButton";
import FormLabel from "@/components/form/FormLabel";
import { showToast } from "@/components/ui/ToastProvider";
import Spinner from "@/components/ui/Spinner";
import { FiPlus, FiTrash2 } from "react-icons/fi";

function selectedIdForScope(scope, selection) {
    if (!selection) return null;
    if (scope === "system") return selection.systemPromptId;
    return selection.channels?.[scope] || null;
}

export default function AuditPromptLibraryTab() {
    const [library, setLibrary] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [activeScope, setActiveScope] = React.useState("system");
    const [activePromptId, setActivePromptId] = React.useState(null);
    const [draftBody, setDraftBody] = React.useState("");
    const [draftTitle, setDraftTitle] = React.useState("");
    const [draftDescription, setDraftDescription] = React.useState("");
    const [saving, setSaving] = React.useState(false);
    const [selectingId, setSelectingId] = React.useState(null);
    const [dirty, setDirty] = React.useState(false);

    const promptsInScope = library?.promptsByScope?.[activeScope] || [];
    const activePrompt =
        promptsInScope.find((p) => p.id === activePromptId) || promptsInScope[0] || null;

    const applyLibrary = React.useCallback(
        (data, opts = {}) => {
            setLibrary(data);
            const scope = opts.scope ?? activeScope;
            const list = data?.promptsByScope?.[scope] || [];
            const selId = selectedIdForScope(scope, data?.selection);
            const preferId = opts.preferPromptId ?? activePromptId;
            const nextActive =
                list.find((p) => p.id === preferId)?.id ||
                list.find((p) => p.id === selId)?.id ||
                list[0]?.id ||
                null;
            setActivePromptId(nextActive);
        },
        [activeScope, activePromptId]
    );

    const load = React.useCallback(() => {
        setLoading(true);
        fetch("/api/admin/audit-prompts")
            .then((r) => r.json())
            .then((d) => {
                if (d.error) throw new Error(d.error);
                applyLibrary(d);
            })
            .catch((err) => {
                setLibrary(null);
                showToast({
                    type: "error",
                    message: err?.message || "Failed to load audit prompts",
                });
            })
            .finally(() => setLoading(false));
    }, [applyLibrary]);

    React.useEffect(() => {
        load();
    }, [load]);

    React.useEffect(() => {
        if (!library) return;
        const list = library.promptsByScope?.[activeScope] || [];
        const selId = selectedIdForScope(activeScope, library.selection);
        const next =
            list.find((p) => p.id === activePromptId)?.id ||
            list.find((p) => p.id === selId)?.id ||
            list[0]?.id ||
            null;
        setActivePromptId(next);
    }, [activeScope, library?.selection]);

    React.useEffect(() => {
        if (!activePrompt) {
            setDraftBody("");
            setDraftTitle("");
            setDraftDescription("");
            setDirty(false);
            return;
        }
        setDraftBody(activePrompt.body || "");
        setDraftTitle(activePrompt.title || "");
        setDraftDescription(activePrompt.description || "");
        setDirty(false);
    }, [activePrompt?.id, activePrompt?.updatedAt]);

    const changeScope = (scope) => {
        if (dirty && !confirm("You have unsaved changes. Discard them?")) return;
        setActiveScope(scope);
        const list = library?.promptsByScope?.[scope] || [];
        const selId = selectedIdForScope(scope, library?.selection);
        setActivePromptId(
            list.find((p) => p.id === selId)?.id || list[0]?.id || null
        );
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!activePrompt?.id || !draftBody.trim()) {
            showToast({ type: "error", message: "Prompt body cannot be empty" });
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/audit-prompts/${activePrompt.id}`, {
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
            showToast({ type: "success", message: "Prompt saved" });
            setDirty(false);
            applyLibrary(data);
        } catch (err) {
            showToast({ type: "error", message: err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleSelect = async (promptId) => {
        setSelectingId(promptId);
        try {
            const res = await fetch("/api/admin/audit-prompts/select", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scope: activeScope, promptId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to select prompt");
            applyLibrary(data);
            showToast({ type: "success", message: "Active prompt updated for Run Audit" });
        } catch (err) {
            showToast({ type: "error", message: err.message });
        } finally {
            setSelectingId(null);
        }
    };

    const handleCreate = async () => {
        const title = window.prompt("Name for the new prompt:", `New prompt`);
        if (title === null) return;
        setSaving(true);
        try {
            const res = await fetch("/api/admin/audit-prompts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    scope: activeScope,
                    title: title.trim() || undefined,
                    body: "Describe the analysis task for this channel. Replace this placeholder text.",
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to create");
            showToast({ type: "success", message: "Prompt created" });
            applyLibrary(data, { preferPromptId: data.prompt?.id });
        } catch (err) {
            showToast({ type: "error", message: err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!activePrompt?.id) return;
        if (!confirm(`Delete "${activePrompt.title}"? This cannot be undone.`)) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/audit-prompts/${activePrompt.id}`, {
                method: "DELETE",
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to delete");
            showToast({ type: "success", message: "Prompt deleted" });
            setDirty(false);
            applyLibrary(data);
        } catch (err) {
            showToast({ type: "error", message: err.message });
        } finally {
            setSaving(false);
        }
    };

    const scopeMeta = library?.scopes?.find((s) => s.id === activeScope);
    const selectedInScope = selectedIdForScope(activeScope, library?.selection);

    if (loading) {
        return (
            <div className="flex justify-center py-16">
                <Spinner />
            </div>
        );
    }

    if (!library) {
        return (
            <p className="text-sm text-gray-600">Could not load the audit prompt library.</p>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h5 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-1">
                    Audit Prompt Library
                </h5>
                <p className="text-sm text-gray-600 max-w-3xl">
                    Create multiple prompts per section (system + each audit channel). Select
                    exactly one active prompt per section — that prompt is used when you run
                    audits in Run Audit. Catalog card titles still label each analysis; the
                    active channel prompt is the task instructions sent to Claude.
                </p>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 min-h-[32rem]">
                <nav
                    className="lg:w-56 shrink-0 rounded-xl border border-gray-200 bg-gray-50/80 overflow-hidden"
                    aria-label="Audit prompt sections"
                >
                    <ul className="divide-y divide-gray-200">
                        {(library.scopes || []).map((s) => {
                            const isActive = s.id === activeScope;
                            const count = (library.promptsByScope?.[s.id] || []).length;
                            const hasSelection = Boolean(
                                selectedIdForScope(s.id, library.selection)
                            );
                            return (
                                <li key={s.id}>
                                    <button
                                        type="button"
                                        onClick={() => changeScope(s.id)}
                                        className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                                            isActive
                                                ? "bg-white border-l-4 border-l-[var(--color-primary-searchmind)] font-semibold text-gray-900"
                                                : "text-gray-700 hover:bg-white/80"
                                        }`}
                                    >
                                        <span className="block">{s.label}</span>
                                        <span className="mt-0.5 block text-[0.65rem] font-normal text-gray-500">
                                            {count} prompt{count === 1 ? "" : "s"}
                                            {hasSelection ? " · 1 selected" : ""}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                <div className="lg:w-72 shrink-0 flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            {scopeMeta?.label || activeScope}
                        </p>
                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={saving}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                            <FiPlus className="h-3.5 w-3.5" />
                            Add
                        </button>
                    </div>
                    {scopeMeta?.description ? (
                        <p className="text-[0.7rem] text-gray-500 leading-snug">
                            {scopeMeta.description}
                        </p>
                    ) : null}
                    <ul className="flex-1 overflow-y-auto space-y-1 min-h-[12rem] max-h-[24rem]">
                        {promptsInScope.length === 0 ? (
                            <li className="text-xs text-gray-500 px-2 py-4">
                                No prompts yet. Click Add to create one.
                            </li>
                        ) : (
                            promptsInScope.map((p) => {
                                const isSelected = p.id === selectedInScope;
                                const isEditing = p.id === activePromptId;
                                return (
                                    <li
                                        key={p.id}
                                        className={`rounded-lg border ${
                                            isEditing
                                                ? "border-[var(--color-primary-searchmind)] bg-white"
                                                : "border-transparent bg-white/60"
                                        }`}
                                    >
                                        <div className="flex items-start gap-2 p-2">
                                            <input
                                                type="radio"
                                                name={`scope-${activeScope}`}
                                                checked={isSelected}
                                                disabled={selectingId != null}
                                                onChange={() => handleSelect(p.id)}
                                                className="mt-1 shrink-0"
                                                title="Use in Run Audit"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (
                                                        dirty &&
                                                        !confirm(
                                                            "Discard unsaved changes?"
                                                        )
                                                    )
                                                        return;
                                                    setActivePromptId(p.id);
                                                }}
                                                className="flex-1 text-left text-sm min-w-0"
                                            >
                                                <span
                                                    className={`block truncate ${
                                                        isEditing
                                                            ? "font-semibold text-gray-900"
                                                            : "text-gray-800"
                                                    }`}
                                                >
                                                    {p.title}
                                                </span>
                                                {isSelected ? (
                                                    <span className="text-[0.65rem] text-emerald-700 font-medium">
                                                        Active in Run Audit
                                                    </span>
                                                ) : null}
                                            </button>
                                        </div>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </div>

                {activePrompt ? (
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
                            <FormLabel htmlFor="prompt-description">
                                Description (admin only)
                            </FormLabel>
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
                                rows={16}
                                className="flex-1 min-h-[14rem] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono text-gray-800 leading-relaxed focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)]/20 resize-y"
                            />
                        </div>
                        {activePrompt.updatedAt ? (
                            <p className="text-xs text-gray-400">
                                Last saved{" "}
                                {new Date(activePrompt.updatedAt).toLocaleString()}
                            </p>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="w-full sm:w-40">
                                <FormButton disabled={saving || !draftBody.trim()}>
                                    {saving ? "Saving…" : dirty ? "Save changes" : "Save"}
                                </FormButton>
                            </div>
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={saving || promptsInScope.length <= 1}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                title={
                                    promptsInScope.length <= 1
                                        ? "Cannot delete the last prompt in this section"
                                        : "Delete prompt"
                                }
                            >
                                <FiTrash2 className="h-4 w-4" />
                                Delete
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="flex-1 rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500 flex flex-col items-center justify-center gap-3">
                        <p>No prompts in this section yet.</p>
                        <button
                            type="button"
                            onClick={handleCreate}
                            className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary-searchmind)] px-4 py-2 text-sm font-medium text-white"
                        >
                            <FiPlus />
                            Create first prompt
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
