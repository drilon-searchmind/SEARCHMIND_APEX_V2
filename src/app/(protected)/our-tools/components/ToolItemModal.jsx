"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { FiX } from "react-icons/fi";
import FormInputText from "@/components/form/FormInputText";
import FormLabel from "@/components/form/FormLabel";
import FormButton from "@/components/form/FormButton";
import ContentTagPicker from "@/components/content-tags/ContentTagPicker";
import {
    TOOL_CATEGORY_FILTER_OPTIONS,
    TOOL_ICON_OPTIONS,
} from "../toolsData";

const selectClass =
    "mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 focus:outline-none focus:ring-2";

const textareaClass =
    "mt-2 shadow-none min-h-[88px] w-full rounded-lg border appearance-none px-4 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-3 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20";

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
        <div className="fixed inset-0 z-50 flex items-center justify-center glassmorphism2">
            <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
                <button
                    type="button"
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-xl"
                    onClick={() => !saving && onClose()}
                    aria-label="Close"
                >
                    <FiX size={24} />
                </button>
                <h2 className="text-xl font-bold mb-1 text-gray-900">
                    {mode === "edit" ? "Edit tool" : "Add tool"}
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                    External tools appear on the Our Tools page for your team.
                </p>

                <form className="grid grid-cols-1 gap-4" onSubmit={handleSubmit}>
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
                            className={textareaClass}
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
                            className={selectClass}
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
                            className={selectClass}
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
                        <FormLabel htmlFor="ot-bg">
                            Background image URL (optional)
                        </FormLabel>
                        <FormInputText
                            id="ot-bg"
                            name="backgroundImage"
                            value={form.backgroundImage}
                            onChange={handleChange}
                            disabled={saving}
                            placeholder="Overrides preview with a CSS background"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <button
                            type="button"
                            className="h-12 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                            onClick={() => !saving && onClose()}
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <FormButton disabled={saving}>
                            {saving ? "Saving…" : mode === "edit" ? "Save changes" : "Add tool"}
                        </FormButton>
                    </div>
                </form>
            </div>
        </div>
    );
}
