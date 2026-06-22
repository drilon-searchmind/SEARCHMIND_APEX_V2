"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { FiX } from "react-icons/fi";
import FormInputText from "@/components/form/FormInputText";
import FormLabel from "@/components/form/FormLabel";
import ContentTagPicker from "@/components/content-tags/ContentTagPicker";
import {
    TOOL_CATEGORY_FILTER_OPTIONS,
    TOOL_ICON_OPTIONS,
} from "../toolsData";
import "../our-tools.css";

const defaultForm = () => ({
    title: "",
    description: "",
    category: TOOL_CATEGORY_FILTER_OPTIONS[0]?.id || "analytics",
    tagSlugs: [],
    url: "",
    icon: "FiGrid",
    badge: "",
    previewImage: "",
    backgroundImage: "",
});

export default function ToolItemModal({
    open,
    onClose,
    onSave,
    initialTool,
    mode = "create",
}) {
    const { data: session } = useSession();
    const canCreateTags = !!session?.user?.isAdmin;
    const [form, setForm] = useState(defaultForm);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        if (initialTool && mode === "edit") {
            setForm({
                title: initialTool.title || "",
                description: initialTool.description || "",
                category: initialTool.category || "analytics",
                tagSlugs: Array.isArray(initialTool.tags)
                    ? initialTool.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
                    : [],
                url: initialTool.url || "",
                icon: initialTool.icon || "FiGrid",
                badge: initialTool.badge || "",
                previewImage: initialTool.previewImage || "",
                backgroundImage: initialTool.backgroundImage || "",
            });
        } else {
            setForm(defaultForm());
        }
    }, [open, initialTool, mode]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.title.trim()) return;
        const payload = {
            title: form.title.trim(),
            description: form.description.trim(),
            category: form.category,
            tags: form.tagSlugs,
            url: form.url.trim(),
            icon: form.icon,
            badge: form.badge.trim(),
            previewImage: form.previewImage.trim(),
            backgroundImage: form.backgroundImage.trim(),
        };
        setSaving(true);
        try {
            await onSave(payload);
            onClose();
        } catch {
            // Parent shows toast
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <div className="apex-tools-modal-backdrop" data-theme="cobalt">
            <div className="apex-tools-modal cobalt-perf">
                <button
                    type="button"
                    className="apex-tools-modal__close"
                    onClick={() => !saving && onClose()}
                    aria-label="Close"
                >
                    <FiX size={20} />
                </button>
                <h2 className="apex-tools-modal__title">
                    {mode === "edit" ? "Edit tool" : "Add tool"}
                </h2>
                <p className="apex-tools-modal__subtitle">
                    External tools appear on the Our Tools page for your team.
                </p>

                <form className="apex-tools-form" onSubmit={handleSubmit}>
                    <div>
                        <FormLabel htmlFor="ot-title" required>
                            Title
                        </FormLabel>
                        <FormInputText
                            id="ot-title"
                            name="title"
                            value={form.title}
                            onChange={handleChange}
                            required
                            disabled={saving}
                        />
                    </div>

                    <div>
                        <FormLabel htmlFor="ot-description">Description</FormLabel>
                        <textarea
                            id="ot-description"
                            name="description"
                            value={form.description}
                            onChange={handleChange}
                            rows={3}
                            disabled={saving}
                            placeholder="Short summary shown on the card"
                        />
                    </div>

                    <div>
                        <FormLabel htmlFor="ot-category" required>
                            Category
                        </FormLabel>
                        <select
                            id="ot-category"
                            name="category"
                            value={form.category}
                            onChange={handleChange}
                            disabled={saving}
                            required
                        >
                            {TOOL_CATEGORY_FILTER_OPTIONS.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <ContentTagPicker
                        scope="tools"
                        value={form.tagSlugs}
                        onChange={(tagSlugs) => setForm((prev) => ({ ...prev, tagSlugs }))}
                        canCreate={canCreateTags}
                        disabled={saving}
                    />

                    <div>
                        <FormLabel htmlFor="ot-url">Tool URL</FormLabel>
                        <FormInputText
                            id="ot-url"
                            name="url"
                            value={form.url}
                            onChange={handleChange}
                            disabled={saving}
                            placeholder="https://…"
                        />
                    </div>

                    <div>
                        <FormLabel htmlFor="ot-icon">Icon</FormLabel>
                        <select
                            id="ot-icon"
                            name="icon"
                            value={form.icon}
                            onChange={handleChange}
                            disabled={saving}
                        >
                            {TOOL_ICON_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <FormLabel htmlFor="ot-badge">Badge (optional)</FormLabel>
                        <FormInputText
                            id="ot-badge"
                            name="badge"
                            value={form.badge}
                            onChange={handleChange}
                            disabled={saving}
                            placeholder="e.g. New, Beta"
                        />
                    </div>

                    <div>
                        <FormLabel htmlFor="ot-preview">Preview image URL (optional)</FormLabel>
                        <FormInputText
                            id="ot-preview"
                            name="previewImage"
                            value={form.previewImage}
                            onChange={handleChange}
                            disabled={saving}
                            placeholder="Direct image URL for the card header"
                        />
                    </div>

                    <div>
                        <FormLabel htmlFor="ot-bg">Background image URL (optional)</FormLabel>
                        <FormInputText
                            id="ot-bg"
                            name="backgroundImage"
                            value={form.backgroundImage}
                            onChange={handleChange}
                            disabled={saving}
                            placeholder="Overrides preview with a CSS background"
                        />
                    </div>

                    <div className="apex-tools-modal__actions">
                        <button
                            type="button"
                            className="apex-tools-modal__cancel"
                            onClick={() => !saving && onClose()}
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="apex-perf-btn apex-perf-btn--primary"
                            disabled={saving}
                        >
                            {saving ? "Saving…" : mode === "edit" ? "Save changes" : "Add tool"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
