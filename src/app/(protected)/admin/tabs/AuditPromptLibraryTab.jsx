"use client";

import React from "react";
import FormLabel from "@/components/form/FormLabel";
import { showToast } from "@/components/ui/ToastProvider";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { FiPlus, FiTrash2 } from "react-icons/fi";

function activeIdsForScope(scope, selection) {
    if (!selection) return [];
    if (scope === "system") {
        return selection.systemPromptId ? [selection.systemPromptId] : [];
    }
    const ch = selection.channels?.[scope];
    return Array.isArray(ch) ? ch : ch ? [ch] : [];
}

function isPromptActive(scope, promptId, selection) {
    return activeIdsForScope(scope, selection).includes(promptId);
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
            const preferId = opts.preferPromptId ?? activePromptId;
            const activeSet = new Set(activeIdsForScope(scope, data?.selection));
            const nextActive =
                list.find((p) => p.id === preferId)?.id ||
                list.find((p) => activeSet.has(p.id))?.id ||
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
        const activeSet = new Set(activeIdsForScope(activeScope, library.selection));
        const next =
            list.find((p) => p.id === activePromptId)?.id ||
            list.find((p) => activeSet.has(p.id))?.id ||
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
        const activeSet = new Set(activeIdsForScope(scope, library?.selection));
        setActivePromptId(
            list.find((p) => activeSet.has(p.id))?.id || list[0]?.id || null
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

    const handleToggleActive = async (promptId, currentlyActive) => {
        setSelectingId(promptId);
        try {
            const res = await fetch("/api/admin/audit-prompts/select", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    scope: activeScope,
                    promptId,
                    active: !currentlyActive,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to update active prompts");
            applyLibrary(data);
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

    if (loading) {
        return <CobaltLoader variant="block" title="Loading audit prompt library" />;
    }

    if (!library) {
        return <p className="apex-admin-empty">Could not load the audit prompt library.</p>;
    }

    return (
        <div className="apex-admin-tab">
            <div>
                <h2 className="apex-admin-section__title">Audit Prompt Library</h2>
                <p className="apex-admin-section__subtitle">
                    Create multiple prompts per section. For each channel (Cross-channel, SEO, PPC,
                    PS, EM), check all prompts that should appear in Run Audit — multiple can be
                    active at once. System prompt: pick exactly one. Active prompts show as
                    selectable cards in Run Audit (title + description from here).
                </p>
            </div>

            <div className="apex-admin-audit">
                <nav className="apex-admin-audit__scopes" aria-label="Audit prompt sections">
                    {(library.scopes || []).map((s) => {
                        const isActive = s.id === activeScope;
                        const count = (library.promptsByScope?.[s.id] || []).length;
                        const activeCount = activeIdsForScope(s.id, library.selection).length;
                        return (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => changeScope(s.id)}
                                className={`apex-admin-audit__scope-btn${isActive ? " is-active" : ""}`}
                            >
                                <span>{s.label}</span>
                                <span className="apex-admin-audit__scope-meta">
                                    {count} prompt{count === 1 ? "" : "s"}
                                    {s.id === "system"
                                        ? activeCount
                                            ? " · 1 active"
                                            : ""
                                        : activeCount
                                          ? ` · ${activeCount} active`
                                          : ""}
                                </span>
                            </button>
                        );
                    })}
                </nav>

                <div className="apex-admin-audit__list-panel">
                    <div className="apex-admin-audit__list-head">
                        <p className="apex-admin-audit__list-label">
                            {scopeMeta?.label || activeScope}
                        </p>
                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={saving}
                            className="apex-perf-btn apex-perf-btn--secondary apex-admin-btn-sm"
                        >
                            <FiPlus className="h-3.5 w-3.5" />
                            Add
                        </button>
                    </div>
                    {scopeMeta?.description ? (
                        <p className="apex-admin-field-hint">{scopeMeta.description}</p>
                    ) : null}
                    <ul className="apex-admin-audit__prompt-list">
                        {promptsInScope.length === 0 ? (
                            <li className="apex-admin-empty px-2 py-4">
                                No prompts yet. Click Add to create one.
                            </li>
                        ) : (
                            promptsInScope.map((p) => {
                                const isActive = isPromptActive(
                                    activeScope,
                                    p.id,
                                    library.selection
                                );
                                const isEditing = p.id === activePromptId;
                                return (
                                    <li
                                        key={p.id}
                                        className={`apex-admin-audit__prompt-item${isEditing ? " is-editing" : ""}`}
                                    >
                                        <div className="apex-admin-audit__prompt-row">
                                            <input
                                                type={activeScope === "system" ? "radio" : "checkbox"}
                                                name={`scope-${activeScope}`}
                                                checked={isActive}
                                                disabled={selectingId != null}
                                                onChange={() =>
                                                    handleToggleActive(p.id, isActive)
                                                }
                                                title={
                                                    activeScope === "system"
                                                        ? "Active system prompt"
                                                        : "Show in Run Audit"
                                                }
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (
                                                        dirty &&
                                                        !confirm("Discard unsaved changes?")
                                                    )
                                                        return;
                                                    setActivePromptId(p.id);
                                                }}
                                                className={`apex-admin-audit__prompt-select${isEditing ? " is-editing" : ""}`}
                                            >
                                                <span>{p.title}</span>
                                                {isActive ? (
                                                    <span className="apex-admin-audit__prompt-active">
                                                        {activeScope === "system"
                                                            ? "Active system prompt"
                                                            : "Shown in Run Audit"}
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
                    <form className="apex-admin-audit__editor apex-admin-form" onSubmit={handleSave}>
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
                            />
                        </div>
                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <FormLabel htmlFor="prompt-body" required>
                                    Prompt text
                                </FormLabel>
                                <span className="apex-admin-audit__char-count">
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
                                className="font-mono flex-1 min-h-[14rem]"
                            />
                        </div>
                        {activePrompt.updatedAt ? (
                            <p className="apex-admin-audit__saved-at">
                                Last saved {new Date(activePrompt.updatedAt).toLocaleString()}
                            </p>
                        ) : null}
                        <div className="apex-admin-actions">
                            <button
                                type="submit"
                                className="apex-perf-btn apex-perf-btn--primary"
                                disabled={saving || !draftBody.trim()}
                            >
                                {saving ? "Saving…" : dirty ? "Save changes" : "Save"}
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={saving || promptsInScope.length <= 1}
                                className="apex-admin-danger-btn"
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
                    <div className="apex-admin-audit__editor-empty">
                        <p>No prompts in this section yet.</p>
                        <button
                            type="button"
                            onClick={handleCreate}
                            className="apex-perf-btn apex-perf-btn--primary"
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
